# syntax=docker/dockerfile:1
FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS node
FROM mcr.microsoft.com/playwright:v1.59.1-noble@sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && test "$(node --version)" = v24.18.1 \
    && test "$(npm --version)" = 11.16.0 \
    && git --version \
    && test "$(id -u pwuser)" = 1001
COPY --chmod=0555 gate.mjs /opt/ssartnership/gate.mjs
# Source is extracted under umask 077. COPY must not inherit owner-only read
# permissions for these public modules: the gate runs as the caller's nonroot UID.
COPY --chmod=0444 playwright.config.mjs warmup.mjs batch-plan.mjs e2e.mjs /opt/ssartnership/
COPY --chmod=0444 playwright.desktop.config.mjs e2e-desktop.mjs /opt/ssartnership/
COPY --chmod=0444 browser-server.mjs /opt/ssartnership/
ENV CI=1 NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/tmp/ci-home
USER 1001:1001
WORKDIR /work
ENTRYPOINT ["node", "/opt/ssartnership/gate.mjs"]
