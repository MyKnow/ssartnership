# Performance Tracking

Last updated: 2026-04-03

This folder tracks Vercel Speed Insights optimization work for SSARTNERSHIP.

Files:

- `before.md`: current baseline metrics captured before the next optimization cycle
- `audit.md`: project-wide bottleneck audit and prioritized improvement backlog
- `after.md`: iteration log for deployed changes and measured results after rollout

Rules for updating:

1. Record the current Speed Insights numbers in `before.md` before making a new batch of changes.
2. Keep the backlog in `audit.md` ordered by expected impact on `TTFB`, `FCP`, `LCP`, and `INP`.
3. After deploy and traffic collection, append a new row to `after.md` with actual Vercel numbers.
