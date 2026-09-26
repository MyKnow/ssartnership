import unittest
from benchmark import validate_gate, cache_sources, build_cache_context
from pathlib import Path
from tempfile import TemporaryDirectory
import json

class GateContract(unittest.TestCase):
    def setUp(self):
        self.clean = dict(tests=83, failures=0, errors=0, skipped=0, retries=0, e2eRuntime='production-test-only', fixtureBuildDeployable=False)

    def test_exact_inventory_passes(self):
        self.assertEqual(validate_gate(self.clean)['tests'], 83)

    def test_incomplete_or_retried_gate_is_rejected(self):
        for field in ('failures', 'errors', 'skipped', 'retries'):
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_gate({**self.clean, field: 1})
        for count in (0, 82, 84):
            with self.subTest(count=count), self.assertRaises(ValueError):
                validate_gate({**self.clean, 'tests': count})

    def test_cache_rejects_traversal_and_unverified_run(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            with self.assertRaises(ValueError):
                cache_sources(root, '../escape')
            run = root / 'runs' / 'failed-source'
            run.mkdir(parents=True)
            (run / 'result.json').write_text(json.dumps({'valid': False}))
            with self.assertRaises(ValueError):
                cache_sources(root, 'failed-source')

    def test_fixture_cannot_become_deployable(self):
        for change in ({'fixtureBuildDeployable': True}, {'e2eRuntime': 'development'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_gate({**self.clean, **change})

    def test_cross_commit_cache_requires_explicit_matching_context(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            run = root / 'runs/request-source'
            for name in ('.tmp/install-state/cache', '.next/cache', '.next-e2e/cache'):
                (run / 'work' / name).mkdir(parents=True)
            (run / 'result.json').write_text(json.dumps({'valid': True, 'sha': 'a'*40,
                'gate': self.clean, 'cacheContext': 'b'*64, 'runId': 'request-source'}))
            with self.assertRaises(ValueError):
                cache_sources(root, 'request-source', context='b'*64)
            self.assertEqual(cache_sources(root, 'request-source', context='b'*64, cross_sha=True), run / 'work')
            with self.assertRaises(ValueError):
                cache_sources(root, 'request-source', context='c'*64, cross_sha=True)
            with self.assertRaises(ValueError):
                cache_sources(root, 'request-source', cross_sha=True)

    def test_cache_context_changes_with_lock_config_or_toolchain(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            files = ('package-lock.json', 'next.config.ts', '.npmrc', '.node-version')
            for name in files:
                (root / name).write_text('baseline')
            image = 'sha256:' + 'a'*64
            original = build_cache_context(root, image)
            for name in files:
                (root / name).write_text('changed')
                self.assertNotEqual(build_cache_context(root, image), original)
                (root / name).write_text('baseline')
            self.assertNotEqual(build_cache_context(root, 'sha256:' + 'b'*64), original)

if __name__ == '__main__':
    unittest.main()
