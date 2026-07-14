---
name: member-required-gate-redirects
description: Implement or review member login, forced password change, policy consent, profile-photo submission, or returnTo redirects in ssartnership. Use when a required member step can overlap another, a redirect loop occurs, or a new gate is added.
---

# Member Required Gate Redirects

Use the canonical member-gate policy below. Keep its decision logic in `src/lib/member-required-gates.ts`; do not recreate precedence in individual pages or client forms.

## Canonical policy

Resolve required member gates in this exact order:

1. Forced password change (`mustChangePassword`)
2. Required policy consent (`requiresConsent`)
3. Required profile-photo submission (`requiresProfilePhotoUpdate`)
4. The validated original destination

Treat a forced password change as a security control. Never render consent or photo submission ahead of it when both conditions are true.

## Route implementation

- Use `getMemberRequiredGateRedirect` in server layouts/pages, login-completion clients, and `proxy.ts` when the available session state can require a gate.
- Pass the actual current request path as `currentPath` and the original destination as `returnTo`.
- Preserve the original destination when redirecting from an edge/proxy layer; do not replace a route with a gate URL and discard its path or query.
- Let a route that already owns the highest-priority gate render instead of redirecting to itself.
- Keep gate paths explicit: `/auth/change-password`, `/auth/consent`, and `/certification/photo`.

## `returnTo` boundary

- Accept `returnTo` only through `sanitizeReturnTo` or the member-gate helper.
- Reject external origins, protocol-relative URLs, malformed values, and non-path values by falling back to `/`.
- Do not use framework-internal headers such as `next-url` as a source of the original request path. Use the trusted `x-ssartnership-request-path` set in `src/proxy.ts`.
- Never use the active gate URL as a completion destination. Call `getMemberGateCompletionReturnTo` after a password, consent, or photo mutation.

## Completion behavior

- Complete the current mutation first and then navigate once to the sanitized original destination.
- Let the server-side gate resolver select any remaining lower-priority step on the next request.
- Do not use timer-based retries, repeated `router.refresh()` calls, or client-side loops to wait for a gate state change.

## Required regression coverage

Add or update focused Node tests in `tests/member-required-gates.test.mts` whenever this flow changes. Cover every combination of password, consent, and photo requirements; priority; self-redirect prevention; unsafe `returnTo`; and valid path/query preservation.
