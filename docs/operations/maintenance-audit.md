# SSARTNERSHIP Maintenance Audit

Last updated: 2026-06-24

## Scope

- Security hardening
- Inefficient logic cleanup
- UI/UX consistency
- Reusability improvements

## Completed

- Added shared validation utilities for MM username, email, password policy text, and safe HTTP URL parsing.
- Introduced a dedicated `MmUsernameInput` component to unify MM ID input behavior.
- Normalized MM username handling across login, signup, and password reset flows.
- Added session payload expiry validation for user and admin signed cookies.
- Replaced temporary password generation based on `Math.random()` with `crypto.randomInt()`.
- Hardened image proxying:
  - reject unsafe URLs up front
  - block redirects
  - limit fetch time
  - enforce payload size after download as well
- Sanitized admin-supplied partner URLs and image URLs before persistence.
- Sanitized partner-facing outbound links before rendering.
- Optimized Mattermost user lookup by resolving the user first and then checking channel membership instead of scanning the full channel member list.
- Parsed SSAFY display names so certification UI shows the clean name only.
- Added signed short-lived certification QR issuance and a public verification page.
- Replaced remaining image preview `<img>` usage with `next/image`.
- Switched internal button navigation to shared client-side routing via the `Button` component.
- Reduced auth and suggestion flow full page reloads by using router navigation in client forms.
- Added a loading state to `UserMenu` to avoid login/signup flicker before session fetch completes.
- Removed stale Mattermost DM redirect environment configuration from runtime docs/config examples.
- Added server-side validation for category keys, hex color values, partner URLs, and reversed date ranges in admin actions.
- Ensured all admin write actions surface Supabase write failures instead of silently continuing.
- Revalidated partner detail routes after admin mutations so cached detail pages stay in sync.
- Reduced partner detail page data loading by resolving the category key in the partner query instead of doing a second category lookup.
- Added a reusable `FormMessage` component to remove duplicated auth form hint/error markup.
- Hardened new-tab external links by automatically applying `noopener noreferrer` in the shared button component.
- Removed unused Mattermost email/member-list helper functions left over from the older auth approach.
- Added an Admin member management section for member search/filter/read/update/delete operations.
- Synced `must_change_password` checks with the current member row so admin updates take effect on subsequent session reads.
- Split the Admin root into a dashboard entry page and dedicated member/partner management pages.
- Unified member profile handling around `campus` as the canonical location field and removed `region` usage from active flows.
- Delegated SSAFY Verify signup, profile lookup, directory lookup, profile sync, and Mattermost notification sending through Verify Server API instead of direct Mattermost credentials.
- Reduced SSAFY Verify auth UI diagnostic exposure so request ids and provider payload diagnostics stay in server logs unless explicit debug env is enabled.
- Added `members.avatar_url` so Verify `picture` URLs can render on signup, certification cards, and admin member views while older base64 avatars remain supported.
- Added `ssafy_verify_api_trace` auth/security logs for SSAFY Verify User Auth and Server API request/response summaries with secret redaction.
- Added SSAFY Verify notification status sync so Verify campaign status/recovery results update `notification_deliveries` and notification metadata through a cron route.
- Confirmed Chromatic/Storybook publish is manual-only while the free quota is exhausted, leaving local Storybook build/test as the release gate.
- Added the 2026-06-24 project completeness audit under `docs/operations/`.

## Remaining candidates

- Move repeated rate-limit table handling into a reusable repository/helper.
- Improve auth form UX with inline field-level validation states instead of message-only errors.
- Add stronger audit logging around admin mutations and auth-sensitive flows.
- Review remaining client components for possible server/client boundary simplification.
- Consider moving `/api/mm/session` lookup behind a server-provided header/session model to remove client fetches entirely.
- Re-measure public home, signup, certification, and partner detail routes after the Verify transition because auth/profile work moved to new server boundaries.
- Decide and apply the production admin edge perimeter value: `ADMIN_ALLOWED_IPS` or Basic Auth.
- Verify and remove legacy Mattermost env values from Vercel once rollback through direct Mattermost integration is no longer needed.

## Notes

- Current focus is defensive cleanup without changing the product model.
- Changes prefer low-risk refactors that reduce attack surface and duplicated logic first.
