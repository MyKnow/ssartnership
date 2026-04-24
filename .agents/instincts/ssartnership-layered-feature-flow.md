---
id: ssartnership-layered-feature-flow
trigger: "when adding or changing a feature"
confidence: 0.86
domain: architecture
source: local-repo-analysis
analyzed_commits: 200
---

# Change Feature Layers Together

## Action

For feature work, check the route/page, components, lib/domain helpers, repository interfaces, mock repository, Supabase repository, migration, schema snapshot, and focused tests as one flow.

## Evidence

In the last 200 commits, `src/app` and `src/components` changed together frequently, as did `src/app` and `src/lib`. Data features repeatedly touched `supabase/migrations`, `supabase/schema.sql`, repositories, pages, and components together.
