# Speed Insights Baseline

Captured: 2026-04-03
Source: Vercel Speed Insights screenshot provided by the operator

## Current score

| Metric | Baseline |
| --- | ---: |
| Real Experience Score | 66 |
| First Contentful Paint | 2.49s |
| Largest Contentful Paint | 2.8s |
| Interaction to Next Paint | 872ms |
| Cumulative Layout Shift | 0 |
| First Input Delay | 30ms |
| Time to First Byte | 1.66s |

## Interpretation

- `TTFB` is too high for a content-led landing page and likely pushes `FCP` and `LCP` up with it.
- `INP` is the clearest interaction problem and points to too much client work during filtering, navigation, or hydration.
- `CLS` is already good, so layout stability is not the priority.

## Current optimization objective

1. Bring `TTFB` under `1.0s`.
2. Bring `FCP` close to `1.8s`.
3. Bring `LCP` close to `2.2s`.
4. Bring `INP` under `300ms`.
