#!/usr/bin/env python3
"""Release generated workspaces only after a successful cold/warm pair."""
import json
from pathlib import Path
import re
import shutil
import sys


def cleanup(name, base=Path('/home/builder/build-lab/runs')):
    match = re.fullmatch(r'(vm[248]c6g)-(cold|warm)-([123])', name)
    if not match:
        raise ValueError('Unexpected cleanup target')
    for mode in ('cold', 'warm'):
        partner = f'{match[1]}-{mode}-{match[3]}'
        folder = base / partner
        if folder.resolve() != folder:
            raise ValueError('Unexpected run directory')
        result = json.loads((folder / 'result.json').read_text())
        if result.get('valid') is not True or result.get('runId') != partner:
            raise ValueError('Both runs must be verified')
    root = base / name
    work = root / 'work'
    if work.resolve() != work or not work.is_dir():
        raise ValueError('Unexpected workspace')
    gate = work / '.self-host-build/gate.json'
    if not gate.is_file() or not (root / 'phases.json').is_file():
        raise ValueError('Evidence missing')
    shutil.copy2(gate, root / 'validated-gate.json')
    shutil.rmtree(work)
    return {'workspaceReleased': name}


if __name__ == '__main__':
    print(json.dumps(cleanup(sys.argv[1])))
