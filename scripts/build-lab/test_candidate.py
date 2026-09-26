import unittest
from candidate import validate_candidate


class CandidateContract(unittest.TestCase):
    def setUp(self):
        self.sha = 'a' * 40
        self.record = {'sha': self.sha, 'archiveSha256': 'b' * 64,
                       'gateImageId': 'sha256:' + 'c' * 64}

    def test_exact_candidate_identity(self):
        self.assertEqual(validate_candidate(self.record, self.sha), self.record)

    def test_missing_moved_or_mutable_identity_rejected(self):
        for patch in ({'sha': 'd' * 40}, {'archiveSha256': '../source'},
                      {'gateImageId': 'ssartnership-lab-gate:latest'}, {'gateImageId': None}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                validate_candidate({**self.record, **patch}, self.sha)


if __name__ == '__main__':
    unittest.main()
