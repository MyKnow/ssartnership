import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getHeaderSession } from "@/lib/header-session";

export default async function PartnerDetailNotFound() {
  const headerSession = await getHeaderSession();

  return (
    <>
      <SiteHeader initialSession={headerSession} />
      <main className="flex min-h-[calc(90vh-5rem)] items-center justify-center px-3 py-6 sm:px-4">
        <Card tone="elevated" className="w-full max-w-xl">
          <div className="grid gap-4 text-center sm:text-left">
            <div className="grid gap-2">
              <p className="ui-kicker">Partner Detail</p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                제휴 정보를 찾을 수 없습니다
              </h1>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                주소가 잘못되었거나 제휴 정보가 비공개 또는 종료 상태로 전환되었습니다.
                현재 공개된 제휴처는 홈에서 다시 확인해 주세요.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button href="/" variant="primary" className="w-full sm:w-auto">
                제휴처 목록 보기
              </Button>
            </div>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
