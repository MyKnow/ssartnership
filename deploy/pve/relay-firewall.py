#!/usr/bin/env python3
"""Install only the new guest's private relay rules; preserve other chains."""
import ipaddress
import os
import re
import subprocess

if os.getuid() != 0:
    raise SystemExit("RELAY_FIREWALL_ROOT_REQUIRED")

allowed = ipaddress.IPv4Address(os.environ["OPS_VM_IP"])
destination = ipaddress.IPv4Address(os.environ["PVE_RELAY_BIND_IP"])
app_port = int(os.environ["APP_PORT"])
private_networks = tuple(ipaddress.IPv4Network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
if app_port not in (3108, 3110) or not all(any(address in network for network in private_networks) for address in (allowed, destination)) or allowed == destination:
    raise SystemExit("RELAY_FIREWALL_CONFIG_INVALID")

route = subprocess.check_output(["ip", "-4", "route", "get", str(allowed)], text=True).split()
interface = route[route.index("dev") + 1]
if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,32}", interface) or interface == "lo":
    raise SystemExit("RELAY_FIREWALL_INTERFACE_INVALID")

def invoke(*arguments, check=True):
    return subprocess.run(["iptables", "--wait", "10", *arguments], capture_output=True, check=check)

for chain in ("DOCKER-USER", "SSARTNERSHIP-RELAY"):
    if invoke("-S", chain, check=False).returncode:
        invoke("-N", chain)

# Install before dockerd starts at boot. Docker keeps user rules in this chain.
if invoke("-C", "FORWARD", "-j", "DOCKER-USER", check=False).returncode:
    invoke("-I", "FORWARD", "1", "-j", "DOCKER-USER")
if invoke("-C", "DOCKER-USER", "-j", "SSARTNERSHIP-RELAY", check=False).returncode:
    invoke("-I", "DOCKER-USER", "1", "-j", "SSARTNERSHIP-RELAY")

# A single restore transaction avoids an empty-chain window during refresh.
rules = ["*filter", "-F SSARTNERSHIP-RELAY"]
for port in (app_port, 8000, 9464, 9187, 9100):
    match = f"-i {interface} -p tcp -m conntrack --ctorigdst {destination} --ctorigdstport {port}"
    rules.append(f"-A SSARTNERSHIP-RELAY {match} ! -s {allowed}/32 -j DROP")
rules.extend(["-A SSARTNERSHIP-RELAY -j RETURN", "COMMIT", ""])
subprocess.run(["iptables-restore", "--wait", "10", "--noflush"], input="\n".join(rules), text=True, capture_output=True, check=True)
print("RELAY_FIREWALL_INSTALLED")
