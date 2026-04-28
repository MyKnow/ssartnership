# DB Schema-Service Refactor

## Status

- `analysis`: done
- `wave-1-doc`: done
- `wave-1-implementation`: done
- `wave-1-verification`: done
- `wave-2-planning`: done
- `wave-2-implementation`: done
- `wave-2-verification`: done
- `wave-3-planning`: done
- `wave-3-implementation`: done
- `wave-3-verification`: done
- `wave-4-planning`: done
- `wave-4-implementation`: done
- `wave-4-verification`: done
- `wave-5-planning`: done
- `wave-5-implementation`: done
- `wave-5-verification`: done
- `wave-6-planning`: done
- `wave-6-implementation`: done
- `wave-6-verification`: done
- `wave-7-planning`: done
- `wave-7-implementation`: done
- `wave-7-verification`: done
- `wave-8-planning`: done
- `wave-8-implementation`: done
- `wave-8-verification`: done
- `wave-9-planning`: pending

## Objective

Refactor the database/service boundary with three goals:

1. Remove attributes that are no longer used by application code.
2. Introduce denormalization only where repeated read cost justifies it.
3. Optimize existing query paths before larger schema changes.

## Relationship Map

| Area | Tables | Main Code Paths | Notes |
|---|---|---|---|
| Public partner catalog | `partners`, `categories`, `public_cache_versions` | `src/lib/repositories/supabase/partner-repository.supabase.ts` | Version-keyed cached reads with explicit column projection |
| Admin members | `members`, `push_preferences`, `push_subscriptions`, `member_policy_consents`, `auth_security_logs` | `src/app/admin/(protected)/members/page.tsx` | Server pagination plus follow-up preference/consent/security queries |
| Partner reviews | `partner_reviews`, `partner_review_reactions`, `partners`, `members`, `partner_companies` | `src/lib/admin-reviews.ts`, `src/lib/repositories/supabase/partner-review-repository.supabase.ts` | Admin list and public review paths share the same base table |
| Partner metrics | `event_logs`, `partner_metric_rollups`, `partner_metric_unique_visitors` | `src/lib/partner-metric-rollups.ts`, `src/lib/partner-service-metrics.ts`, `src/lib/partner-dashboard.supabase.ts` | Already denormalized into rollup tables |
| Partner accounts | `partner_accounts`, `partner_account_companies`, `partner_auth_attempts` | `src/lib/partner-auth/*`, admin partner account actions | Mixed legacy/new setup schema support still exists |

## Findings

### Safe attribute removal

- `partner_accounts.initial_setup_verification_code_hash`
  - Schema presence: [schema.sql](/Users/myknow/coding/ssartnership/supabase/schema.sql:191)
  - Code usage: written as `null`, never read for validation
  - Evidence:
    - [setup.ts](/Users/myknow/coding/ssartnership/src/lib/partner-auth/setup.ts:1)
    - [setup-link.ts](/Users/myknow/coding/ssartnership/src/app/admin/(protected)/_actions/partner-support/setup-link.ts:1)
    - [account-actions.account.ts](/Users/myknow/coding/ssartnership/src/app/admin/(protected)/_actions/account-actions.account.ts:1)

### Payload reduction candidates

- Admin members page still selected `avatar_base64` for every row even though the UI can load avatars via `/api/admin/members/[id]/avatar`.
  - Query: [members/page.tsx](/Users/myknow/coding/ssartnership/src/app/admin/(protected)/members/page.tsx:205)
  - Consumer: [AdminMemberListItem.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminMemberListItem.tsx:132)

### Query/index candidates

- Admin members:
  - name sort and year/campus/name ordering lacked dedicated indexes
  - security consent activity lookup uses `auth_security_logs` with `actor_type + event_name + status + actor_id + created_at`
- Push subscriptions:
  - active device count uses `member_id + is_active`
- Admin reviews:
  - list filters read `partner_reviews` by `deleted_at`, `hidden_at`, `rating`, `created_at`

### Denormalization candidates deferred

- `partner_favorites` counts are still recomputed by reading rows in several services.
- `partner_reviews` aggregate counts are still recomputed in admin/dashboard paths.
- Admin logs still favor broad reads followed by in-memory filtering.

These are not part of wave 1 because they need production measurements and trigger/update design.

## Wave 1 Changes

### Applied

- Remove `initial_setup_verification_code_hash` references from app code.
- Remove `avatar_base64` from admin member page list payload.
- Add first-pass indexes for:
  - member name sorts
  - member year/campus/name sorts
  - consent activity lookups
  - active push subscription lookups
  - admin review status/rating/date scans
- Move favorite/review counts from application-side row scans to DB-side aggregate RPCs.
- Change admin logs page/export loaders to stop querying once a short page is reached instead of prefetching every possible offset up to the configured cap.
- Remove unused `user_agent` fields from admin logs page/export query payloads.
- Reshape `/api/admin/logs` responses so full-range summary/filter metadata is precomputed on the server while the client receives only the current page log rows.
- Split default admin logs loading so full-range summary queries use thinner selects while the current page list still loads full row detail.
- Keep favorite/review counts on aggregate RPCs for now, and consolidate remaining direct review count paths behind helper functions instead of introducing persisted counters prematurely.
- Collapse admin overview summary counts into a single RPC instead of issuing repeated `count exact` PostgREST queries from the page loader.

### Deferred

- `promotion_slides.requires_login`
- `promotion_slides.allowed_years`
- `push_delivery_logs` retention cleanup
- review/favorite summary denormalization
- admin log storage/query redesign

## Next Wave Backlog

1. Evaluate whether favorite/review aggregate RPCs are sufficient or whether persisted counters are still justified.
2. Move admin logs and audit views further toward DB-side filtering and pagination.
3. Reconcile remaining `schema.sql` drift against applied migrations and live environments.
4. Re-measure admin members, admin reviews, admin dashboard, and push-related queries after migration deployment.

## Work Log

### 2026-04-28

- Documented schema/service relationship and safe first-wave scope.
- Applied code-level removal of `initial_setup_verification_code_hash`.
- Completed admin member payload slimming by removing `avatar_base64` from list query and relying on avatar endpoint fetch.
- Added `20260501012005_db_service_query_refactor_indexes.sql` for first-pass indexes and attribute removal.
- Synced `supabase/schema.sql` with the new first-pass index set and partner account column removal.
- Verified migration validation, focused tests, eslint, and production build.
- Started wave 2 planning to replace repeated `partner_favorites` and `partner_reviews` row scans with DB-side aggregate RPCs.
- Added `20260501012006_partner_count_aggregate_functions.sql` with `get_partner_favorite_counts(uuid[])` and `get_partner_review_counts(uuid[])`.
- Rewired favorite counts in the Supabase favorite repository to use the aggregate RPC instead of fetching raw favorite rows.
- Rewired review counts in partner dashboard, admin partner metrics, and partner service metrics to use the aggregate RPC instead of fetching raw review rows.
- Added unit coverage for count-map normalization and reran focused verification plus production build.
- Started wave 3 planning for admin logs query pagination. Current issue: page/export loaders precompute every page offset up to the configured ceiling and query them all even when later pages are empty.
- Added `collectPagedRows` for admin log loading so page/export stops after the first short page instead of firing all theoretical offsets in advance.
- Added dedicated pagination tests for the new admin log paging helper and reran focused verification plus production build.
- Started wave 4 planning for admin logs payload slimming. Current observation: `user_agent` is still selected across product/audit/security log loaders but is not consumed by logs page UI or CSV export.
- Removed `user_agent` from admin logs page/export row types and Supabase selects, then synced the Storybook fixture to the slimmer payload shape.
- Reran focused eslint, focused tests, and production build after the payload change.
- Started wave 5 planning for admin logs response shaping. Current issue: `/api/admin/logs` still returns full-range product/audit/security arrays even though the client only needs precomputed summaries plus the current page rows.
- Reworked `AdminLogsPageData` so summary cards, filter metadata, and chart inputs are precomputed server-side while only paged list rows are sent to the client.
- Updated admin logs selectors and manager state to derive visible explorer rows from `data.list.*` only.
- Synced the admin logs Storybook fixture to the new response shape and reran focused eslint, focused tests, and production build.
- Implemented split loading for the default admin logs view: summary rows now use thinner selects, while the current page list loads full detail only for the needed window.
- Kept complex search/filter/sort cases on the existing fallback path so behavior stays unchanged while the default path gets lighter.
- Reran focused eslint, focused tests, and production build after the split-loading change.
- Started wave 7 planning for remaining review count paths. Decision: do not introduce persisted counters yet; first consolidate remaining direct count queries behind RPC helpers and add a member-based review count index.
- Added `20260501012007_review_count_helpers.sql` with admin review count, partner review visibility count, and member review count range helpers.
- Added `partner_reviews_member_id_deleted_hidden_created_at_idx` to support member-range review counting without a persisted counter table.
- Replaced remaining direct review count queries in event rewards, admin review counts, admin home, and admin partner detail with shared helper calls.
- Kept persisted counters deferred because current read shapes are still bounded and the write-side consistency cost is not yet justified.
- Reran migration validation, focused eslint, focused tests, and production build.
- Started wave 8 planning for admin overview summary counts. Current issue: the admin home still fires repeated `count exact` PostgREST queries across members, companies, partners, categories, accounts, push subscriptions, and log tables.
- Added `20260501012008_admin_dashboard_counts.sql` with `get_admin_dashboard_counts()` so the admin overview can fetch summary counts through one RPC.
- Reworked the admin home page to consume the shared dashboard count helper instead of issuing multiple direct head-count queries.
- Added unit coverage for admin dashboard count normalization and synced `supabase/schema.sql` with the new RPC.
- Reran migration validation, focused eslint, focused tests, and production build.

## Verification

Completed commands:

```bash
npm run validate:migrations
npx eslint src/lib/partner-auth/setup.ts src/lib/partner-auth/types.ts 'src/app/admin/(protected)/_actions/partner-support/setup-link.ts' 'src/app/admin/(protected)/_actions/account-actions.account.ts' 'src/app/admin/(protected)/members/page.tsx' src/components/admin/AdminMemberListItem.tsx src/components/admin/member-manager/selectors.ts tests/partner-setup-fallback.test.mts
node --import ./tests/alias-register.mjs --test tests/partner-setup-fallback.test.mts tests/opt-wave5-selectors.test.mts
npm run build
npx eslint src/lib/partner-counts.ts src/lib/repositories/supabase/partner-favorite-repository.supabase.ts src/lib/partner-dashboard.supabase.ts src/lib/admin-partner-metrics.ts src/lib/partner-service-metrics.ts tests/partner-counts.test.mts
node --import ./tests/alias-register.mjs --test tests/partner-counts.test.mts tests/partner-setup-fallback.test.mts tests/opt-wave5-selectors.test.mts
npx eslint src/lib/log-insights/data.ts src/lib/log-insights/paging.ts tests/log-insights-paging.test.mts
node --import ./tests/alias-register.mjs --test tests/log-insights-paging.test.mts tests/partner-counts.test.mts tests/partner-setup-fallback.test.mts tests/opt-wave5-selectors.test.mts
npx eslint src/lib/log-insights/data.ts src/lib/log-insights/shared.ts src/components/admin/AdminLogsManager.stories.tsx
npx eslint src/lib/log-insights.ts src/lib/log-insights/shared.ts src/components/admin/logs/selectors.ts src/components/admin/logs-manager/useAdminLogsManager.ts src/components/admin/AdminLogsManager.stories.tsx
node --import ./tests/alias-register.mjs --test tests/log-insights-paging.test.mts tests/partner-counts.test.mts tests/partner-setup-fallback.test.mts tests/opt-wave5-selectors.test.mts
npx eslint src/lib/log-insights.ts src/lib/log-insights/data.ts src/lib/log-insights/shared.ts src/components/admin/logs-manager/useAdminLogsManager.ts src/components/admin/logs/selectors.ts src/components/admin/AdminLogsManager.stories.tsx
node --import ./tests/alias-register.mjs --test tests/log-insights-paging.test.mts tests/partner-counts.test.mts tests/partner-setup-fallback.test.mts tests/opt-wave5-selectors.test.mts
npm run validate:migrations
npx eslint src/lib/partner-counts.ts src/lib/promotions/event-rewards.ts src/lib/admin-reviews.ts 'src/app/admin/(protected)/page.tsx' 'src/app/admin/(protected)/partners/[partnerId]/page.tsx' tests/partner-counts-visibility.test.mts
node --import ./tests/alias-register.mjs --test tests/partner-counts.test.mts tests/partner-counts-visibility.test.mts tests/partner-setup-fallback.test.mts tests/log-insights-paging.test.mts tests/opt-wave5-selectors.test.mts
npm run validate:migrations
npx eslint src/lib/partner-counts.ts 'src/app/admin/(protected)/page.tsx' tests/partner-counts.test.mts
node --import ./tests/alias-register.mjs --test tests/partner-counts.test.mts tests/partner-counts-visibility.test.mts tests/partner-setup-fallback.test.mts tests/log-insights-paging.test.mts tests/opt-wave5-selectors.test.mts
npm run build
```

Results:

- `npm run validate:migrations`: passed
- focused node tests: 5 passed, 0 failed
- focused eslint: passed
- `npm run build`: passed
- wave 2 focused node tests: 7 passed, 0 failed
- wave 2 focused eslint: passed
- wave 3 focused node tests: 10 passed, 0 failed
- wave 3 focused eslint: passed
- wave 4 focused eslint: passed
- wave 4 production build: passed
- wave 5 focused node tests: 10 passed, 0 failed
- wave 5 focused eslint: passed
- wave 5 production build: passed
- wave 7 migration validation: passed
- wave 7 focused node tests: 12 passed, 0 failed
- wave 7 focused eslint: passed
- wave 7 production build: passed
- wave 6 focused node tests: 10 passed, 0 failed
- wave 6 focused eslint: passed
- wave 6 production build: passed
- wave 8 migration validation: passed
- wave 8 focused node tests: 12 passed, 0 failed
- wave 8 focused eslint: passed
- wave 8 production build: passed

After migration deployment, re-measure:

```sql
select pg_stat_statements_reset();
```

Replay:

1. Admin members page with name/year/campus filters
2. Admin push page
3. Admin reviews page with status/rating filters

Then inspect:

```sql
select query, calls, total_exec_time, mean_exec_time, max_exec_time, rows
from pg_stat_statements
where query ilike '%members%'
   or query ilike '%partner_reviews%'
   or query ilike '%push_subscriptions%'
   or query ilike '%auth_security_logs%'
order by total_exec_time desc
limit 30;
```
