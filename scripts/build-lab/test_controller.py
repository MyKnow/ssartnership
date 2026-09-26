import unittest
from controller import decision, parse_remote_sha

A = 'a' * 40
B = 'b' * 40

class ControllerContract(unittest.TestCase):
    def test_only_exact_branch_ref_is_accepted(self):
        self.assertEqual(parse_remote_sha(A + '\trefs/heads/ci/497-pve-build-lab\n'), A)
        for text in (A + '\trefs/heads/main\n', 'HEAD', A + '\trefs/heads/ci/497-pve-build-lab\n' + B + '\trefs/heads/ci/497-pve-build-lab\n'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_remote_sha(text)

    def test_new_push_starts_stopped_vm(self):
        self.assertEqual(decision(A, {}, False, False, 1000)['action'], 'start')

    def test_active_benchmark_is_never_interrupted(self):
        self.assertEqual(decision(B, {'lastAttempt': A}, True, True, 1000)['action'], 'wait')

    def test_failure_is_not_retried_on_same_sha(self):
        self.assertEqual(decision(A, {'lastAttempt': A, 'idleSince': 800}, True, False, 1000)['action'], 'idle')

    def test_shutdown_requires_no_new_work_and_idle_timeout(self):
        state = {'lastAttempt': A, 'idleSince': 100}
        self.assertEqual(decision(A, state, True, False, 1000)['action'], 'shutdown')
        self.assertEqual(decision(B, state, True, False, 1000)['action'], 'dispatch')

    def test_missing_observation_cannot_trigger_shutdown(self):
        self.assertEqual(decision(A, {'lastAttempt': A}, True, False, 1000)['action'], 'idle')

    def test_pending_request_precedes_latest_tip_and_idle_shutdown(self):
        state = {'lastAttempt': B, 'idleSince': 1, 'pending': [A]}
        self.assertEqual(decision(B, state, True, False, 1000), {'action': 'dispatch', 'sha': A})
        self.assertEqual(decision(B, state, False, False, 1000), {'action': 'start', 'sha': A})

    def test_pending_request_does_not_interrupt_active_job(self):
        self.assertEqual(decision(B, {'pending': [A]}, True, True, 1000)['action'], 'wait')

    def test_invalid_queue_is_rejected_before_actions(self):
        for pending in ('bad', ['main'], [A, A], [None]):
            with self.subTest(pending=pending), self.assertRaises(ValueError):
                decision(B, {'pending': pending}, True, False, 1000)

if __name__ == '__main__':
    unittest.main()
