"use client";

import { useEffect } from "react";
import AppErrorScreen from "@/components/errors/AppErrorScreen";
import { useStoredResolvedTheme } from "@/hooks/useStoredResolvedTheme";
// global-error는 루트 layout을 대체하는 별도 문서라 루트 layout의 전역 CSS를 받지 못한다.
// 다른 오류 화면과 같은 토큰·타이포로 보이도록 루트 layout과 같은 순서로 직접 불러온다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // ThemeProvider 밖이라 next-themes가 html에 테마 클래스를 붙이지 못하므로,
  // 같은 저장 키·기본값으로 해석한 테마를 html에 직접 적용한다.
  const theme = useStoredResolvedTheme();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="ko"
      className={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        <AppErrorScreen
          code="500"
          title="앱을 불러오지 못했습니다"
          description="루트 레이아웃 처리 중 예외가 발생했습니다. 다시 시도하거나 홈으로 이동해 주세요."
          digest={error.digest}
          onRetry={retry}
        />
      </body>
    </html>
  );
}
