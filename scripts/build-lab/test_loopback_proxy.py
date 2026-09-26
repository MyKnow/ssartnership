import unittest
from loopback_proxy import proxy_target

class ProxyBoundary(unittest.TestCase):
    def test_fixed_services_only(self):
        for kind, expected in [('app', (3100, '172.18.0.2:3000')), ('api', (54321, '172.18.0.2:8000'))]:
            self.assertEqual(proxy_target(kind, {'NetworkSettings': {'Networks': {'lab_private': {'IPAddress': '172.18.0.2'}}}}), expected)

    def test_public_loopback_and_missing_targets_refused(self):
        for address in ('1.1.1.1', '127.0.0.1', '100.77.177.111', '::1', ''):
            with self.subTest(address=address), self.assertRaises(ValueError):
                proxy_target('app', {'NetworkSettings': {'Networks': {'lab_private': {'IPAddress': address}}}})
        with self.assertRaises(ValueError):
            proxy_target('production', {})
