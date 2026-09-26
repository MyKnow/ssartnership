#!/usr/bin/env python3
"""Decision contract for the dedicated public-branch lab controller.

No production refs, secrets, or arbitrary VM targets are accepted. Execution
adapter must reobserve guest jobs immediately before shutdown or dispatch.
"""
import re

BRANCH_REF = 'refs/heads/ci/497-pve-build-lab'
BUILD_VMID = 4970
IDLE_SECONDS = 900


def parse_remote_sha(text):
    lines = text.strip().splitlines()
    if len(lines) != 1:
        raise ValueError('Expected one branch reference')
    fields = lines[0].split()
    if len(fields) != 2 or fields[1] != BRANCH_REF or not re.fullmatch(r'[a-f0-9]{40}', fields[0]):
        raise ValueError('Unexpected branch reference')
    return fields[0]


def decision(sha, state, running, busy, now):
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid SHA')
    pending = state.get('pending', [])
    if (not isinstance(pending, list) or len(pending) > 64
            or any(not isinstance(item, str) or not re.fullmatch(r'[a-f0-9]{40}', item) for item in pending)
            or len(set(pending)) != len(pending)):
        raise ValueError('Invalid pending queue')
    if busy:
        return {'action': 'wait', 'sha': sha}
    if pending:
        return {'action': 'dispatch' if running else 'start', 'sha': pending[0]}
    if sha != state.get('lastAttempt'):
        return {'action': 'dispatch' if running else 'start', 'sha': sha}
    if not running:
        return {'action': 'idle', 'sha': sha}
    idle_since = state.get('idleSince')
    if isinstance(idle_since, (int, float)) and now >= idle_since + IDLE_SECONDS:
        return {'action': 'shutdown', 'sha': sha}
    return {'action': 'idle', 'sha': sha}
