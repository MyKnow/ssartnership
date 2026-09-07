# syntax=docker/dockerfile:1
# Keep the verified Supabase image immutable and add only the pgBackRest binary
# needed by the operations overlay. Runtime secrets are injected by Compose;
# nothing secret is copied into this build context.
ARG BASE_IMAGE=supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00
FROM ${BASE_IMAGE}

USER root

RUN apk add --no-cache pgbackrest=2.57.0-r0 \
  && test "$(postgres --version)" = "postgres (PostgreSQL) 17.6" \
  && install -d -o postgres -g postgres -m 0750 \
    /etc/pgbackrest \
    /var/lib/pgbackrest/repo \
    /var/spool/pgbackrest

COPY --chown=postgres:postgres pgbackrest.conf /etc/pgbackrest/pgbackrest.conf

# Preserve the upstream docker-entrypoint.sh and its CMD. The Compose overlay
# appends PostgreSQL archive settings through `command`, rather than replacing
# this ENTRYPOINT.
