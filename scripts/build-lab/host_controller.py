#!/usr/bin/env python3
"""Host-side adapter. Install only reviewed controller code, never branch code."""
import json
import os
from pathlib import Path
import subprocess
import time
import fcntl
import re
from controller import BRANCH_REF, BUILD_VMID, decision, parse_remote_sha
from artifact import validate_artifact
from revision_queue import append_revisions, discover_revisions, git

REPOSITORY = 'https://github.com/MyKnow/ssartnership.git'
STATE_ROOT = Path('/var/lib/build-lab-497')
AGENT = '/usr/local/lib/build-lab-497/guest_agent.py'


def run(args, timeout=30):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=timeout).stdout


def observe_sha():
    output = run(['git', '-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', 'ls-remote', '--exit-code', REPOSITORY, BRANCH_REF])
    return parse_remote_sha(output)


def collect_revisions(state, tip):
    cursor = state.get('cursor', state.get('lastAttempt'))
    state = {**state, 'cursor': cursor}
    if cursor == tip:
        return append_revisions(state, [], tip)
    repo = STATE_ROOT / 'history.git'
    if repo.is_symlink():
        raise ValueError('Unexpected history path')
    if not repo.exists():
        run(['git', 'init', '--quiet', '--bare', str(repo)])
    git(repo, 'fetch', '--no-tags', REPOSITORY, BRANCH_REF)
    fetched_tip = git(repo, 'rev-parse', 'FETCH_HEAD').strip()
    if fetched_tip != tip:
        raise RuntimeError('Branch advanced during observation; preserve cursor for next tick')
    revisions = discover_revisions(repo, cursor, tip)
    return append_revisions(state, revisions, tip)


def guest(*args):
    envelope = json.loads(run(['qm', 'guest', 'exec', str(BUILD_VMID), '--timeout', '30', '--', '/usr/bin/python3', AGENT, *args], timeout=40))
    if envelope.get('exited') != 1 or envelope.get('exitcode') != 0 or envelope.get('out-truncated'):
        raise RuntimeError('Guest command did not complete cleanly')
    return json.loads(envelope['out-data'])


def save(state):
    tmp = STATE_ROOT / 'state.pending'
    tmp.write_text(json.dumps(state) + '\n')
    tmp.replace(STATE_ROOT / 'state.json')


def record_event(sha, event):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or event not in (
            'observed', 'boot-requested', 'dispatch-requested', 'dispatched', 'build-failed',
            'deployment-started', 'deployment-failed', 'ready', 'shutdown-requested'):
        raise ValueError('Invalid timeline event')
    directory = STATE_ROOT / 'events'
    directory.mkdir(mode=0o700, exist_ok=True)
    with (directory / (sha + '.jsonl')).open('a') as handle:
        handle.write(json.dumps({'sha': sha, 'event': event, 'at': time.time()}) + '\n')


def tick():
    if os.getuid() != 0 or run(['hostname', '-s']).strip() != 'myknow-pve':
        raise RuntimeError('Wrong execution host')
    os.umask(0o077)
    STATE_ROOT.mkdir(mode=0o700, exist_ok=True)
    with (STATE_ROOT / 'resource-matrix.lock').open('a') as resource_lock, (STATE_ROOT / 'controller.lock').open('w') as lock:
        try:
            fcntl.flock(resource_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('{"action":"wait-resource-matrix"}', flush=True)
            return
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state_file = STATE_ROOT / 'state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        sha = observe_sha()
        state = collect_revisions(state, sha)
        save(state)
        status = run(['qm', 'status', str(BUILD_VMID)]).strip()
        if status not in ('status: running', 'status: stopped'):
            raise RuntimeError('Unknown VM state')
        running = status == 'status: running'
        observation = guest('status') if running else {'busy': False}
        if type(observation.get('busy')) is not bool:
            raise RuntimeError('Invalid guest observation')
        now = time.time()
        if state.get('observedSha') != sha:
            state.update(observedSha=sha, observedAt=now)
            record_event(sha, 'observed')
        if observation['busy']:
            state.pop('idleSince', None)
        elif running:
            state.setdefault('idleSince', now)
        completed_sha = state.get('lastAttempt')
        if running and not observation['busy'] and completed_sha and completed_sha != state.get('deploymentAttempt'):
            result = guest('result', completed_sha)
            if result.get('status') == 'failed' and result.get('sha') == completed_sha:
                state.update(deploymentAttempt=completed_sha, deploymentStatus='build-failed')
                record_event(completed_sha, 'build-failed')
            elif result.get('status') == 'ready':
                validate_artifact(result['artifact'], completed_sha)
                # Persist before the external effect: failures require diagnosis,
                # rather than an automatic retry every timer tick.
                state.update(deploymentAttempt=completed_sha, deploymentStatus='started')
                save(state)
                record_event(completed_sha, 'deployment-started')
                try:
                    delivered = json.loads(run(['/usr/bin/python3', '/usr/local/lib/build-lab-497/deliver_preview.py', completed_sha], timeout=1200))
                    if delivered.get('sha') != completed_sha or delivered.get('deployed') is not True:
                        raise ValueError('Deployment identity mismatch')
                    state.update(deploymentStatus='ready', readyAt=delivered['preview']['readyAt'], idleSince=time.time())
                    record_event(completed_sha, 'ready')
                except Exception:
                    state['deploymentStatus'] = 'failed'
                    record_event(completed_sha, 'deployment-failed')
                    save(state)
                    raise
                save(state)
                print(json.dumps({'action': 'deployed', 'sha': completed_sha, 'at': time.time()}), flush=True)
                return
            else:
                raise RuntimeError('Unexpected completed-build observation')
        selected = decision(sha, state, running, observation['busy'], now)
        action, target_sha = selected['action'], selected['sha']
        if action == 'start':
            run(['/usr/local/sbin/build-lab-497-network'])
            record_event(target_sha, 'boot-requested')
            run(['qm', 'start', str(BUILD_VMID)], timeout=90)
            state['bootRequestedAt'] = now
        elif action == 'dispatch':
            # Refresh both boundaries immediately before dispatch.
            if observe_sha() != sha or guest('status')['busy']:
                action = 'wait'
            else:
                state.update(lastAttempt=target_sha, dispatchStatus='requested', dispatchRequestedAt=time.time())
                if state.get('pending'):
                    if state['pending'][0] != target_sha:
                        raise RuntimeError('Queue dispatch mismatch')
                    state['pending'] = state['pending'][1:]
                # An ambiguous guest response must never cause a second launch.
                # Reconcile the recorded SHA's guest result on the next tick.
                save(state)
                record_event(target_sha, 'dispatch-requested')
                launched = guest('launch', target_sha)
                if launched.get('acceptedSha') != target_sha:
                    raise RuntimeError('Dispatch identity mismatch')
                state.update(dispatchStatus='accepted', dispatchedAt=time.time())
                record_event(target_sha, 'dispatched')
                state.pop('idleSince', None)
        elif action == 'shutdown':
            if observe_sha() != sha or guest('status')['busy']:
                action = 'wait'
            else:
                record_event(sha, 'shutdown-requested')
                run(['qm', 'shutdown', str(BUILD_VMID), '--timeout', '120'], timeout=130)
                state['shutdownRequestedAt'] = now
        save(state)
        print(json.dumps({'action': action, 'sha': target_sha, 'at': now}), flush=True)


if __name__ == '__main__':
    try:
        tick()
    except Exception:
        # No raw subprocess/guest text in privileged controller logs.
        print('{"error":"LAB_CONTROLLER_OBSERVATION_OR_ACTION_FAILED"}', flush=True)
        raise SystemExit(1)
