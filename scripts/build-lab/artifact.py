"""Allowlisted public artifact receipt crossing the guest/host boundary."""
import math
import re


def validate_artifact(value, sha):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or value.get('sha') != sha:
        raise ValueError('Artifact commit mismatch')
    if value.get('image') != 'ssartnership-lab-app:' + sha or value.get('deployed') is not False:
        raise ValueError('Artifact target mismatch')
    if not isinstance(value.get('archiveSha256'), str) or not re.fullmatch(r'[a-f0-9]{64}', value['archiveSha256']):
        raise ValueError('Invalid artifact checksum')
    for field in ('startedAt', 'finishedAt', 'packagingSeconds'):
        item = value.get(field)
        if type(item) not in (int, float) or not math.isfinite(item) or item < 0:
            raise ValueError('Invalid artifact timing')
    if value['finishedAt'] < value['startedAt']:
        raise ValueError('Invalid artifact order')
    return {key: value[key] for key in ('sha', 'image', 'archiveSha256', 'startedAt', 'finishedAt', 'packagingSeconds', 'deployed')}
