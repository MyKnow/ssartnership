import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function AdminAccessDeniedNotice({
  returnTo,
}: {
  returnTo?: string | null;
}) {
  const safeReturnTo =
    returnTo === "/admin" || returnTo?.startsWith("/admin/")
      ? returnTo
      : null;

  return (
    <Card
      className="mx-auto w-full max-w-md text-center"
      tone="elevated"
      role="alert"
      aria-labelledby="admin-access-denied-title"
      aria-describedby="admin-access-denied-description"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h1
        id="admin-access-denied-title"
        className="mt-5 text-2xl font-semibold text-foreground"
      >
        관리자 권한이 없습니다
      </h1>
      <p
        id="admin-access-denied-description"
        className="mt-3 text-sm leading-6 text-muted-foreground"
      >
        로그인된 계정에 관리자 권한이 부여되어 있지 않습니다.
        관리자 접근이 필요하면 운영자에게 권한 부여를 요청해 주세요.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {safeReturnTo ? (
          <Button href={safeReturnTo} variant="soft">
            요청한 화면으로 돌아가기
          </Button>
        ) : null}
        <Button href="/" variant="secondary">
          홈으로 이동
        </Button>
      </div>
    </Card>
  );
}
