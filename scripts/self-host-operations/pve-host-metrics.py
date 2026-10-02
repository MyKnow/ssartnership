#!/usr/bin/env python3
"""Read-only host observations; never changes disks, PVE configuration or access."""
import json
import os
import ssl
import socket
import http.client
import subprocess
import time
import urllib.request
from pathlib import Path


def command(args):
    p = subprocess.run(args, capture_output=True, text=True, timeout=20)
    if p.returncode:
        raise RuntimeError('HOST_OBSERVATION_FAILED')
    return p.stdout


def cpu_busy_ratio(before, after):
    def counters(text):
        fields = text.splitlines()[0].split()
        if fields[0] != 'cpu' or len(fields) < 9:
            raise ValueError('HOST_CPU_OBSERVATION_INVALID')
        return [int(x) for x in fields[1:9]]
    previous, current = counters(before), counters(after)
    delta = [b - a for a, b in zip(previous, current)]
    total = sum(delta)
    if total <= 0 or any(x < 0 for x in delta):
        raise ValueError('HOST_CPU_OBSERVATION_INVALID')
    return 1 - (delta[3] + delta[4]) / total


def memory_available_bytes(text):
    for line in text.splitlines():
        fields = line.split()
        if fields and fields[0] == 'MemAvailable:' and len(fields) == 3 and fields[2] == 'kB':
            available = int(fields[1])
            if available >= 0:
                return available * 1024
    raise ValueError('HOST_MEMORY_OBSERVATION_INVALID')


def collect():
    state = json.loads(command(['pvesh', 'get', '/nodes/myknow-pve/status', '--output-format', 'json']))
    # pvesh is a fresh process and its CPU delta may be zero on the first read.
    before = Path('/proc/stat').read_text()
    time.sleep(1)
    busy = cpu_busy_ratio(before, Path('/proc/stat').read_text())
    values = {
        'myknow_pve_collected_seconds': time.time(),
        'myknow_pve_cpu_busy_ratio': busy,
        'myknow_pve_memory_available_bytes': memory_available_bytes(Path('/proc/meminfo').read_text()),
        'myknow_pve_memory_total_bytes': state['memory']['total'],
        'myknow_pve_root_available_bytes': state['rootfs']['avail'],
        'myknow_pve_root_total_bytes': state['rootfs']['total'],
    }
    # Report live kernel counters without lock or hint-file writes. --readonly
    # suppresses device-mapper observations too, so cannot report thin usage.
    lvs = json.loads(command(['lvs', '--nolocking', '--nohints', 'pve/data', '--reportformat', 'json', '-o', 'data_percent,metadata_percent']))['report'][0]['lv'][0]
    values['myknow_pve_thin_data_used_ratio'] = float(lvs['data_percent']) / 100
    values['myknow_pve_thin_metadata_used_ratio'] = float(lvs['metadata_percent']) / 100
    for disk, label in [('/dev/nvme0n1', 'system'), ('/dev/sda', 'backup')]:
        result = subprocess.run(['smartctl', '-H', '-j', disk], capture_output=True, text=True, timeout=20)
        health = json.loads(result.stdout).get('smart_status', {}).get('passed')
        if not isinstance(health, bool) or result.returncode & 3:
            raise RuntimeError('HOST_SMART_OBSERVATION_FAILED')
        values[f'myknow_pve_{label}_disk_healthy'] = int(health)
    return values


def main():
    values = collect()
    url = os.environ.get('OPS_HOST_METRICS_URL')
    if not url:
        print(json.dumps(values))
        return
    if url != 'https://ssartnership-infra.myknow.xyz/infra/host-metrics':
        raise RuntimeError('HOST_DESTINATION_INVALID')
    token = os.environ['OPS_HOST_METRICS_TOKEN']
    if len(token) < 32 or any(c in token for c in '\r\n'):
        raise RuntimeError('HOST_TOKEN_INVALID')
    request = urllib.request.Request(url, data=json.dumps(values).encode(), method='POST',
                                     headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    # Pin the LAN destination without changing the host's DNS or routing.
    class PrivateConnection(http.client.HTTPSConnection):
        def connect(self):
            sock = socket.create_connection(('192.168.1.2', 443), timeout=self.timeout)
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
    class PrivateHTTPS(urllib.request.HTTPSHandler):
        def https_open(self, request):
            return self.do_open(PrivateConnection, request, context=self._context)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    opener = urllib.request.build_opener(PrivateHTTPS(context=ssl.create_default_context()), NoRedirect())
    with opener.open(request, timeout=10) as response:
        if response.status != 204:
            raise RuntimeError('HOST_PUBLISH_FAILED')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': 'PVE_HOST_METRICS_FAILED', 'kind': type(error).__name__,
                          'httpStatus': error.code if isinstance(error, urllib.error.HTTPError) else None}))
        raise SystemExit(1)
