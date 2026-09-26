import subprocess
import unittest
from unittest.mock import Mock, patch
from ephemeral_transfer import EphemeralTransfer


class TransferLifetime(unittest.TestCase):
    def test_wrong_host_cannot_start_agent(self):
        with patch('ephemeral_transfer.os.getuid', return_value=0), patch('ephemeral_transfer.socket.gethostname', return_value='production'), patch('ephemeral_transfer.subprocess.Popen') as start:
            with self.assertRaises(RuntimeError):
                EphemeralTransfer().__enter__()
            start.assert_not_called()

    def test_exit_terminates_agent_and_removes_public_files(self):
        transfer = EphemeralTransfer()
        transfer.agent = Mock()
        transfer.agent.poll.return_value = None
        transfer.directory = Mock()
        transfer.__exit__(RuntimeError, RuntimeError(), None)
        transfer.agent.terminate.assert_called_once()
        transfer.agent.wait.assert_called_once_with(timeout=5)
        transfer.directory.cleanup.assert_called_once()

    def test_unresponsive_agent_is_killed(self):
        transfer = EphemeralTransfer()
        transfer.agent = Mock()
        transfer.agent.poll.return_value = None
        transfer.agent.wait.side_effect = [subprocess.TimeoutExpired('ssh-agent', 5), 0]
        transfer.directory = Mock()
        transfer.__exit__(None, None, None)
        transfer.agent.kill.assert_called_once()
        transfer.directory.cleanup.assert_called_once()

    def test_non_lab_guest_never_receives_key(self):
        with patch('ephemeral_transfer.subprocess.run') as run:
            with self.assertRaises(ValueError):
                EphemeralTransfer().prepare('100')
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
