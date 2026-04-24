---
name: tailwind-production-css
description: Diagnose and fix Tailwind CSS v4 production-only styling failures in Next.js/Vercel, including missing utility CSS, CSS optimizer warnings, Turbopack/source detection issues, and Preview deployments that look unstyled while local dev looks correct.
origin: learned
---

# Tailwind Production CSS

Use this when a Next.js/Vercel Preview or production deployment looks like CSS is missing, while local dev appears normal.

## Fast Diagnosis

1. Confirm whether CSS is missing or incomplete.
   - Fetch the deployed HTML and identify the linked `/_next/static/...css` file.
   - Fetch that CSS file directly.
   - Check for core utilities that appear in HTML, such as `.flex`, `.grid`, `.bg-background`, `.text-foreground`, `.px-3`.

2. Treat these as different problems:
   - CSS request is `404`/blocked: routing, asset, CDN, or deploy issue.
   - CSS request is `200` but utilities are missing: Tailwind source detection issue.
   - CSS request is `200` and utilities exist: browser/service-worker/cache or runtime class mismatch.

3. Do not over-index on `/manifest.webmanifest` or `/sw.js` returning `304`.
   - `304` is normal revalidation.
   - Only suspect `sw.js` if it has a `fetch` handler that caches or rewrites `/_next/static/*`.

## Next.js + Tailwind v4 Source Detection Fix

Tailwind v4 uses automatic source detection. In Next/Turbopack/Vercel, production builds can miss app sources or scan the wrong root, especially after config/root changes.

In `src/app/globals.css`, prefer an explicit source root:

```css
@import "tailwindcss";
@source "..";
```

For this project, `globals.css` lives in `src/app`, so `source("..")` points to `src`. This makes Tailwind scan `src/app`, `src/components`, `src/lib`, and related app source reliably.

The inline import form also works in Tailwind builds, but can trigger editor CSS diagnostics such as `semi-colon expected`:

```css
@import "tailwindcss" source("..");
```

Avoid this incorrect form here:

```css
@import "tailwindcss" source("./src");
```

From `src/app/globals.css`, `./src` resolves to `src/app/src`, which does not exist and fails production build.

Use `source(none)` only with care. If used incorrectly, it can make builds hang or produce almost-empty CSS unless every source is explicitly registered.

## Build Verification

Run production build outside restrictive sandboxing when local sandbox hides the real error:

```bash
npm run build
```

After build, inspect generated CSS:

```bash
rg -n --hidden '\.flex\{|\.grid\{|\.bg-background\{|\.text-foreground\{' .next/static .next/server
rg -n --hidden 'shadow-\\\[var\\\(--shadow-|rounded-\\\[var\\\(--radius-' .next/static .next/server
```

Expected:
   - Core utilities exist in `.next/static/...css`.
   - Old problematic arbitrary tokens are absent or intentionally limited.
   - `next build` has no "Found N warnings while optimizing generated CSS" block.

## Common Root Causes

- Tailwind scans docs or generated artifacts that contain example classes.
  - Replace old examples like `shadow-[var(--shadow-raised)]` with semantic classes such as `shadow-raised`.
- The source root is wrong because CSS lives under `src/app`.
  - Use `source("..")`, not `source("./src")`.
- Dev server hides the issue because dev and production CSS generation paths differ.
  - Trust `next build` and deployed CSS inspection over `next dev`.
- Browser cache or service worker is suspected too early.
  - First prove whether the deployed CSS file contains the expected utilities.

## Deployment Verification

For Vercel:

1. Confirm the branch alias points to the expected commit.
2. Open the immutable deployment URL, not only the branch alias.
3. Fetch the deployment CSS file and check content, not just status code.
4. If CSS is correct in the immutable URL but broken only in the browser, clear site data and unregister service workers.

## Project Pattern

This project uses semantic CSS utilities in `src/app/globals.css`:

- `shadow-flat`, `shadow-raised`, `shadow-floating`, `shadow-overlay`
- `rounded-input`, `rounded-card`, `rounded-panel`, `rounded-overlay`
- `transition-field`, `transition-surface`, `transition-interactive`
- `pt-safe-top`, `pb-safe-bottom-4`, `min-safe-site-header`, `bottom-safe-bottom-6`

Prefer these over fragile arbitrary classes for shared design tokens.
