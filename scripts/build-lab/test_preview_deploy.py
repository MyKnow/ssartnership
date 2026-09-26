import unittest
from preview_deploy import validate_request, validate_image, validate_networks

SHA = 'a' * 40
HASH = 'b' * 64

class PreviewBoundary(unittest.TestCase):
    def test_only_exact_commit_and_archive_hash(self):
        self.assertEqual(validate_request(SHA, HASH), 'ssartnership-lab-app:' + SHA)
        for sha, digest in [('main', HASH), ('../' + SHA, HASH), (SHA, ''), (SHA.upper(), HASH)]:
            with self.assertRaises(ValueError):
                validate_request(sha, digest)

    def test_image_must_carry_requested_revision(self):
        validate_image({'Config': {'Labels': {'org.opencontainers.image.revision': SHA}}}, SHA)
        for image in [{}, {'Config': {'Labels': None}}, {'Config': {'Labels': {'org.opencontainers.image.revision': 'c' * 40}}}]:
            with self.assertRaises(ValueError):
                validate_image(image, SHA)

    def test_all_attached_networks_must_be_internal(self):
        validate_networks([{'Internal': True}, {'Internal': True}])
        for networks in [[], [{'Internal': False}], [{'Internal': True}, {}]]:
            with self.assertRaises(ValueError):
                validate_networks(networks)

if __name__ == '__main__':
    unittest.main()
