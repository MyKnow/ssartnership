# Admin Login Hardening

Updated: 2026-04-03

## Incident context

- Repeated attack attempts were observed against `/admin/login`.
- Confirmed payload families include SQLi-style strings, NoSQL operator-style parameter names, and reflected XSS probing.
- No confirmed admin takeover or successful login has been observed from the reviewed logs.

## Code-level findings

1. `/admin/login` did not use `dangerouslySetInnerHTML`, so direct reflected XSS execution was not confirmed.
2. The page still accepted arbitrary `error` and `id` query strings and echoed `id` back into the form.
3. Admin login credential checking did not touch SQL or NoSQL backends, so the observed SQLi and NoSQL payloads were not directly exploitable in the current path.
4. Admin throttling was IP-only. This was too weak for a sensitive login page.
5. Admin page view analytics included raw query strings, which could duplicate malicious payloads into logs.
6. Protected admin pages and admin APIs returned unauthenticated responses, but access-denied security events were not consistently logged.

## Hardening applied

- `error` query param is now restricted to a fixed enum.
- `id` query param is now sanitized and only echoed back when it matches the allowed admin identifier format.
- Suspicious query params and malformed form submissions are logged as blocked security events.
- Admin ID input is restricted to `3~64` chars of `A-Z a-z 0-9 . _ -`.
- Admin password input now rejects oversized or control-character payloads.
- Admin throttling now applies to both IP and account identifiers.
- Failed login attempts now incur a short server-side delay.
- Protected admin pages and admin APIs now log `admin_access` blocked events on unauthorized access.
- Admin page view analytics no longer store query strings.
- Optional edge protections were added through environment variables:
  - `ADMIN_ALLOWED_IPS`
  - `ADMIN_BASIC_AUTH_USERNAME`
  - `ADMIN_BASIC_AUTH_PASSWORD`

## Recommended operational settings

1. Set `ADMIN_ALLOWED_IPS` if the administrator IP range is stable.
2. Enable `ADMIN_BASIC_AUTH_USERNAME` and `ADMIN_BASIC_AUTH_PASSWORD` to add a second gate before `/admin/login`.
3. If the team has network support, prefer VPN or an internal access layer over a public admin login page.
4. Rotate `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` after repeated attack campaigns.
5. Consider replacing env-based admin login with an external IdP that supports MFA.
6. In Vercel, consider adding Firewall rules for the known abusive IP and narrowing access to admin paths.

## Remaining tradeoffs

- React escaping already reduced reflected XSS risk on `/admin/login`, but this hardening now removes reliance on that behavior.
- Optional IP allowlist and Basic Auth are disabled until the corresponding env vars are set.
- MFA is not implemented in this patch because the current admin auth model is a single env-based credential pair.
