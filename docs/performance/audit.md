# Project-wide Performance Audit

Reviewed: 2026-04-10

## Highest-impact findings

### P1. Public home bundle is larger than necessary

- [`src/components/HomeView.tsx`](/Users/myknow/coding/ssartnership/src/components/HomeView.tsx) is still the large client boundary for filters and cards, but the shell around it now streams separately through [`src/components/HomeContent.tsx`](/Users/myknow/coding/ssartnership/src/components/HomeContent.tsx).
- Public hero/header/push-opt-in content now renders outside the heavy client boundary in [`src/app/(site)/page.tsx`](/Users/myknow/coding/ssartnership/src/app/(site)/page.tsx) and [`src/components/HomePushOptInBannerGate.tsx`](/Users/myknow/coding/ssartnership/src/components/HomePushOptInBannerGate.tsx).
- [`src/components/loading/SitePageSkeletons.tsx`](/Users/myknow/coding/ssartnership/src/components/loading/SitePageSkeletons.tsx) now uses a static header placeholder and a slimmer home grid, so the loading state does less work before the real page arrives.
- Result: the page should start painting earlier, and client hydration is concentrated in the interactive list instead of the whole landing shell.

### P1. Home filtering recomputes too much work per interaction

- [`src/components/HomeView.tsx`](/Users/myknow/coding/ssartnership/src/components/HomeView.tsx) now precomputes normalized partner search data separately and uses deferred search input before filtering.
- This directly targets `INP`, especially on mobile devices with a larger partner list.

### P2. Some global UI remains client-only when only a small part needs it

- [`src/components/Footer.tsx`](/Users/myknow/coding/ssartnership/src/components/Footer.tsx) now renders as a server component and only [`src/components/PwaInstallButton.tsx`](/Users/myknow/coding/ssartnership/src/components/PwaInstallButton.tsx) stays client-side.
- [`src/components/SiteHeader.tsx`](/Users/myknow/coding/ssartnership/src/components/SiteHeader.tsx) is still client-only because auto-hide, theme toggle, mobile nav, and user menu live together.
- This is a reasonable tradeoff for now, but it remains a candidate if hydration cost still matters after the home-shell split.

### P2. Public layout still performs session-aware work on every site page

- [`src/app/(site)/layout.tsx`](/Users/myknow/coding/ssartnership/src/app/(site)/layout.tsx) calls [`src/lib/user-auth.ts`](/Users/myknow/coding/ssartnership/src/lib/user-auth.ts) to enforce password-change redirects.
- Required policy lookup is now cached and the member lookup runs in parallel with it, but public routes still inherit the member DB read.
- Tradeoff: simplifying this path further can improve `TTFB`, but must not regress `must_change_password` enforcement or member deletion handling.

### P2. Certification entry no longer waits for Mattermost profile sync

- [`src/app/(site)/certification/page.tsx`](/Users/myknow/coding/ssartnership/src/app/(site)/certification/page.tsx) now renders the current member row immediately instead of waiting for a profile refresh round-trip.
- [`src/components/certification/CertificationProfileSync.tsx`](/Users/myknow/coding/ssartnership/src/components/certification/CertificationProfileSync.tsx) defers the sync to a background POST after mount, so the first paint is no longer blocked by Mattermost avatar/profile fetches.
- [`src/app/api/mm/profile-sync/route.ts`](/Users/myknow/coding/ssartnership/src/app/api/mm/profile-sync/route.ts) keeps the sync work and audit log in a separate request boundary.

### P3. Partner images use a server proxy hop

- [`src/app/api/image/route.ts`](/Users/myknow/coding/ssartnership/src/app/api/image/route.ts) protects remote image loading and adds caching, but it is still an extra hop before the image reaches the browser.
- [`src/components/PartnerImageCarousel.tsx`](/Users/myknow/coding/ssartnership/src/components/PartnerImageCarousel.tsx) now preloads the full image set, shows a skeleton until preload settles, and uses direct proxy URLs so manual focus swaps feel immediate.
- This should be measured against real LCP candidates before changing it because the safety model is valuable.

### P3. Image proxy now resolves and connects by public IP

- [`src/app/api/image/route.ts`](/Users/myknow/coding/ssartnership/src/app/api/image/route.ts) now delegates to [`src/lib/image-proxy.ts`](/Users/myknow/coding/ssartnership/src/lib/image-proxy.ts), which resolves hostnames to public IPs first and then connects to that resolved address.
- That closes the obvious localhost/private-literal path and makes DNS rebinding much harder because the request no longer depends on a second implicit hostname resolution at fetch time.

## Planned optimization order

1. Re-measure Speed Insights after deploying the home-shell split, loading skeleton trim, and policy/session cache batch.
2. Revisit site-layout session enforcement only if `TTFB` remains stubbornly high after the session/policy cache batch.
3. Measure whether the image proxy path is affecting real `LCP` candidates before changing it.
