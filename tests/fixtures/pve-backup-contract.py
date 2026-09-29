import copy
import datetime
import importlib.util
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', sys.argv.pop(1))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class BackupBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.receipt = dict(version=1, id='12345678-1234-4234-8234-123456789abc',
            sha256='a'*64, recipient='age1'+'q'*58, bytes=2048,
            createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),
            databaseSystemId='123456789', continuousPitr=False)

    def test_valid_receipt(self):
        self.assertEqual(backup.validate_receipt(self.receipt), self.receipt)

    def test_untrusted_metadata(self):
        for key, value in [('version', True), ('bytes', True), ('bytes', 1),
            ('bytes', 21*1024**3), ('id', '../../root'), ('sha256', 'z'*64),
            ('continuousPitr', True), ('createdAt', '2099-09-29T13:50:00.000Z'),
            ('createdAt', '2026-02-30T00:00:00.000Z'),
            ('databaseSystemId', '1;touch'), ('recipient', 'invalid')]:
            with self.subTest(key=key, value=value):
                bad = copy.deepcopy(self.receipt)
                bad[key] = value
                with self.assertRaises(ValueError): backup.validate_receipt(bad)
        with self.assertRaises(ValueError): backup.validate_receipt({**self.receipt, 'path':'/etc/shadow'})

    def test_absent_mount_never_reaches_network_or_creates_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backup, 'ROOT', pathlib.Path(directory)), patch.object(backup.os, 'geteuid', return_value=0), patch.object(backup.subprocess, 'run') as network:
                with self.assertRaises(ValueError): backup.main()
                network.assert_not_called()
                self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_wrong_disk_uuid_stops_before_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root/'config.json').write_text('{"filesystemUuid":"00000000-0000-0000-0000-000000000000"}')
            with patch.object(backup, 'ROOT', root), patch.object(backup, 'SECRETS', root), patch.object(backup.os, 'geteuid', return_value=0), patch.object(pathlib.Path, 'is_mount', return_value=True), patch.object(backup, 'private_path'), patch.object(backup.subprocess, 'check_output', return_value='different'), patch.object(backup.subprocess, 'run') as network:
                with self.assertRaises(ValueError): backup.main()
                network.assert_not_called()
                self.assertFalse((root/'production').exists())

    def test_symlink_never_passes_private_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            (root/'real').write_text('x')
            (root/'link').symlink_to(root/'real')
            with self.assertRaises(ValueError): backup.private_path(root/'link')

if __name__ == '__main__': unittest.main()
