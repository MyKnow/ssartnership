"use client";

import { useEffect } from "react";
import { bodyScrollLockRegistry } from "@/lib/body-scroll-lock";

/**
 * `active`인 동안 body 스크롤을 잠근다. 겹쳐 열린 오버레이는 ref-count로
 * 합산되어 마지막 오버레이가 닫힐 때만 원래 overflow가 복원된다.
 * 오버레이 안의 스크롤 영역에는 `overscroll-contain`을 함께 붙여 스크롤 체이닝을 막는다.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    return bodyScrollLockRegistry.acquire(document.body);
  }, [active]);
}
