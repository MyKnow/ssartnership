# The trusted gate already ran install policy, all checks, one real standalone
# build and the retry-free full E2E suite. Package that SAME compiled output.
FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nextjs && useradd --system --uid 1001 --gid nextjs --create-home nextjs
COPY --chown=nextjs:nextjs public ./public
COPY --chown=nextjs:nextjs .next/standalone ./
COPY --chown=nextjs:nextjs .next/static ./.next/static
COPY --chown=nextjs:nextjs .self-host-build/build-env.json ./self-host/build-env.json
COPY --chown=nextjs:nextjs deploy/self-host/runtime-env.mjs deploy/self-host/validate-runtime.mjs deploy/self-host/start.sh ./self-host/
RUN chmod 0555 ./self-host/start.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/self-host/start.sh"]
