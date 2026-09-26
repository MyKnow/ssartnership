import unittest
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import timed_git
from timed_git import validate_push


class PushBoundary(unittest.TestCase):
    def test_failed_push_retains_first_attempt_and_cannot_be_overwritten(self):
        sha = 'a' * 40
        with tempfile.TemporaryDirectory() as directory:
            metadata = [timed_git.BRANCH, timed_git.REMOTE, sha, directory]
            argv = ['git', 'push', '--no-verify', 'origin', timed_git.BRANCH]
            with patch.object(timed_git.sys, 'argv', argv), patch.object(timed_git, 'capture', side_effect=metadata), patch.object(timed_git.subprocess, 'run') as run:
                run.return_value.returncode = 1
                self.assertEqual(timed_git.main(), 1)
                run.assert_called_once_with([timed_git.GIT, *argv[1:]])
            evidence = Path(directory) / '.tmp/build-lab/push-events' / (sha + '.json')
            original = evidence.read_bytes()
            result = json.loads(original)
            self.assertEqual(result['sha'], sha)
            self.assertEqual(result['exitCode'], 1)
            self.assertGreaterEqual(result['pushFinishedAt'], result['pushStartedAt'])
            self.assertGreaterEqual(result['pushSeconds'], 0)
            with patch.object(timed_git.sys, 'argv', argv), patch.object(timed_git, 'capture', side_effect=metadata), patch.object(timed_git.subprocess, 'run') as run:
                with self.assertRaises(FileExistsError):
                    timed_git.main()
                run.assert_not_called()
            self.assertEqual(evidence.read_bytes(), original)

    def test_canonical_lab_push(self):
        validate_push(['push', '--no-verify', 'origin', 'ci/497-pve-build-lab'],
                      'ci/497-pve-build-lab', 'https://github.com/MyKnow/ssartnership.git')

    def test_other_targets_and_extra_options_rejected(self):
        valid = ['push', '--no-verify', 'origin', 'ci/497-pve-build-lab']
        for args, branch, remote in (
            (valid + ['--force'], 'ci/497-pve-build-lab', 'https://github.com/MyKnow/ssartnership.git'),
            (valid, 'main', 'https://github.com/MyKnow/ssartnership.git'),
            (['push', 'origin', 'main'], 'ci/497-pve-build-lab', 'https://github.com/MyKnow/ssartnership.git'),
            (valid, 'ci/497-pve-build-lab', 'https://example.com/other.git'),
        ):
            with self.subTest(args=args, branch=branch, remote=remote), self.assertRaises(ValueError):
                validate_push(args, branch, remote)


if __name__ == '__main__':
    unittest.main()
