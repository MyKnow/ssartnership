import unittest
from unittest.mock import patch
import provision_preview as provision

class ProvisionBoundary(unittest.TestCase):
    def test_wrong_host_cannot_touch_database(self):
        with patch.object(provision.os, 'getuid', return_value=0), patch.object(provision, 'run', return_value='myknow-pve\n') as run:
            with self.assertRaises(RuntimeError):
                provision.main()
        run.assert_called_once_with(['hostname', '-s'])

    def test_existing_stack_is_preserved(self):
        with patch.object(provision.os, 'getuid', return_value=0), patch.object(provision.os, 'umask'), patch.object(provision, 'run', side_effect=['ssartnership-preview-lab\n', 'existing-container\n']) as run:
            with self.assertRaises(RuntimeError):
                provision.main()
        self.assertEqual(run.call_count, 2)
        self.assertEqual(run.call_args.args[0], ['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=ssartnership-lab-497'])

if __name__ == '__main__':
    unittest.main()
