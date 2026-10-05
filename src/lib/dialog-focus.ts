/**
 * 모달 다이얼로그 포커스 관리의 DOM 비의존 규칙.
 * DOM 연결은 `src/hooks/useDialogFocus.ts`가 맡는다.
 */
export const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Tab/Shift+Tab 입력에서 다이얼로그 안에 포커스를 가두기 위한 다음 대상.
 * `null`이면 브라우저 기본 이동을 그대로 둔다.
 */
export function resolveDialogTabTarget<T>(
  focusables: readonly T[],
  active: T | null,
  shiftKey: boolean,
  container: T,
): T | null {
  if (focusables.length === 0) {
    return container;
  }
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  if (active === null || !focusables.includes(active)) {
    return shiftKey ? last : first;
  }
  if (shiftKey && active === first) {
    return last;
  }
  if (!shiftKey && active === last) {
    return first;
  }
  return null;
}

/**
 * 겹쳐 열린 다이얼로그 중 가장 위의 것만 Escape·Tab을 처리하도록 순서를 기록한다.
 */
export function createDialogStack() {
  const entries: symbol[] = [];
  return {
    push(token: symbol) {
      entries.push(token);
    },
    remove(token: symbol) {
      const index = entries.lastIndexOf(token);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    },
    isTop(token: symbol) {
      return entries.length > 0 && entries[entries.length - 1] === token;
    },
    get size() {
      return entries.length;
    },
  };
}

export const dialogStack = createDialogStack();

/**
 * 공용 훅으로 관리되는 다이얼로그가 하나라도 열려 있는지.
 * 네이티브 `<dialog>` 메뉴처럼 자체 키 처리를 가진 상위 오버레이가
 * 그 위에 겹친 확인 모달의 Escape·Tab을 가로채지 않도록 확인한다.
 */
export function hasOpenManagedDialog() {
  return dialogStack.size > 0;
}
