import unittest
from artifact import validate_artifact

SHA = 'a' * 40

class ArtifactContract(unittest.TestCase):
    def setUp(self):
        self.valid = {'sha': SHA, 'image': 'ssartnership-lab-app:' + SHA, 'archiveSha256': 'b' * 64, 'startedAt': 1.0, 'finishedAt': 2.0, 'packagingSeconds': 0.5, 'deployed': False}

    def test_selects_only_public_validated_fields(self):
        value = validate_artifact({**self.valid, 'extra': 'ignored'}, SHA)
        self.assertEqual(value, self.valid)

    def test_identity_and_timing_are_fail_closed(self):
        for change in [{'sha': 'c' * 40}, {'image': 'production:latest'}, {'archiveSha256': '../x'}, {'deployed': True}, {'startedAt': float('nan')}, {'finishedAt': 0}, {'packagingSeconds': -1}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_artifact({**self.valid, **change}, SHA)

    def test_stage_timings_are_ordered_and_allowlisted(self):
        stages = dict(sourceReadyAt=1.1, gateImageReadyAt=1.2, gateStartedAt=1.3,
                      gateFinishedAt=1.5, packagingStartedAt=1.6)
        value = validate_artifact({**self.valid, 'stages': stages}, SHA)
        self.assertEqual(value['stages'], stages)
        for patch in ({'gateFinishedAt': 1.0}, {'sourceReadyAt': float('inf')}, {'unknown': 1.1}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                validate_artifact({**self.valid, 'stages': {**stages, **patch}}, SHA)

if __name__ == '__main__':
    unittest.main()
