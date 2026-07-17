# SSARTNERSHIP Security Policy

SSARTNERSHIP is a public repository and production service for SSAFY member
partnership operations. Please report suspected security issues privately before
sharing details in public issues, discussions, pull requests, or social channels.

## Reporting

Email reports to `myknow@ssafy.com` with the subject prefix `[SSARTNERSHIP Security]`.

Include:

- Affected URL, API route, or repository path
- Reproduction steps and expected impact
- Any request IDs or timestamps that help locate server logs
- Whether personal data, credentials, tokens, or private member information may be affected

Do not include more personal data than is necessary to demonstrate the issue.

## Safe Testing

- Do not access, modify, delete, or exfiltrate another user's personal data.
- Do not run denial-of-service, spam, credential stuffing, or destructive tests.
- Do not attempt to bypass Supabase, Vercel, or Mattermost controls beyond the minimum proof needed for the report.
- Stop testing and report immediately if you encounter secrets, service-role keys, private tokens, production database URLs, or member data.

## Response

This project is operated by a small team. Security reports are triaged as soon as
possible, with credential rotation and mitigation prioritized for confirmed
exposure of secrets, authentication bypasses, authorization bypasses, and personal
data leaks.
