#!/bin/sh
set -eu

node /app/self-host/validate-runtime.mjs
exec node /app/server.js
