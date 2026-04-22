import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";

export default function PartnerDetailAccessGate({
  returnTo,
}: {
  returnTo: string;
}) {
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupHref = `/auth/signup?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <Card tone="elevated" className="mx-auto grid max-w-2xl gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700">대외비</Badge>
            <Badge className="bg-primary/10 text-primary">SSAFY 구성원 인증</Badge>
          </div>

          <div className="grid gap-3">
            <h1 className="ui-page-title">
              SSAFY 구성원 인증 후 열람 가능한 혜택입니다
            </h1>
            <p className="ui-body max-w-2xl">
              로그인 또는 회원가입을 완료하면 다시 이 혜택 페이지로 돌아옵니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button href={signupHref} variant="primary">
              회원가입
            </Button>
            <Button href={loginHref} variant="ghost">
              로그인
            </Button>
          </div>
        </Card>
      </Container>
    </div>
  );
}
