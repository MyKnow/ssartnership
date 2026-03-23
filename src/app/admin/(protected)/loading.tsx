import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Container className="pb-16 pt-10">
          <Card className="flex items-center gap-3 p-6">
            <Spinner className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              관리자 데이터를 불러오는 중입니다.
            </p>
          </Card>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="h-56 rounded-2xl border border-border bg-surface-muted" />
            <div className="h-56 rounded-2xl border border-border bg-surface-muted" />
          </div>
        </Container>
      </main>
    </div>
  );
}
