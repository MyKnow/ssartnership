"use client";

import { useEffect } from "react";
import AppErrorScreen from "@/components/errors/AppErrorScreen";

/**
 * Renders inside `PartnerPortalShellView`, which already owns the main
 * landmark, so partner navigation stays available after a page exception.
 */
export default function PartnerError({
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
      layout="embedded"
      code="500"
      title="파트너 화면을 불러오지 못했습니다"
      description="일시적인 문제로 이 화면을 표시하지 못했습니다. 다시 시도하거나 파트너 홈으로 이동해 주세요."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
