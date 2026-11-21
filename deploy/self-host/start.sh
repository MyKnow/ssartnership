#!/bin/sh
set -eu

node /app/self-host/validate-runtime.mjs

# /app/.next/cache may be a persistent volume so optimized images survive
# deploys. Next keeps revalidateTag invalidations only in process memory, and
# unstable_cache keys do not include the build, so a data entry written by an
# earlier process could come back stale or with an older shape. Every process
# therefore starts with an empty data cache; the image cache is kept.
cache_dir=/app/.next/cache
if [ -d "$cache_dir" ] && [ ! -w "$cache_dir" ]; then
  echo "self-host startup: $cache_dir is not writable; caches will not persist" >&2
fi
rm -rf "$cache_dir/fetch-cache" || echo "self-host startup: data cache reset failed" >&2

exec node /app/server.js
