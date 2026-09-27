import unittest
import json
from unittest.mock import patch
import loopback_proxy as proxy
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

    def test_activation_resolves_current_address_after_restart(self):
        networks = {'ssartnership-lab-497_private': {'IPAddress': '172.18.0.4'}}
        with patch.object(proxy.subprocess, 'check_output', side_effect=[json.dumps(networks), 'true\n']) as command:
            self.assertEqual(proxy.current_target('app'), '172.18.0.4:3000')
        self.assertEqual(command.call_args_list[0].args[0][-1], 'ssartnership-lab-497-app-1')

    def test_activation_refuses_external_network_before_forwarding(self):
        networks = {'ssartnership-lab-497_private': {'IPAddress': '172.18.0.4'}}
        with patch.object(proxy.subprocess, 'check_output', side_effect=[json.dumps(networks), 'false\n']):
            with self.assertRaises(ValueError):
                proxy.current_target('app')

    def test_unknown_service_cannot_query_docker(self):
        with patch.object(proxy.subprocess, 'check_output') as command:
            with self.assertRaises(ValueError):
                proxy.current_target('production')
            command.assert_not_called()

    def test_wrong_host_cannot_resolve_or_start_proxy(self):
        with patch.object(proxy, 'assert_host', side_effect=RuntimeError('wrong host')), patch.object(proxy, 'current_target') as resolve:
            with self.assertRaises(RuntimeError):
                proxy.serve('app')
            resolve.assert_not_called()

    def test_startup_deadline_does_not_forward_to_unready_container(self):
        with patch.object(proxy, 'assert_host'), patch.object(proxy, 'current_target', side_effect=RuntimeError('not ready')), patch.object(proxy.time, 'monotonic', side_effect=[0, 46]), patch.object(proxy.os, 'execv') as execute:
            with self.assertRaises(RuntimeError):
                proxy.serve('app')
            execute.assert_not_called()

    def test_privileges_are_dropped_before_proxy_exec(self):
        calls = []
        with patch.object(proxy, 'assert_host'), patch.object(proxy, 'current_target', return_value='172.18.0.4:3000'), patch.object(proxy.pwd, 'getpwnam') as account, patch.object(proxy.os, 'setgroups', side_effect=lambda value: calls.append(('groups', value))), patch.object(proxy.os, 'setgid', side_effect=lambda value: calls.append(('gid', value))), patch.object(proxy.os, 'setuid', side_effect=lambda value: calls.append(('uid', value))), patch.object(proxy.os, 'execv', side_effect=lambda *args: calls.append(('exec', args))):
            account.return_value.pw_gid = 65534
            account.return_value.pw_uid = 65534
            proxy.serve('app')
        self.assertEqual([call[0] for call in calls], ['groups', 'gid', 'uid', 'exec'])
        self.assertEqual(calls[-1][1][1][-1], '172.18.0.4:3000')
