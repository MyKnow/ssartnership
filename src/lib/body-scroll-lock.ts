/**
 * 여러 오버레이가 동시에 body 스크롤을 잠글 때 쓰는 ref-count 잠금.
 *
 * 컴포넌트마다 `previousOverflow`를 저장했다가 복원하면, 겹쳐 열린 오버레이 중
 * 먼저 열린 쪽이 먼저 닫힐 때 아직 열린 오버레이 아래에서 스크롤이 풀린다.
 * 첫 잠금이 원래 값을 기억하고, 마지막 해제만 그 값을 복원한다.
 */
export type ScrollLockStyleTarget = {
  style: { overflow: string };
};

export type ScrollLockRegistry = {
  /** 잠금을 걸고, 정확히 한 번만 효과가 있는 해제 함수를 돌려준다. */
  acquire(target: ScrollLockStyleTarget): () => void;
  readonly activeCount: number;
};

export function createScrollLockRegistry(): ScrollLockRegistry {
  let activeCount = 0;
  let lockedTarget: ScrollLockStyleTarget | null = null;
  let restoreOverflow = "";

  return {
    acquire(target) {
      if (activeCount === 0) {
        lockedTarget = target;
        restoreOverflow = target.style.overflow;
        target.style.overflow = "hidden";
      }
      activeCount += 1;

      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        activeCount -= 1;
        if (activeCount === 0 && lockedTarget) {
          lockedTarget.style.overflow = restoreOverflow;
          lockedTarget = null;
          restoreOverflow = "";
        }
      };
    },
    get activeCount() {
      return activeCount;
    },
  };
}

/** 앱 전역 body 스크롤 잠금. 직접 쓰지 말고 `useBodyScrollLock`을 쓴다. */
export const bodyScrollLockRegistry = createScrollLockRegistry();
