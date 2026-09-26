import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from cleanup_run import cleanup

class CleanupContract(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        for mode in ('cold', 'warm'):
            name = f'vm2c6g-{mode}-1'
            root = self.base / name
            (root / 'work/.self-host-build').mkdir(parents=True)
            (root / 'work/.self-host-build/gate.json').write_text('{"tests":83}')
            (root / 'result.json').write_text(json.dumps({'valid': True, 'runId': name}))
            (root / 'phases.json').write_text('[]')
            (root / 'gate.log').write_text('retained log')

    def test_preserves_evidence_and_other_runs(self):
        cleanup('vm2c6g-cold-1', self.base)
        root = self.base / 'vm2c6g-cold-1'
        self.assertFalse((root / 'work').exists())
        self.assertTrue((root / 'validated-gate.json').exists())
        self.assertTrue((root / 'gate.log').exists())
        self.assertTrue((self.base / 'vm2c6g-warm-1/work').exists())

    def test_requires_successful_pair(self):
        (self.base / 'vm2c6g-warm-1/result.json').write_text('{"valid":false}')
        with self.assertRaises(ValueError):
            cleanup('vm2c6g-cold-1', self.base)
        self.assertTrue((self.base / 'vm2c6g-cold-1/work').exists())

    def test_ram_pair_preserves_evidence(self):
        for mode in ('cold', 'warm'):
            name = f'ram-vm4c8g-{mode}-1'
            root = self.base / name
            (self.base / f'vm2c6g-{mode}-1').rename(root)
            (root / 'result.json').write_text(json.dumps({'valid': True, 'runId': name}))
        cleanup('ram-vm4c8g-cold-1', self.base)
        self.assertTrue((self.base / 'ram-vm4c8g-cold-1/validated-gate.json').exists())
        self.assertTrue((self.base / 'ram-vm4c8g-warm-1/work').exists())

    def test_rejects_unrelated_path(self):
        for name in ('../other', 'request-' + 'a'*40, 'vm2c6g-cold-9'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                cleanup(name, self.base)
