#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0 || { echo 'root operator required' >&2; exit 77; }
runtime_dir=/opt/ssartnership/node24
runtime_image=node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7
test ! -e "$runtime_dir" || { echo 'runtime already exists; inspect before updating' >&2; exit 73; }
test ! -L /opt/ssartnership || exit 73
install -d -m 0755 /opt/ssartnership
docker pull "$runtime_image"
runtime_container=$(docker create --network none --entrypoint /bin/true "$runtime_image")
trap 'docker rm "$runtime_container" >/dev/null' EXIT
install -d -m 0755 "$runtime_dir"
docker cp "$runtime_container:/usr/local/bin/node" "$runtime_dir/node"
chown root:root "$runtime_dir/node"
chmod 0555 "$runtime_dir/node"
test "$("$runtime_dir/node" --version)" = v24.18.1
sha256sum "$runtime_dir/node"
echo 'Project Node runtime installed; no system Node or access configuration changed.'
