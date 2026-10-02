import os
import runpy
import subprocess
import sys
from unittest.mock import patch

SCRIPT=sys.argv[1]

def exercise(allowed='192.168.1.2',destination='192.168.1.69',port='3108',interface='ens18'):
    calls=[]
    def run(args,**kwargs):
        calls.append((args,kwargs))
        return subprocess.CompletedProcess(args,1 if '-C' in args or '-S' in args else 0,b'',b'')
    env={'OPS_VM_IP':allowed,'PVE_RELAY_BIND_IP':destination,'APP_PORT':port}
    with patch.dict(os.environ,env,clear=True),patch('os.getuid',return_value=0),patch('subprocess.run',side_effect=run),patch('subprocess.check_output',return_value=f'{allowed} dev {interface} src {destination}'):
        error=None
        try:runpy.run_path(SCRIPT)
        except SystemExit as e:error=str(e)
    return error,calls

# Invalid destinations must fail before issuing any firewall write.
for ip in ['0.0.0.0','127.0.0.1','169.254.1.1','8.8.8.8']:
    error,calls=exercise(allowed=ip)
    assert error=='RELAY_FIREWALL_CONFIG_INVALID' and not calls,ip
for changes in [{'destination':'192.168.1.2'},{'port':'5432'},{'interface':'ens18;touch'}]:
    error,calls=exercise(**changes)
    assert error and not calls,changes

error,calls=exercise()
assert error is None
restore=[(args,kwargs) for args,kwargs in calls if args[0]=='iptables-restore']
assert len(restore)==1 and '--noflush' in restore[0][0]
rules=restore[0][1]['input']
assert '-F SSARTNERSHIP-RELAY\n' in rules
assert '\n-F DOCKER-USER\n' not in rules and '\n-F FORWARD\n' not in rules
for port in [3108,8000,9464,9187,9100]:
    assert f'--ctorigdst 192.168.1.69 --ctorigdstport {port} ! -s 192.168.1.2/32 -j DROP' in rules
assert '--ctorigdstport 5432' not in rules
assert rules.endswith('-A SSARTNERSHIP-RELAY -j RETURN\nCOMMIT\n')
print('Relay rules reject invalid addresses and preserve unrelated firewall chains')
