#!/bin/sh
set -eu
# Preserve a supplied Bearer JWT, otherwise forward Supabase JS's legacy apikey.
export LUA_AUTH_EXPR="\$((headers.authorization ~= nil and headers.authorization:sub(1, 10) ~= 'Bearer sb_' and headers.authorization) or headers.apikey)"
awk '{ result=""; rest=$0; while (match(rest,/\$[A-Za-z_][A-Za-z_0-9]*/)) { variable=substr(rest,RSTART+1,RLENGTH-1); if (variable in ENVIRON) result=result substr(rest,1,RSTART-1) ENVIRON[variable]; else result=result substr(rest,1,RSTART+RLENGTH-1); rest=substr(rest,RSTART+RLENGTH) } print result rest }' /home/kong/kong.template.yml > "$KONG_DECLARATIVE_CONFIG"
exec /entrypoint.sh kong docker-start
