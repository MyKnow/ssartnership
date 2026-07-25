"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";

export default function AdminProtectedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background py-10 sm:py-16">
      <Container size="narrow">
        <Card tone="elevated" className="grid gap-5 text-center">
          <div className="grid gap-2">
            <p className="ui-kicker">관리자 콘솔</p>
            <h1 className="ui-section-title text-ko-title">화면을 불러오지 못했습니다</h1>
            <p className="ui-body text-ko-pretty">
              일시적인 문제가 발생했습니다. 다시 시도하거나 관리자 홈으로 이동해 주세요.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>다시 시도</Button>
            <Button href="/admin" variant="secondary">관리 홈</Button>
          </div>
        </Card>
      </Container>
    </main>
  );
}
