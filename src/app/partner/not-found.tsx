import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { TECH_SUPPORT_HREF } from "@/lib/support-mail";

/**
 * Renders inside `PartnerPortalShellView` for `notFound()` in partner routes,
 * keeping partner navigation instead of the public site 404.
 */
export default function PartnerNotFound() {
  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <Card tone="elevated" className="mx-auto grid w-full max-w-xl gap-5">
        <div className="grid gap-2">
          <p className="ui-kicker">404</p>
          <h1 className="ui-section-title text-ko-title">
            요청한 파트너 화면을 찾을 수 없습니다
          </h1>
          <p className="ui-body text-ko-pretty">
            삭제되었거나 접근 권한이 없는 파트너사·제휴처일 수 있습니다. 파트너 홈에서
            다시 선택해 주세요.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button href={TECH_SUPPORT_HREF} variant="secondary" className="w-full sm:w-auto">
            기술 지원
          </Button>
          <Button href="/partner" className="w-full sm:w-auto">
            파트너 홈
          </Button>
        </div>
      </Card>
    </Container>
  );
}
