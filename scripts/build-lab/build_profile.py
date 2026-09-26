"""Root-selected resource and cache settings; branch content cannot select them."""
import json
import os
from pathlib import Path


def validate_profile(value):
    if not isinstance(value, dict) or set(value) != {'cpus', 'vmMemoryMiB', 'containerMemoryMiB', 'stableLabCache', 'reuseCache'}:
        raise ValueError('Invalid lab profile fields')
    for name, choices in [('cpus', (2, 4, 8)), ('vmMemoryMiB', (6144, 8192)), ('containerMemoryMiB', (4096, 5120, 6144))]:
        if type(value[name]) is not int or value[name] not in choices:
            raise ValueError('Invalid lab resource profile')
    if value['containerMemoryMiB'] >= value['vmMemoryMiB']:
        raise ValueError('Guest overhead must remain available')
    if any(type(value[key]) is not bool for key in ('stableLabCache', 'reuseCache')):
        raise ValueError('Invalid cache policy')
    return dict(value)


def load_profile(path=Path('/etc/build-lab-497/profile.json')):
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_uid != 0 or stat.st_mode & 0o022 or stat.st_size > 4096:
        raise ValueError('Untrusted lab profile')
    profile = validate_profile(json.loads(path.read_text()))
    memory = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:'))) / 1024
    if os.cpu_count() != profile['cpus'] or not profile['vmMemoryMiB'] - 512 <= memory <= profile['vmMemoryMiB']:
        raise ValueError('Guest allocation differs from selected profile')
    return profile
