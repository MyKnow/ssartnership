---
name: ssartnership-ui-ux
description: Design, implement, or review ssartnership UI changes that need the project's visual system, Korean responsive QA, state-transition routing, form recovery, Storybook promotion, or prototype handling.
---

# Ssartnership UI/UX

Use this skill for any UI creation, revision, or review in this repository. Apply the local `frontend-design`, `frontend-patterns`, `design-system`, `browser-qa`, and Korean responsive skills through this project-specific overlay.

## Source Of Truth

Read these before changing a visual surface:

- `docs/design-system/README.md` and the linked foundation, component, and layout rules
- `src/app/globals.css` for tokens and typography
- `src/components/ui/` for reusable primitives and Storybook contracts
- `docs/product/screen-specs/` for route-level information hierarchy and states

Keep the navy/slate system, Pretendard-based Korean typography, centered shell, calm surface hierarchy, and restrained motion. Use existing primitives before page-local styling.

## Design Brief For Every UI Change

Write a micro brief before coding:

```text
User and single action:
Surface and existing-system constraint:
What changes and why:
Generic-pattern check:
```

For a new surface, redesign, or information-architecture change, extend it with token roles, type hierarchy, layout sketch, one functional signature, and a self-critique. Keep the global system stable; spend visual boldness on one screen-specific element that improves comprehension or action.

## Implementation Rules

- Preserve `page -> panel -> elevated card -> inset block -> control` hierarchy.
- Do not add arbitrary raw colors, radii, shadows, nested cards, decorative gradients, or duplicate primary actions.
- Use natural Korean wrapping for prose; constrain machine values separately. Add `min-w-0` and shrink-safe grid tracks where text can overflow.
- Pair every changed interaction with loading, empty, error, and disabled/pending behavior as applicable.
- Use concise, action-based Korean copy. An error states what happened and what the user can do next; it never exposes internal details.

## State Changes, Errors, And Routing

- Keep domain state transitions and recoverable errors outside page components when they grow beyond rendering.
- Use `throw new Error` only for invariant violations or unrecoverable system faults. Map expected validation, authorization, not-found, and domain failures to safe error codes, inline messages, and first-invalid-field focus.
- Use `router.push` for a deliberate new destination, `router.replace` for completion, canonical URLs, and URL-state replacement, server `redirect` for access control, and `router.refresh` only to revalidate an existing route.
- Complete a mutation first, then navigate once. Do not poll or loop `router.refresh()` while waiting for state.
- Preserve validated `returnTo` values and list query context. Delegate member password, consent, and photo gates to `member-required-gate-redirects`; do not duplicate their priority logic.

## Prototype Promotion

- Promote reusable component or flow candidates to Storybook with deterministic mock scenarios.
- Keep disposable visual and generative experiments in `.tmp/ui-prototypes/`; never stage them.
- Use `.tmp/ui-qa/` for accepted screenshots; never stage them.
- Reimplement approved prototype choices with Next.js, Tailwind, the existing tokens, repository boundaries, and normal tests.

## Korean Responsive QA

- For this repository, use `src/lib/mock/scenarios/` and repository mocks instead of production data in stories or screenshots. `registry.ts`, `route-inventory.ts`, `storybook-coverage.ts`, and `required-states.ts` are the stable scenario, ownership, coverage, and viewport records.
- Cover relevant `default`, `empty`, `many`, `longKorean`, `loading`, `error`, and `unauthorized` states.
- Capture the affected surface at 360px, 820px, and 1366px at minimum; add 320px, 390px, or breakpoint-sensitive widths when the surface is dense, form-heavy, table-like, or modal-like.
- Treat document overflow, severe Korean line breaks, missing core story states, and PII in fixtures/screenshots as blockers.
