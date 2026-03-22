import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import SuggestForm from "@/components/SuggestForm";

export const metadata = {
  title: "제휴 제안하기 - SSARTNERSHIP",
  description: "SSAFY 제휴 제안을 남겨주세요.",
};

export default function SuggestPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader suggestHref="/suggest" />
      <main>
        <Container className="pb-16 pt-10">
          <SectionHeading
            title="제휴 제안하기"
            description="파트너십 제안 내용을 작성해 주세요. 제출 시 사본이 입력한 담당자 이메일로 발송됩니다."
          />
          <Card className="mt-6">
            <SuggestForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
