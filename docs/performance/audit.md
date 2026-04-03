# Project-wide Performance Audit

Reviewed: 2026-04-03

## Highest-impact findings

### P1. Public home bundle is larger than necessary

- [`src/components/HomeView.tsx`](/Users/myknow/coding/ssartnership/src/components/HomeView.tsx) is a large client boundary for the main landing page.
- Public card rendering now lives in [`src/components/PartnerCardView.tsx`](/Users/myknow/coding/ssartnership/src/components/PartnerCardView.tsx) and admin editing lives in [`src/components/PartnerCardForm.tsx`](/Users/myknow/coding/ssartnership/src/components/PartnerCardForm.tsx).
- Result: the public landing page no longer needs to ship admin form code, which should help `FCP`, `LCP`, and `INP`.

### P1. Home filtering recomputes too much work per interaction

- [`src/components/HomeView.tsx`](/Users/myknow/coding/ssartnership/src/components/HomeView.tsx) now precomputes normalized partner search data separately and uses deferred search input before filtering.
- This directly targets `INP`, especially on mobile devices with a larger partner list.

### P2. Some global UI remains client-only when only a small part needs it

- [`src/components/Footer.tsx`](/Users/myknow/coding/ssartnership/src/components/Footer.tsx) now renders as a server component and only [`src/components/PwaInstallButton.tsx`](/Users/myknow/coding/ssartnership/src/components/PwaInstallButton.tsx) stays client-side.
- This removes a low-value client boundary from every public route.

### P2. Public layout still performs session-aware work on every site page

- [`src/app/(site)/layout.tsx`](/Users/myknow/coding/ssartnership/src/app/(site)/layout.tsx) calls [`src/lib/user-auth.ts`](/Users/myknow/coding/ssartnership/src/lib/user-auth.ts) to enforce password-change redirects.
- This is functionally useful, but it should be reviewed because public routes inherit that cost.
- Tradeoff: simplifying this path can improve `TTFB`, but must not regress `must_change_password` enforcement.

### P3. Partner images use a server proxy hop

- [`src/app/api/image/route.ts`](/Users/myknow/coding/ssartnership/src/app/api/image/route.ts) protects remote image loading and adds caching, but it is still an extra hop before the image reaches the browser.
- This should be measured against real LCP candidates before changing it because the safety model is valuable.

## Planned optimization order

1. Re-measure Speed Insights after deploying the first bundle-slimming batch.
2. Revisit site-layout session enforcement only if `TTFB` remains stubbornly high.
3. Measure whether the image proxy path is affecting real `LCP` candidates before changing it.
