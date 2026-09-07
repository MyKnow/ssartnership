FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7
WORKDIR /service
# COPY applies the mode to newly created parent directories too. Preserve
# traversal for the nonroot runtime without making public code writable.
COPY --chmod=0555 deploy/observability/telemetry.mjs ./deploy/observability/telemetry.mjs
COPY --chmod=0555 src/lib/web-vitals-contract.ts ./src/lib/web-vitals-contract.ts
USER 1001:1001
EXPOSE 9464
CMD ["node", "deploy/observability/telemetry.mjs"]
