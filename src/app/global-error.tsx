"use client";

import { useEffect } from "react";
import AppErrorScreen from "@/components/errors/AppErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <AppErrorScreen
          code="500"
          title="앱을 불러오지 못했습니다"
          description="루트 레이아웃 처리 중 예외가 발생했습니다. 다시 시도하거나 홈으로 이동해 주세요."
          digest={error.digest}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
