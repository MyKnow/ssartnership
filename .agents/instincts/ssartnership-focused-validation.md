---
id: ssartnership-focused-validation
trigger: "after changing code"
confidence: 0.84
domain: verification
source: local-repo-analysis
analyzed_commits: 200
---

# Prefer Focused Validation

## Action

Run focused checks after changes:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --test tests/<focused-test>.test.mts
```

Use `next build` only for broad runtime/build changes or when requested.

## Evidence

Tests are concentrated in `tests/*.test.mts` around helpers, selectors, metrics, security, SEO, image proxy, partner portal, and repository-adjacent behavior.
