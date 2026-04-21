import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import { getHeaderSession } from "@/lib/header-session";

export default async function NotFound() {
  const headerSession = await getHeaderSession();

  return (
    <>
      <SiteHeader initialSession={headerSession} />
      <main className="flex min-h-[calc(90vh-5rem)] items-center justify-center px-3 py-6 sm:px-4">
        <Card tone="elevated" className="w-full max-w-xl">
          <div className="grid gap-4 text-center sm:text-left">
            <div className="grid gap-2">
              <p className="ui-kicker">404</p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                페이지를 찾을 수 없습니다
              </h1>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                주소가 변경되었거나, 삭제되었거나, 잘못 입력되었을 수 있습니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button href="/" variant="primary" className="w-full sm:w-auto">
                홈으로 이동
              </Button>
            </div>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
