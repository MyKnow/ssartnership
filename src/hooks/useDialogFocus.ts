"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  DIALOG_FOCUSABLE_SELECTOR,
  dialogStack,
  resolveDialogTabTarget,
} from "@/lib/dialog-focus";

export function getDialogFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      // display:none(반응형 숨김 등) 요소는 focus()가 무시되어 순환이 끊긴다.
      element.getClientRects().length > 0,
  );
}

/**
 * 모달 다이얼로그의 키보드 계약:
 * - 열릴 때 opener를 기억하고 `initialFocusRef` → 첫 조작 요소 → 컨테이너 순으로 초기 포커스
 * - Tab/Shift+Tab을 컨테이너 안에서 순환
 * - Escape로 `onClose` 호출(겹친 다이얼로그는 가장 위의 것만)
 * - 닫힐 때 opener로 포커스 복원
 *
 * 컨테이너는 `tabIndex={-1}`을 가져야 조작 요소가 없을 때도 포커스를 받는다.
 */
export function useDialogFocus({
  open,
  containerRef,
  onClose,
  initialFocusRef,
  restoreFocus = true,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const token = Symbol("dialog");
    dialogStack.push(token);
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const [firstFocusable] = getDialogFocusableElements(container);
      (initialFocusRef?.current ?? firstFocusable ?? container).focus({
        preventScroll: true,
      });
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialogStack.isTop(token)) {
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (event.key === "Escape") {
        if (!onCloseRef.current) {
          return;
        }
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const target = resolveDialogTabTarget(
        getDialogFocusableElements(container),
        active,
        event.shiftKey,
        container,
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      dialogStack.remove(token);
      if (restoreFocus && opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [containerRef, initialFocusRef, open, restoreFocus]);
}
