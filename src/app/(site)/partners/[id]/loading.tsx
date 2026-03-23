import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";

export default function PartnerDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <div className="flex flex-col gap-6">
            <Card className="flex items-center gap-3 p-6">
              <Spinner className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                파트너 정보를 불러오는 중입니다.
              </p>
            </Card>
            <div className="grid gap-4">
              <div className="h-56 rounded-2xl border border-border bg-surface-muted" />
              <div className="h-40 rounded-2xl border border-border bg-surface-muted" />
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
