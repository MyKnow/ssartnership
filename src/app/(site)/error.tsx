"use client";

import { useEffect } from "react";
import AppErrorScreen from "@/components/errors/AppErrorScreen";

/**
 * Keeps the public site shell (MobileNav, Footer) mounted when a page in the
 * `(site)` group throws. Exceptions thrown by the group layout itself still
 * fall through to the root `error.tsx`.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <AppErrorScreen
        layout="embedded"
        code="500"
        title="화면을 불러오지 못했습니다"
        description="일시적인 문제로 이 화면을 표시하지 못했습니다. 다시 시도하거나 홈으로 이동해 주세요."
        digest={error.digest}
        onRetry={retry}
      />
    </main>
  );
}
