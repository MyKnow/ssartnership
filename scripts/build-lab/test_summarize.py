import unittest
from summarize import summarize


class SummaryContract(unittest.TestCase):
    def rows(self):
        return [dict(runId=f'vm2c6g-cold-{i}', sha='a'*40, vmCpus=2, vmMemoryMiB=6144,
                     memoryMiB=5120, cacheMode='cold', stableLabCache=False, seconds=seconds,
                     valid=True, exitCode=0, oomKilled=False, cachePrepareSeconds=0,
                     peakContainerMemoryBytes=100, peakGuestUsedMemoryBytes=200,
                     gate=dict(tests=83, failures=0, errors=0, skipped=0, retries=0,
                               e2eRuntime='production-test-only', fixtureBuildDeployable=False))
                for i, seconds in enumerate((400, 420, 410), 1)]

    def test_reports_median_range_and_memory(self):
        group = summarize(self.rows())[0]
        self.assertTrue(group['complete'])
        self.assertEqual(group['gateSeconds'], {'min': 400, 'median': 410, 'max': 420})
        self.assertEqual(group['maxGuestMemoryBytes'], 200)

    def test_partial_group_is_not_complete(self):
        self.assertFalse(summarize(self.rows()[:2])[0]['complete'])

    def test_duplicate_failed_or_invalid_timing_is_rejected(self):
        rows = self.rows()
        with self.assertRaises(ValueError):
            summarize(rows + [rows[0]])
        for patch in ({'valid': False}, {'seconds': float('nan')}, {'seconds': -1},
                      {'oomKilled': True}, {'exitCode': 1}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                summarize([{**rows[0], **patch}])

    def test_different_sha_or_resources_are_never_pooled(self):
        rows = self.rows()
        rows[1]['sha'] = 'b' * 40
        rows[2]['vmCpus'] = 4
        self.assertEqual(len(summarize(rows)), 3)


if __name__ == '__main__':
    unittest.main()
