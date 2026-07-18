import LoginForm from "@/components/auth/LoginForm";
import PasswordResetMethodTabs from "@/components/auth/PasswordResetMethodTabs";
import SignupMethodTabs, { type SignupMethod } from "@/components/auth/SignupMethodTabs";
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
          </div>
        </div>
      </Container>
    </main>
  );
}

export function ResetPasswordPageView({
  activeSenderGenerations = [],
}: {
  activeSenderGenerations?: readonly number[];
}) {
  return (
    <main>
      <Container className="pb-16 pt-10">
        <Card className="mx-auto min-w-0 max-w-lg p-6">
          <h1 className="text-ko-title text-2xl font-semibold text-foreground">
            비밀번호 재설정
          </h1>
          <PasswordResetMethodTabs activeSenderGenerations={activeSenderGenerations} />
        </Card>
      </Container>
    </main>
  );
}

export function SignupPageView({
  returnTo,
  initialMethod,
  activeSenderGenerations = [],
}: {
  returnTo: string;
  initialMethod?: SignupMethod;
  activeSenderGenerations?: readonly number[];
}) {
  return (
    <main>
      <Container className="pb-16 pt-10">
        <Card className="mx-auto min-w-0 max-w-lg p-6">
          <h1 className="text-ko-title text-2xl font-semibold text-foreground">
            회원가입
          </h1>
          <SignupMethodTabs
            returnTo={returnTo}
            initialMethod={initialMethod}
            activeSenderGenerations={activeSenderGenerations}
          />
        </Card>
      </Container>
    </main>
  );
}
