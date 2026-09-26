import unittest
from resource_matrix import resource_cases


class ResourceCases(unittest.TestCase):
    def test_cpu_comparison_holds_memory_fixed(self):
        self.assertEqual(resource_cases('cpu', None), [(2, 6144, 5120), (4, 6144, 5120), (8, 6144, 5120)])

    def test_ram_comparison_holds_selected_cpu_fixed(self):
        self.assertEqual(resource_cases('ram', 4), [(4, 6144, 5120), (4, 8192, 6144)])

    def test_unknown_or_missing_selection_rejected(self):
        for profile, cpus in [('ram', None), ('ram', 16), ('unknown', 4), ('cpu', 4)]:
            with self.subTest(profile=profile, cpus=cpus), self.assertRaises(ValueError):
                resource_cases(profile, cpus)


if __name__ == '__main__':
    unittest.main()
