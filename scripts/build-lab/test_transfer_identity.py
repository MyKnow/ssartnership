import base64
import unittest
from transfer_identity import authorized_keys, validate_key

KEY = 'ssh-ed25519 ' + base64.b64encode(b'\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20' + b'a' * 32).decode()


class TransferIdentityBoundary(unittest.TestCase):
    def test_only_lab_key_is_rotated(self):
        human = KEY + ' human-management'
        previous = 'restrict ' + KEY + ' build-lab-497-ephemeral'
        result = authorized_keys(human + '\n' + previous + '\n', KEY)
        self.assertIn(human + '\n', result)
        self.assertEqual(result.count('build-lab-497-ephemeral'), 1)
        self.assertIn('from="10.77.49.1",restrict ', result)

    def test_malformed_and_injected_keys_rejected(self):
        for value in (KEY + '\n' + KEY, 'ssh-rsa AAAA', KEY + ' comment', 'ssh-ed25519 AAAA'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_key(value)


if __name__ == '__main__':
    unittest.main()
