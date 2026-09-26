import unittest
import subprocess
from tempfile import TemporaryDirectory
from revision_queue import append_revisions, discover_revisions, ensure_ancestor

A, B, C = ('a' * 40, 'b' * 40, 'c' * 40)


class RevisionQueueContract(unittest.TestCase):
    def test_preserves_intermediate_revisions_and_input(self):
        state = {'pending': [A], 'cursor': A}
        updated = append_revisions(state, [B, C], C)
        self.assertEqual(updated['pending'], [A, B, C])
        self.assertEqual(updated['cursor'], C)
        self.assertEqual(state, {'pending': [A], 'cursor': A})

    def test_repeated_observation_is_idempotent(self):
        state = {'pending': [A, B], 'cursor': B}
        self.assertEqual(append_revisions(state, [], B), state)

    def test_missing_tip_and_duplicates_fail_without_advancing_cursor(self):
        for revisions in ([B], [B, B, C], ['main', C], []):
            state = {'pending': [A], 'cursor': A}
            with self.subTest(revisions=revisions), self.assertRaises(ValueError):
                append_revisions(state, revisions, C)
            self.assertEqual(state['cursor'], A)

    def test_overflow_is_not_silent_truncation(self):
        state = {'pending': [format(i, '040x') for i in range(64)], 'cursor': A}
        with self.assertRaises(ValueError):
            append_revisions(state, [C], C)
        self.assertEqual(len(state['pending']), 64)


class GitHistoryContract(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = self.tmp.name
        self.git('init', '--quiet')
        self.commits = []
        for message in ('base', 'push-one', 'push-two'):
            self.git('-c', 'user.name=Lab Test', '-c', 'user.email=lab@example.invalid',
                     'commit', '--quiet', '--allow-empty', '-m', message)
            self.commits.append(self.git('rev-parse', 'HEAD').strip())

    def git(self, *args):
        return subprocess.run(['git', '-C', self.repo, '-c', 'core.hooksPath=/dev/null', *args],
                              capture_output=True, text=True, check=True).stdout

    def test_two_push_tips_between_polls_are_preserved(self):
        self.assertEqual(discover_revisions(self.repo, self.commits[0], self.commits[2]), self.commits[1:])

    def test_rewind_and_unknown_revision_fail_closed(self):
        with self.assertRaises(ValueError):
            discover_revisions(self.repo, self.commits[2], self.commits[0])
        with self.assertRaises((ValueError, subprocess.CalledProcessError)):
            ensure_ancestor(self.repo, A, self.commits[2])

    def test_queued_ancestor_remains_buildable_after_tip_advances(self):
        ensure_ancestor(self.repo, self.commits[1], self.commits[2])
