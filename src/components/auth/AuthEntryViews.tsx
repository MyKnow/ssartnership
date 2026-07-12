import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";
import PasswordResetMethodTabs from "@/components/auth/PasswordResetMethodTabs";
import SsafyVerifyButton from "@/components/auth/SsafyVerifyButton";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";

export function LoginPageView({ returnTo }: { returnTo: string }) {
  const signupHref = `/auth/signup?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main>
      <Container className="pb-16 pt-10">
        <div className="mx-auto min-w-0 max-w-lg">
          <Card className="min-w-0 p-6" data-testid="password-login-card">
            <h1 className="text-ko-title text-2xl font-semibold text-foreground">
              로그인
            </h1>
            <LoginForm returnTo={returnTo} />
          </Card>
          <div
            role="separator"
            aria-label="다른 로그인 방법"
            className="mt-6 flex items-center gap-3"
          >
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">또는</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-2">
            <Button variant="secondary" href={signupHref}>
              회원가입
            </Button>
            <SsafyVerifyButton
              className="mt-0"
              returnTo={returnTo}
              label="SSAFY Verify로 시작하기"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}

export function ResetPasswordPageView() {
  return (
    <main>
      <Container className="pb-16 pt-10">
        <Card className="mx-auto min-w-0 max-w-lg p-6">
          <h1 className="text-ko-title text-2xl font-semibold text-foreground">
            비밀번호 재설정
          </h1>
          <PasswordResetMethodTabs />
        </Card>
      </Container>
    </main>
  );
}

export function SignupPageView({ returnTo }: { returnTo: string }) {
  const graduateHref = `/auth/signup/graduate?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main>
      <Container className="pb-16 pt-10">
        <Card className="mx-auto min-w-0 max-w-lg p-6">
          <h1 className="text-ko-title text-2xl font-semibold text-foreground">
            회원가입
          </h1>
          <div
            role="tablist"
            aria-label="회원가입 유형"
            className="mt-6 grid grid-cols-2 gap-2 rounded-[1.35rem] border border-border bg-surface-inset p-2"
          >
            <span
              role="tab"
              aria-selected="true"
              className="inline-flex min-h-11 items-center justify-center rounded-[0.95rem] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-raised"
            >
              운영진·재학생
            </span>
            <Link
              role="tab"
              aria-selected="false"
              href={graduateHref}
              className="inline-flex min-h-11 items-center justify-center rounded-[0.95rem] px-3 text-sm font-semibold text-foreground transition hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              수료생
            </Link>
          </div>
          <div className="mt-5">
            <SsafyVerifyButton returnTo={returnTo} label="SSAFY Verify로 시작하기" />
          </div>
        </Card>
      </Container>
    </main>
  );
}
