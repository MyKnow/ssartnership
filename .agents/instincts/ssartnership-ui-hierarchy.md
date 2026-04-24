---
id: ssartnership-ui-hierarchy
trigger: "when editing UI or Tailwind styling"
confidence: 0.82
domain: frontend
source: local-repo-analysis
analyzed_commits: 200
---

# Preserve The UI Hierarchy

## Action

Use existing primitives and the repo's visual hierarchy before adding new wrappers:

page background -> panel -> elevated card -> inset block -> control

Avoid nested cards, redundant wrappers, arbitrary shadows, and local one-off styling when `src/components/ui` can carry the pattern.

## Evidence

History includes repeated UI refactors across `src/components/ui`, `src/app/globals.css`, `docs/design-system`, admin pages, partner portal views, skeletons, and form components.
