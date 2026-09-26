import unittest
from build_profile import validate_profile


class BuildProfileContract(unittest.TestCase):
    def setUp(self):
        self.profile = dict(cpus=4, vmMemoryMiB=6144, containerMemoryMiB=5120,
                            stableLabCache=True, reuseCache=True)

    def test_bounded_profile_is_preserved(self):
        self.assertEqual(validate_profile(self.profile), self.profile)

    def test_unknown_fields_types_or_overcommit_are_rejected(self):
        for patch in ({'cpus': 16}, {'cpus': True}, {'vmMemoryMiB': 2048},
                      {'containerMemoryMiB': 6144}, {'reuseCache': 'true'}, {'target': 'production'}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                validate_profile({**self.profile, **patch})


if __name__ == '__main__':
    unittest.main()
