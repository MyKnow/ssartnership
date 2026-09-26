"""Bounded, durable-state transition for forward-only lab revision discovery."""
import re
import os
import subprocess


def valid_sha(value):
    return isinstance(value, str) and re.fullmatch(r'[a-f0-9]{40}', value) is not None


def git(repo, *args):
    env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
           'GIT_TERMINAL_PROMPT': '0', 'GIT_NO_REPLACE_OBJECTS': '1'}
    return subprocess.run(['git', '-C', str(repo), '-c', 'core.hooksPath=/dev/null',
                           '-c', 'credential.helper=', *args], env=env,
                          capture_output=True, text=True, check=True, timeout=60).stdout


def ensure_ancestor(repo, revision, tip):
    if not valid_sha(revision) or not valid_sha(tip):
        raise ValueError('Invalid ancestry boundary')
    for sha in (revision, tip):
        if git(repo, 'rev-parse', '--verify', sha + '^{commit}').strip() != sha:
            raise ValueError('Expected commit object')
    try:
        git(repo, 'merge-base', '--is-ancestor', revision, tip)
    except subprocess.CalledProcessError as error:
        if error.returncode == 1:
            raise ValueError('Lab history rewound or diverged') from None
        raise


def discover_revisions(repo, cursor, tip):
    ensure_ancestor(repo, tip if cursor is None else cursor, tip)
    if cursor is None:
        return [tip]
    if cursor == tip:
        return []
    revisions = git(repo, 'rev-list', '--topo-order', '--reverse', '--max-count=65',
                    cursor + '..' + tip).splitlines()
    if len(revisions) > 64:
        raise ValueError('Revision discovery exceeds queue capacity')
    if not revisions or revisions[-1] != tip or any(not valid_sha(sha) for sha in revisions):
        raise ValueError('Incomplete revision history')
    return revisions


def append_revisions(state, revisions, tip):
    pending = state.get('pending', [])
    cursor = state.get('cursor')
    if (not valid_sha(tip) or (cursor is not None and not valid_sha(cursor))
            or not isinstance(pending, list) or not isinstance(revisions, list)
            or any(not valid_sha(item) for item in pending + revisions)):
        raise ValueError('Invalid revision queue')
    if ((not revisions and cursor != tip)
            or (revisions and revisions[-1] != tip)
            or (revisions and cursor == tip)):
        raise ValueError('Incomplete revision discovery')
    combined = pending + revisions
    if len(combined) > 64 or len(set(combined)) != len(combined):
        raise ValueError('Duplicate or overflowing revision queue')
    return {**state, 'pending': combined, 'cursor': tip}
