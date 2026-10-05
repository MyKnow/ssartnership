"use client";

import { useEffect } from "react";
import AppErrorScreen from "@/components/errors/AppErrorScreen";

export default function Error({
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
    <AppErrorScreen
      code="500"
      title="페이지를 불러오지 못했습니다"
      description="서버 처리 중 예외가 발생했습니다. 잠시 후 다시 시도하거나 홈으로 이동해 주세요."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
