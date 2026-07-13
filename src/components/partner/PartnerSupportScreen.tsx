import PartnerSupportRequestPanel from "@/components/partner/PartnerSupportRequestPanel";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";

export type PartnerSupportScreenProps = {
  to: string;
  siteName: string;
  companyName: string;
  brandNames: string;
  displayName: string;
  loginId: string;
  currentUrl: string;
};

export default function PartnerSupportScreen(
  props: PartnerSupportScreenProps,
) {
  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <ShellHeader
          eyebrow="Support"
          title="기술 지원"
          description="파트너 포털 이용 중 문제가 있거나 계정 지원이 필요하면 아래 템플릿으로 문의해 주세요."
        />
        <Card className="space-y-4 xl:sticky xl:top-24">
          <p className="ui-kicker">운영 안내</p>
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>제휴처 정보 수정은 해당 제휴처 상세의 수정 요청에서 처리합니다.</p>
            <p>로그인, 초기 설정, 알림 수신 문제는 아래 템플릿으로 문의합니다.</p>
          </div>
        </Card>
        <div className="min-w-0 xl:col-span-2">
          <PartnerSupportRequestPanel {...props} />
        </div>
      </div>
    </Container>
  );
}
