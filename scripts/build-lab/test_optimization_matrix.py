import unittest
from optimization_matrix import comparison_plan


class OptimizationProtocol(unittest.TestCase):
    def test_each_variant_has_three_fresh_and_three_warm_runs(self):
        plan = comparison_plan('a' * 40)
        self.assertEqual(len(plan), 12)
        self.assertEqual(len({name for name, _, _ in plan}), 12)
        for variant in ('off', 'on'):
            for mode in ('cold', 'warm'):
                self.assertEqual(sum(f'-{variant}-{mode}-' in name for name, _, _ in plan), 3)
        completed = set()
        for name, warm_from, enabled in plan:
            self.assertEqual(enabled, '-on-' in name)
            if warm_from:
                self.assertIn(warm_from, completed)
                self.assertEqual(name.replace('-warm-', '-cold-'), warm_from)
            completed.add(name)

    def test_rejects_non_commit_identity(self):
        for sha in ('main', '../source', 'a' * 39):
            with self.assertRaises(ValueError):
                comparison_plan(sha)


if __name__ == '__main__':
    unittest.main()
