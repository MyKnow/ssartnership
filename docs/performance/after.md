# Speed Insights Improvement Log

Last updated: 2026-04-03

Use this file after each production deploy and enough real traffic has accumulated in Vercel Speed Insights.

## Iterations

| Iteration | Change set | RES | FCP | LCP | INP | CLS | FID | TTFB | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | Baseline before optimization | 66 | 2.49s | 2.8s | 872ms | 0 | 30ms | 1.66s | Screenshot captured on 2026-04-03 |
| 1 | Home bundle split + filtering optimization + footer boundary cleanup | pending | pending | pending | pending | pending | pending | pending | Code implemented on 2026-04-03, fill after deploy |

## Measurement checklist

1. Redeploy production.
2. Wait for Speed Insights to collect enough traffic.
3. Copy the numbers into the next iteration row.
4. Add a one-line note on what materially improved or stayed flat.
