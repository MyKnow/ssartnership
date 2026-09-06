#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0 || exit 77
task_command=${1:-}
test "$#" = 1 || exit 64
case "$task_command" in
  collect|status|db-check)
    exec /opt/ssartnership/node24/node /opt/ssartnership/control/current/scripts/self-host-operations/maintenance.mjs "$task_command" ;;
  backup-full|backup-incr|check|restore|offhost-capture|offhost-check)
    exec /usr/bin/flock --nonblock --conflict-exit-code 75 /var/lib/ssartnership-ci/heavy.lock \
      /opt/ssartnership/node24/node /opt/ssartnership/control/current/scripts/self-host-operations/maintenance.mjs "$task_command" ;;
  *) exit 64 ;;
esac
