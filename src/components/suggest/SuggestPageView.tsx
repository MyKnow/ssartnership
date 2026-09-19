import SuggestForm from "@/components/SuggestForm";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";

export default function SuggestPageView() {
  return (
    <main>
      <Container className="pb-16 pt-8 sm:pt-10" size="wide">
        <div className="mx-auto max-w-5xl space-y-5">
          <ShellHeader
            eyebrow="Suggestion"
            title="제휴 제안"
            description="SSAFY 구성원이 실제로 사용할 수 있는 혜택을 제안해 주세요."
            className="px-5 py-5 sm:px-6 sm:py-6"
          />
          <Card tone="elevated" padding="md" className="min-w-0">
            <SuggestForm />
          </Card>
        </div>
      </Container>
    </main>
  );
}
