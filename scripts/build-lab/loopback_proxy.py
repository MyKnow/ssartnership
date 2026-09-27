"""Host-loopback forwarding to containers that have no external network route."""
import ipaddress
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys
import time

EXECUTABLE = '/lib/systemd/systemd-socket-proxyd'


def assert_host():
    if os.getuid() != 0 or subprocess.check_output(['hostname', '-s'], text=True).strip() != 'ssartnership-preview-lab':
        raise RuntimeError('Wrong proxy host')


def proxy_target(kind, inspection):
    ports = {'app': (3100, 3000), 'api': (54321, 8000)}
    if kind not in ports:
        raise ValueError('Unknown lab service')
    candidates = [value.get('IPAddress', '') for key, value in inspection.get('NetworkSettings', {}).get('Networks', {}).items() if key.endswith('_private')]
    if len(candidates) != 1:
        raise ValueError('Expected one private network')
    address = ipaddress.ip_address(candidates[0])
    if address not in ipaddress.ip_network('172.16.0.0/12'):
        raise ValueError('Unexpected Docker network address')
    listen, destination = ports[kind]
    return listen, str(address) + ':' + str(destination)


def current_target(kind):
    if kind not in ('app', 'api'):
        raise ValueError('Unknown lab service')
    container = 'ssartnership-lab-497-' + ('app' if kind == 'app' else 'gateway') + '-1'
    networks = json.loads(subprocess.check_output(
        ['docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', container],
        text=True, stderr=subprocess.PIPE, timeout=10))
    allowed = {'ssartnership-lab-497_private', 'ssartnership-lab-497_edge'}
    if not isinstance(networks, dict) or not networks or set(networks) - allowed:
        raise ValueError('Unexpected proxy network')
    internal = subprocess.check_output(
        ['docker', 'network', 'inspect', '--format', '{{.Internal}}', *sorted(networks)],
        text=True, stderr=subprocess.PIPE, timeout=10).splitlines()
    if len(internal) != len(networks) or any(value != 'true' for value in internal):
        raise ValueError('External proxy network forbidden')
    if not networks.get('ssartnership-lab-497_private', {}).get('IPAddress'):
        raise RuntimeError('Container network is not ready')
    return proxy_target(kind, {'NetworkSettings': {'Networks': networks}})[1]


def serve(kind):
    assert_host()
    deadline = time.monotonic() + 45
    while True:
        try:
            destination = current_target(kind)
            break
        except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)
    # Resolve Docker state as root, then permanently drop privileges before
    # forwarding. exec preserves the PID and socket-activation descriptors.
    account = pwd.getpwnam('nobody')
    os.setgroups([])
    os.setgid(account.pw_gid)
    os.setuid(account.pw_uid)
    os.execv(EXECUTABLE, [EXECUTABLE, destination])


def configure_proxy(kind, inspection):
    assert_host()
    listen, _ = proxy_target(kind, inspection)
    if not Path(EXECUTABLE).is_file():
        raise RuntimeError('System socket proxy unavailable')
    unit = 'ssartnership-lab-497-' + kind + '-loopback'
    service = f'''[Unit]
Description=Synthetic lab {kind} loopback proxy
Requires={unit}.socket
After=docker.service
[Service]
ExecStart=/usr/bin/python3 /usr/local/lib/build-lab-497/loopback_proxy.py serve {kind}
Environment=PYTHONDONTWRITEBYTECODE=1
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
'''
    socket = f'''[Unit]
Description=Synthetic lab {kind} loopback listener
[Socket]
ListenStream=127.0.0.1:{listen}
NoDelay=true
[Install]
WantedBy=sockets.target
'''
    for suffix, content in [('service', service), ('socket', socket)]:
        path = Path('/etc/systemd/system') / (unit + '.' + suffix)
        path.write_text(content)
        path.chmod(0o644)
    subprocess.run(['systemctl', 'daemon-reload'], check=True, capture_output=True)
    subprocess.run(['systemctl', 'enable', '--now', unit + '.socket'], check=True, capture_output=True)
    subprocess.run(['systemctl', 'restart', unit + '.service'], check=True, capture_output=True)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3 or sys.argv[1] != 'serve' or sys.argv[2] not in ('app', 'api'):
            raise ValueError('Invalid proxy invocation')
        serve(sys.argv[2])
    except Exception:
        print('{"error":"LAB_LOOPBACK_PROXY_START_FAILED"}', flush=True)
        raise SystemExit(1)
