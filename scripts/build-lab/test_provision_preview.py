import unittest
from unittest.mock import patch
import provision_preview as provision
import copy
import json
from pathlib import Path
import tempfile


class NetworkBoundary(unittest.TestCase):
    def setUp(self):
        self.config = {
            'name': 'ssartnership-lab-497',
            'services': {name: {} for name in ('db', 'rest', 'storage', 'gateway')},
            'networks': {'default': {'internal': True}, 'edge': {'internal': True}},
        }

    def test_isolated_database_is_accepted(self):
        provision.validate_config(self.config)

    def test_egress_and_published_listeners_are_rejected(self):
        for change in ('missing-networks', 'external-network', 'ports', 'host-network', 'extra-service', 'wrong-project'):
            config = copy.deepcopy(self.config)
            if change == 'missing-networks':
                config['networks'] = {}
            elif change == 'external-network':
                config['networks']['edge']['internal'] = False
            elif change == 'ports':
                config['services']['gateway']['ports'] = [{'published': '54321', 'target': 8000}]
            elif change == 'host-network':
                config['services']['gateway']['network_mode'] = 'host'
            elif change == 'extra-service':
                config['services']['mailer'] = {}
            else:
                config['name'] = 'production'
            with self.subTest(change=change), self.assertRaises(ValueError):
                provision.validate_config(config)

class ProvisionBoundary(unittest.TestCase):
    def test_missing_seed_prevents_any_initialization(self):
        config = {'name': provision.PROJECT,
                  'services': {name: {} for name in ('db', 'rest', 'storage', 'gateway')},
                  'networks': {'default': {'internal': True}}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(provision, 'ROOT', root), patch.object(provision.os, 'getuid', return_value=0), patch.object(provision.os, 'umask'), patch.object(provision, 'run', side_effect=['ssartnership-preview-lab\n', '', json.dumps(config)]) as run:
                with self.assertRaisesRegex(ValueError, 'seed file'):
                    provision.main()
            self.assertEqual(run.call_count, 3)
            self.assertEqual(list(root.iterdir()), [])

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
