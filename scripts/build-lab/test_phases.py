import unittest
from phases import markers


class PhaseTimestampContract(unittest.TestCase):
    def test_docker_nanoseconds_are_portable_and_ordered(self):
        rows = markers('2026-09-27T00:00:02.123456789Z > ssartnership@1.0.0 lint\n'
                       '2026-09-27T00:00:01.123456789Z > ssartnership@1.0.0 install:trusted\n')
        self.assertEqual([r['marker'] for r in rows], ['install:trusted', 'lint'])
        self.assertAlmostEqual(rows[1]['at'] - rows[0]['at'], 1.0)


if __name__ == '__main__':
    unittest.main()
