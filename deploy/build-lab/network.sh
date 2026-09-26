#!/bin/sh
# Issue 497: dedicated lab bridge; never reload the management bridge.
set -eu
[ "$(id -u)" = 0 ]
[ "$(hostname -s)" = myknow-pve ]
command -v nft >/dev/null
command -v ip >/dev/null
mkdir -p /etc/network/interfaces.d
cat > /etc/network/interfaces.d/build-lab-497 <<'CONFIG'
auto vmbr497
iface vmbr497 inet static
    address 10.77.49.1/24
    bridge-ports none
    bridge-stp off
    bridge-fd 0
CONFIG
if ! ip link show vmbr497 >/dev/null 2>&1; then ip link add vmbr497 type bridge; fi
ip address replace 10.77.49.1/24 dev vmbr497
ip link set vmbr497 up
# Replace only this experiment's table, in a single atomic transaction.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
if nft list table inet build_lab_497 >/dev/null 2>&1; then echo 'delete table inet build_lab_497' >> "$tmp"; fi
# Resolve operational public ingress on each apply; fail closed on DNS errors.
operations_v4=$(python3 - <<'DNS'
import ipaddress
import socket
addresses = set()
for hostname in ('ssartnership.myknow.xyz', 'ssartnership-dev.myknow.xyz', 'ssartnership-api.myknow.xyz', 'ssartnership-api-dev.myknow.xyz'):
    for item in socket.getaddrinfo(hostname, 443, socket.AF_INET, socket.SOCK_STREAM):
        address = ipaddress.ip_address(item[4][0])
        if address.is_global:
            addresses.add(str(address))
if not addresses:
    raise SystemExit('Operational ingress resolution failed')
print(', '.join(sorted(addresses)))
DNS
)
printf 'define operations_v4 = { %s }\n' "$operations_v4" >> "$tmp"
cat >> "$tmp" <<'RULES'
table inet build_lab_497 {
 chain input {
  type filter hook input priority -10; policy accept;
  iifname "vmbr497" ct state established,related accept
  iifname "vmbr497" counter drop
 }
 chain forward {
  type filter hook forward priority -10; policy accept;
  iifname "vmbr497" meta nfproto ipv6 counter drop
  oifname "vmbr497" meta nfproto ipv6 counter drop
  iifname "vmbr497" ip saddr != { 10.77.49.10, 10.77.49.20 } counter drop
  iifname "vmbr497" ip daddr { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4 } counter drop
  iifname "vmbr497" ip daddr $operations_v4 counter drop
  iifname "vmbr497" oifname "vmbr0" ip daddr 1.1.1.1 udp dport 53 accept
  iifname "vmbr497" oifname "vmbr0" ip daddr 1.1.1.1 tcp dport 53 accept
  iifname "vmbr497" oifname "vmbr0" tcp dport { 80, 443 } accept
  iifname "vmbr497" counter drop
  oifname "vmbr497" ct state established,related accept
  oifname "vmbr497" counter drop
 }
 chain postrouting {
  type nat hook postrouting priority srcnat; policy accept;
  ip saddr 10.77.49.0/24 oifname "vmbr0" masquerade
 }
}
RULES
nft --check -f "$tmp"
nft -f "$tmp"
printf 'net.ipv4.ip_forward=1\n' > /etc/sysctl.d/90-build-lab-497.conf
sysctl -w net.ipv4.ip_forward=1
