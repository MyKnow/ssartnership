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
      <Container className="pb-12 pt-8 sm:pb-14 sm:pt-10">
        <Card
          tone="elevated"
          className="relative mx-auto grid max-w-[min(42rem,calc(100vw-1.5rem))] gap-5 overflow-hidden p-5 sm:gap-6 sm:p-6"
          data-partner-detail-summary
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_42%)]"
          />
          <div className="relative flex flex-col gap-5 sm:gap-6">

            <div className="grid gap-12">
              <h1 className="ui-page-title">SSAFY 구성원만 열람할 수 있는 혜택입니다</h1>
              <p className="ui-body max-w-xl">
                로그인하거나 회원가입을 완료하면 이 페이지로 돌아옵니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Button href={signupHref} variant="primary">
                회원가입
              </Button>
              <Button href={loginHref} variant="ghost">
                로그인
              </Button>
            </div>
          </div>
        </Card>
      </Container>
    </div>
  );
}
