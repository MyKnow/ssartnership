#!/usr/bin/env python3
"""Summarize verified measurements without mixing commit/resource/cache cases."""
from collections import defaultdict
import json
import math
from pathlib import Path
import re
import statistics
import sys
from benchmark import validate_gate


def summarize(records):
    groups = defaultdict(list)
    seen = set()
    for row in records:
        name = row['runId']
        if name in seen:
            raise ValueError('Duplicate measurement')
        seen.add(name)
        if row.get('valid') is not True or row.get('exitCode') != 0 or row.get('oomKilled') is not False:
            raise ValueError('Failed measurement must be reviewed separately')
        validate_gate(row['gate'])
        if not re.fullmatch(r'[a-f0-9]{40}', row['sha']) or row['cacheMode'] not in ('cold', 'warm'):
            raise ValueError('Invalid measurement identity')
        for field in ('seconds', 'cachePrepareSeconds', 'peakContainerMemoryBytes', 'peakGuestUsedMemoryBytes'):
            value = row[field]
            if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError('Invalid measurement value')
        key = (row['sha'], row['vmCpus'], row['vmMemoryMiB'], row['memoryMiB'],
               row['cacheMode'], bool(row.get('stableLabCache', False)), row.get('matrixProfile', 'cpu'))
        groups[key].append(row)
    output = []
    for key, rows in sorted(groups.items()):
        sha, cpus, vm_memory, container_memory, cache, stable, profile = key
        seconds = [row['seconds'] for row in rows]
        output.append({'sha': sha, 'vmCpus': cpus, 'vmMemoryMiB': vm_memory,
                       'containerMemoryMiB': container_memory, 'cacheMode': cache,
                       'stableLabCache': stable, 'matrixProfile': profile, 'count': len(rows),
                       'complete': len(rows) >= 3, 'runIds': sorted(row['runId'] for row in rows),
                       'gateSeconds': {'min': min(seconds), 'median': statistics.median(seconds), 'max': max(seconds)},
                       'cachePrepareMedianSeconds': statistics.median(row['cachePrepareSeconds'] for row in rows),
                       'maxContainerMemoryBytes': max(row['peakContainerMemoryBytes'] for row in rows),
                       'maxGuestMemoryBytes': max(row['peakGuestUsedMemoryBytes'] for row in rows)})
    return output


if __name__ == '__main__':
    records = json.loads(Path(sys.argv[1]).read_text())
    print(json.dumps(summarize(records), indent=2))
