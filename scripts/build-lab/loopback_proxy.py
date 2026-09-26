"""Host-loopback forwarding to containers that have no external network route."""
import ipaddress
import os
from pathlib import Path
import subprocess


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


def configure_proxy(kind, inspection):
    if os.getuid() != 0 or subprocess.check_output(['hostname', '-s'], text=True).strip() != 'ssartnership-preview-lab':
        raise RuntimeError('Wrong proxy host')
    listen, destination = proxy_target(kind, inspection)
    executable = Path('/lib/systemd/systemd-socket-proxyd')
    if not executable.is_file():
        raise RuntimeError('System socket proxy unavailable')
    unit = 'ssartnership-lab-497-' + kind + '-loopback'
    service = f'''[Unit]
Description=Synthetic lab {kind} loopback proxy
Requires={unit}.socket
After=docker.service
[Service]
ExecStart={executable} {destination}
User=nobody
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
