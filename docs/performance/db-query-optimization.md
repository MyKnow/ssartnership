# DB Query Optimization Report

## Baseline

| Area | Query / Pattern | Calls | Total Time | Mean Time | Max Time | Notes |
|---|---:|---:|---:|---:|---:|---|
| Timezone | SELECT name FROM pg_timezone_names | 63 | 51089.973ms | 810.952ms | 2675.030ms | Repeated runtime lookup |
| Members | COPY/select members with avatar_base64/password_hash/password_salt | 56 | 32644.912ms | 582.945ms | 2820.633ms | Heavy columns included |
| Members | members.* with count/pagination | 98 | 50524.544ms | 515.557ms | 5184.120ms | select * / count overhead |
| Members | year filter + created_at sort | 1 | 724.906ms | 724.906ms | 724.906ms | Needs composite index check |
| Metrics | event_logs rollup | 1 | 1066.613ms | 1066.613ms | 1066.613ms | Needs index check |
| Metrics | unique visitor rollup | 2 | 1138.173ms | 569.087ms | 675.451ms | Needs index check |

## Changes Made

- Confirmed no application code directly queries `pg_timezone_names`. Runtime metric code stores and uses the fixed `Asia/Seoul` timezone value instead of fetching timezone names dynamically.
- Reviewed members queries and confirmed admin members/home/push list paths use explicit selected columns rather than `select *`.
- Updated preview data sync sanitization so `COPY public.members` removes `avatar_base64`, `password_hash`, and `password_salt` before restoring production data into preview.
- Added regression coverage for preview dump sanitization to prevent `members` COPY blocks from reintroducing heavy or sensitive columns.
- Added members sort indexes for `created_at desc` and `year desc, created_at desc`.
- Added a partner metric index for `event_logs` queries filtered by `target_type`, `target_id`, `event_name`, and `created_at`.

## Indexes Added / Reused

- Added `members_year_created_at_idx`:
  `create index if not exists members_year_created_at_idx on public.members (year desc, created_at desc);`
- Added `members_created_at_idx`:
  `create index if not exists members_created_at_idx on public.members (created_at desc);`
- Added `event_logs_partner_metric_idx`:
  `create index if not exists event_logs_partner_metric_idx on public.event_logs (target_type, target_id, event_name, created_at) where target_id is not null;`
- Reused existing `event_logs_target_idx` for generic target lookups. It is not a full replacement for the new partner metric index because it does not include `event_name` or `created_at`.
- Reused existing `event_logs_event_name_idx` and `event_logs_created_at_idx` for generic single-column filtering. They are not a full replacement for the observed combined partner metric pattern.

## Post-change Measurement

Measured on 2026-04-27 after resetting `pg_stat_statements` and replaying the agreed scenario.

The top queries after reset were Supabase Dashboard metadata/introspection queries, not application traffic:

- Function metadata query: `468.334ms`, source `dashboard`.
- Available extensions query: `447.802ms`.
- Table/column metadata query: `127.727ms`.

These are dashboard inspection costs and are not optimized by application code or public schema indexes.

Run this query after the scenario:

```sql
select
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  rows
from pg_stat_statements
where query ilike '%pg_timezone_names%'
   or query ilike '%public"."members%'
   or query ilike '%public.members%'
   or query ilike '%event_logs%'
order by total_exec_time desc
limit 30;
```

For a clean post-change measurement, reset statistics first:

```sql
select pg_stat_statements_reset();
```

Then run the same scenario:

1. Home screen refresh 5 times.
2. Members list screen enter 5 times.
3. Partner detail/metric related screen enter 5 times.
4. Query `pg_stat_statements` again.

## Result Summary

| Area | Before Mean | After Mean | Improvement |
|---|---:|---:|---:|
| Timezone lookup | 810.952ms | Not observed | Removed from measured app workload |
| Members heavy query | 582.945ms | Not observed | Removed from measured app workload |
| Members pagination/count | 515.557ms | 5.635ms | 98.91% faster |
| Members year sort | 724.906ms | Not observed | No matching post-change query in replay |
| Event logs rollup | 1066.613ms | 9.964ms | 99.07% faster |
| Unique visitor rollup | 569.087ms | 9.964ms | 98.25% faster against combined metric rollup query |

## Post-change Observations

| Area | Query / Pattern | Calls | Total Time | Mean Time | Max Time | Notes |
|---|---:|---:|---:|---:|---:|---|
| Dashboard | Function metadata introspection | 1 | 468.334ms | 468.334ms | 468.334ms | Supabase Dashboard, not app traffic |
| Dashboard | Available extensions metadata | 1 | 447.802ms | 447.802ms | 447.802ms | Supabase Dashboard, not app traffic |
| Dashboard | Table/column metadata introspection | 1 | 127.727ms | 127.727ms | 127.727ms | Supabase Dashboard, not app traffic |
| Event Logs | Insert event_logs | 28 | 497.450ms | 17.766ms | 113.086ms | Write path; includes trigger work |
| Members | Admin members explicit-column list ordered by created_at | 5 | 28.175ms | 5.635ms | 18.745ms | No `avatar_base64`, `password_hash`, or `password_salt` |
| Metrics | partner_metric_rollups combined query | 6 | 59.781ms | 9.964ms | 45.641ms | Rollup table path, no raw `event_logs` scan observed |
| Metrics | partner_metric_rollups filtered by granularity | 18 | 35.945ms | 1.997ms | 7.610ms | Rollup table path |
| Timezone | `pg_timezone_names` | 0 | 0ms | Not observed | Not observed | No matching query after replay |
| Members | Heavy members COPY/select with sensitive columns | 0 | 0ms | Not observed | Not observed | No matching query after replay |

## Change Impact Summary

- Removing `avatar_base64`, `password_hash`, and `password_salt` from preview `COPY public.members` reduces transferred row width and prevents sensitive password material from being copied into preview through this workflow.
- `members_year_created_at_idx` targets the observed `where year = any (...) order by year desc, created_at desc` pattern.
- `members_created_at_idx` targets admin list queries ordered by newest members.
- `event_logs_partner_metric_idx` targets partner metric rollups that filter by partner target, metric event name, and event time.
- The timezone issue is documented as an observed database statistic without a matching app-level `pg_timezone_names` call in this codebase. If it persists after deployment, inspect database extensions, dashboard tooling, or external clients.
- The remaining event log cost is now primarily the `event_logs` insert path. Because partner metric rollups are maintained by an insert trigger, this cost includes write-time rollup work rather than the old read-time raw log aggregation.
