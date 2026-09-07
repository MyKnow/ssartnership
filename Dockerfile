# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
COPY scripts/check-install-scripts.mjs scripts/install-dependencies.mjs ./scripts/
COPY vendor/archiver-cjs-compat ./vendor/archiver-cjs-compat
# This script validates the reviewed npm policy, disables all dependency
# lifecycle scripts, and verifies the platform-specific esbuild binary.
RUN npm run install:trusted

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_DATA_SOURCE
ARG NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NODE_ENV=production \
    SELF_HOST_BUILD=1 \
    NEXT_PUBLIC_DATA_SOURCE=${NEXT_PUBLIC_DATA_SOURCE} \
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=${NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
# The manifest carries only build-public values. Server secrets never enter a
# build ARG, ENV instruction, layer, or generated client bundle.
RUN node deploy/self-host/write-build-env-manifest.mjs /app/.self-host-build/build-env.json
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs --create-home nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/.self-host-build/build-env.json ./self-host/build-env.json
COPY --from=builder --chown=nextjs:nextjs /app/deploy/self-host/runtime-env.mjs ./self-host/runtime-env.mjs
COPY --from=builder --chown=nextjs:nextjs /app/deploy/self-host/validate-runtime.mjs ./self-host/validate-runtime.mjs
COPY --from=builder --chown=nextjs:nextjs /app/deploy/self-host/start.sh ./self-host/start.sh
RUN chmod 0555 ./self-host/start.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD node -e "const request = require('node:http').get('http://127.0.0.1:3000/api/health', (response) => process.exit(response.statusCode === 200 ? 0 : 1)); request.on('error', () => process.exit(1)); request.setTimeout(2000, () => request.destroy());"
ENTRYPOINT ["/app/self-host/start.sh"]
