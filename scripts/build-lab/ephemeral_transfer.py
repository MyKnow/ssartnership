"""PVE transfer identity: private key exists only in this process and ssh-agent."""
import json
import os
from pathlib import Path
import resource
import socket
import subprocess
import tempfile
import time
from transfer_identity import validate_key

ENDPOINTS = {'4970': '10.77.49.10', '4971': '10.77.49.20'}


class EphemeralTransfer:
    def __init__(self):
        self.agent = None
        self.directory = None

    def __enter__(self):
        if os.getuid() != 0 or socket.gethostname() != 'myknow-pve':
            raise RuntimeError('PVE host only')
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        self.directory = tempfile.TemporaryDirectory(prefix='build-lab-transfer-', dir='/run')
        root = Path(self.directory.name)
        agent_socket = root / 'agent.sock'
        try:
            self.agent = subprocess.Popen(['ssh-agent', '-D', '-a', str(agent_socket)],
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 5
            while not agent_socket.exists():
                if self.agent.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Transfer agent unavailable')
                time.sleep(0.05)
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
            from cryptography.hazmat.primitives import serialization
            key = Ed25519PrivateKey.generate()
            self.public = key.public_key().public_bytes(serialization.Encoding.OpenSSH,
                                                       serialization.PublicFormat.OpenSSH).decode()
            private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH,
                                        serialization.NoEncryption())
            subprocess.run(['ssh-add', '-t', '1800', '-'], input=private, check=True, timeout=10,
                           env={'PATH': '/usr/bin:/bin', 'SSH_AUTH_SOCK': str(agent_socket)},
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            del private, key
            public_file = root / 'identity.pub'
            public_file.write_text(self.public + '\n')
            self.known_hosts = root / 'known_hosts'
            self.known_hosts.touch(mode=0o600)
            self.options = ['-F', '/dev/null', '-o', 'ForwardAgent=no',
                            '-o', 'ClearAllForwardings=yes', '-o', 'GlobalKnownHostsFile=/dev/null',
                            '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
                            '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10',
                            '-o', 'IdentityAgent=' + str(agent_socket),
                            '-o', 'UserKnownHostsFile=' + str(self.known_hosts), '-i', str(public_file)]
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def prepare(self, vmid):
        if vmid not in ENDPOINTS:
            raise ValueError('Lab guest only')
        result = subprocess.run(['qm', 'guest', 'exec', vmid, '--timeout', '30', '--',
                                 '/usr/bin/python3', '/usr/local/lib/build-lab-497/transfer_identity.py',
                                 self.public], capture_output=True, text=True, check=True, timeout=40)
        envelope = json.loads(result.stdout)
        if envelope.get('exitcode') != 0 or envelope.get('exited') != 1 or envelope.get('out-truncated'):
            raise RuntimeError('Guest identity setup failed')
        identity = json.loads(envelope['out-data'])
        if identity.get('publicKeyInstalled') is not True:
            raise ValueError('Guest identity not installed')
        host_key = validate_key(identity['hostKey'])
        with self.known_hosts.open('a') as handle:
            handle.write(ENDPOINTS[vmid] + ' ' + host_key + '\n')

    def __exit__(self, *_):
        if self.agent is not None and self.agent.poll() is None:
            self.agent.terminate()
            try:
                self.agent.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.agent.kill()
                self.agent.wait(timeout=5)
        if self.directory is not None:
            self.directory.cleanup()
