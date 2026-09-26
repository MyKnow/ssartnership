import contextlib
import io
import fcntl
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import host_controller as host

A, B = 'a' * 40, 'b' * 40

class HostBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.commands = []
        def run(args, timeout=30):
            self.commands.append(args)
            if args == ['hostname', '-s']:
                return 'myknow-pve\n'
            if args == ['qm', 'status', '4970']:
                return 'status: running\n'
            raise AssertionError('Unexpected command: ' + repr(args))
        for context in (patch.object(host, 'STATE_ROOT', self.root), patch.object(host.os, 'getuid', return_value=0), patch.object(host.os, 'umask', return_value=0o22), patch.object(host, 'run', side_effect=run), patch.object(host.time, 'time', return_value=1000)):
            context.start()
            self.addCleanup(context.stop)
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

    def test_host_resource_matrix_lock_prevents_actions(self):
        with (self.root / 'resource-matrix.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(host, 'observe_sha', return_value=A) as observe, patch.object(host, 'guest', return_value={'busy': False}):
                host.tick()
                observe.assert_not_called()

    def test_observation_failure_cannot_mutate_vm(self):
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', side_effect=RuntimeError('offline')):
            with self.assertRaises(RuntimeError):
                host.tick()
        self.assertEqual(self.commands, [['hostname', '-s'], ['qm', 'status', '4970']])

    def test_new_push_during_shutdown_check_prevents_shutdown(self):
        (self.root / 'state.json').write_text(json.dumps({'lastAttempt': A, 'deploymentAttempt': A, 'idleSince': 50}))
        with patch.object(host, 'observe_sha', side_effect=[A, B]), patch.object(host, 'guest', return_value={'busy': False}):
            host.tick()
        self.assertFalse(any('shutdown' in command for command in self.commands))

    def test_failed_build_is_not_delivered_or_retried(self):
        (self.root / 'state.json').write_text(json.dumps({'lastAttempt': A}))
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', side_effect=[{'busy': False}, {'status': 'failed', 'sha': A}]):
            host.tick()
        state = json.loads((self.root / 'state.json').read_text())
        self.assertEqual(state['deploymentAttempt'], A)
        self.assertEqual(state['deploymentStatus'], 'build-failed')
        self.assertFalse(any('deliver_preview.py' in str(command) for command in self.commands))

    def test_mismatched_artifact_cannot_start_deployment(self):
        (self.root / 'state.json').write_text(json.dumps({'lastAttempt': A}))
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', side_effect=[{'busy': False}, {'status': 'ready', 'artifact': {'sha': B}}]):
            with self.assertRaises(ValueError):
                host.tick()
        self.assertFalse(any('deliver_preview.py' in str(command) for command in self.commands))

    def test_deployment_attempt_is_persisted_before_delivery(self):
        (self.root / 'state.json').write_text(json.dumps({'lastAttempt': A}))
        artifact = {'sha': A, 'image': 'ssartnership-lab-app:' + A, 'archiveSha256': 'b' * 64, 'startedAt': 1, 'finishedAt': 2, 'packagingSeconds': 0.5, 'deployed': False}
        ordinary_run = host.run
        def with_delivery(args, timeout=30):
            if args[0] == '/usr/bin/python3':
                persisted = json.loads((self.root / 'state.json').read_text())
                self.assertEqual(persisted['deploymentAttempt'], A)
                self.assertEqual(args, ['/usr/bin/python3', '/usr/local/lib/build-lab-497/deliver_preview.py', A])
                return json.dumps({'sha': A, 'deployed': True, 'preview': {'readyAt': 1001}})
            return ordinary_run(args, timeout=timeout)
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', side_effect=[{'busy': False}, {'status': 'ready', 'artifact': artifact}]), patch.object(host, 'run', side_effect=with_delivery):
            host.tick()
        self.assertEqual(json.loads((self.root / 'state.json').read_text())['deploymentStatus'], 'ready')
        events = [json.loads(line)['event'] for line in (self.root / 'events' / (A + '.jsonl')).read_text().splitlines()]
        self.assertEqual(events, ['observed', 'deployment-started', 'ready'])
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', return_value={'busy': False}) as guest:
            host.tick()
        guest.assert_called_once_with('status')

    def test_active_guest_job_is_preserved(self):
        with patch.object(host, 'observe_sha', return_value=A), patch.object(host, 'guest', return_value={'busy': True}) as guest:
            host.tick()
        guest.assert_called_once_with('status')
        self.assertFalse(any('start' in command for command in self.commands))
