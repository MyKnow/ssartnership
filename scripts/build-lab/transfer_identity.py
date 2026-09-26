#!/usr/bin/env python3
"""Guest-side QGA public-key installation; no private credential enters a guest."""
import base64
import json
import os
from pathlib import Path
import pwd
import socket
import sys
import tempfile

MARKER = 'build-lab-497-ephemeral'
PREFIX = b'\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20'


def validate_key(value):
    parts = value.split(' ')
    if len(parts) != 2 or parts[0] != 'ssh-ed25519' or '\n' in value or '\r' in value:
        raise ValueError('Invalid public key')
    try:
        raw = base64.b64decode(parts[1], validate=True)
    except Exception:
        raise ValueError('Invalid public key') from None
    if len(raw) != len(PREFIX) + 32 or not raw.startswith(PREFIX):
        raise ValueError('Invalid Ed25519 wire key')
    return value


def authorized_keys(existing, key):
    validate_key(key)
    retained = [line for line in existing.splitlines() if not line.endswith(' ' + MARKER)]
    retained.append('from="10.77.49.1",restrict ' + key + ' ' + MARKER)
    return '\n'.join(retained) + '\n'


def main():
    if os.getuid() != 0 or socket.gethostname() not in ('ssartnership-build-lab', 'ssartnership-preview-lab'):
        raise RuntimeError('Wrong guest')
    if len(sys.argv) != 2:
        raise ValueError('Expected public key')
    key = validate_key(sys.argv[1])
    account = pwd.getpwnam('builder')
    directory = Path('/home/builder/.ssh')
    if account.pw_dir != '/home/builder' or directory.is_symlink():
        raise ValueError('Unexpected SSH directory')
    directory.mkdir(mode=0o700, exist_ok=True)
    os.chown(directory, account.pw_uid, account.pw_gid)
    target = directory / 'authorized_keys'
    if target.is_symlink() or (target.exists() and not target.is_file()):
        raise ValueError('Unexpected authorized keys file')
    existing = target.read_text() if target.exists() else ''
    with tempfile.NamedTemporaryFile(mode='w', dir=directory, delete=False) as handle:
        pending = Path(handle.name)
        try:
            handle.write(authorized_keys(existing, key))
            handle.flush()
            os.fchmod(handle.fileno(), 0o600)
            os.fchown(handle.fileno(), account.pw_uid, account.pw_gid)
            pending.replace(target)
        finally:
            pending.unlink(missing_ok=True)
    host_parts = Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().split()
    host_key = validate_key(' '.join(host_parts[:2]))
    print(json.dumps({'hostKey': host_key, 'publicKeyInstalled': True}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"error":"LAB_TRANSFER_IDENTITY_FAILED"}')
        raise SystemExit(1)
