---
name: async-ui-actions
description: Use this skill when implementing or refactoring client-side asynchronous UI actions in this repo, especially optimistic updates, lazy background mutations, rollback on failure, duplicate-click guards, and non-blocking feedback for likes, reactions, toggles, favorites, hides, restores, and similar user interactions.
origin: learned
---

# Async UI Actions

Use this for client-side actions where the UI should react immediately and the server mutation can complete in the background.

Typical fits:

- review recommend/disrecommend
- favorite or bookmark toggles
- hide/restore actions
- quick status toggles
- lightweight admin/member/partner actions where the new state is obvious

Do not use this pattern when:

- the mutation result is not predictable before the server responds
- the action has destructive side effects that require confirmation first
- the server returns authoritative derived data that the UI cannot reconstruct safely

## Default Pattern

1. Capture the current item state before sending the request.
2. Apply an optimistic state update immediately.
3. Prevent duplicate submits for the same item while the request is in flight.
4. Send the mutation in the background.
5. If the request fails, rollback only the affected item and show a user-safe error.
6. If the request succeeds, either keep the optimistic state or reconcile with the server response.

Prefer item-scoped pending state over page-wide loading state.

## Repo Guidance

- Keep optimistic state logic near the feature component or in a small domain helper.
- If count or toggle math is reused, move it into `src/lib/<domain>/shared.ts` or the closest domain helper.
- Use `startTransition` for non-urgent list updates when the surrounding component already follows that pattern.
- Disable only the active control while its request is running. Do not block the whole page or section unless the entire dataset is being refreshed.
- Prefer keeping button text stable. Avoid replacing the control with a spinner for small toggle actions unless the user truly needs that feedback.

## Recommended Flow

```tsx
const previousItem = items.find((item) => item.id === targetId);
if (!previousItem || pendingId === targetId) {
  return;
}

setPendingId(targetId);
setErrorMessage(null);

startTransition(() => {
  setItems((current) =>
    current.map((item) =>
      item.id === targetId ? applyOptimisticChange(item, payload) : item,
    ),
  );
});

try {
  const response = await fetch("/api/...", { method: "PATCH" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    startTransition(() => {
      setItems((current) =>
        current.map((item) => (item.id === targetId ? previousItem : item)),
      );
    });
    setErrorMessage(data.message ?? "처리에 실패했습니다.");
    return;
  }

  startTransition(() => {
    setItems((current) =>
      current.map((item) => (item.id === targetId ? data.item ?? item : item)),
    );
  });
} finally {
  setPendingId(null);
}
```

## Review Checklist

- Does the clicked control update immediately?
- Is duplicate clicking blocked for the same item?
- Is rollback scoped to the affected item only?
- Does failure keep the rest of the list interactive?
- Is there still a user-visible error message on failure?
- Is the optimistic math centralized if reused?

## Verification

Prefer focused checks:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
```

When the flow is critical or easy to regress, add or update a focused interaction test.
