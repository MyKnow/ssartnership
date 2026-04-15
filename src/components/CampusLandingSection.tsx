import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import Button from "@/components/ui/Button";
import type { CampusSlug } from "@/lib/campuses";

export default function CampusLandingSection({
  campuses,
}: {
  campuses: Array<{
    slug: CampusSlug;
    label: string;
    fullLabel: string;
    description: string;
    href: string;
    partnerCount: number;
  }>;
}) {
  return (
    <section className="mt-10 grid gap-5">
      <SectionHeading
        eyebrow="Campus Directory"
        title="캠퍼스별 제휴 둘러보기"
        description="서울, 구미, 대전, 부울경, 광주 캠퍼스 기준으로 제휴 혜택을 빠르게 찾아볼 수 있습니다."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {campuses.map((campus) => (
          <Card key={campus.slug} className="flex h-full flex-col gap-4" padding="md">
            <div className="space-y-2">
              <p className="ui-kicker">{campus.label}</p>
              <h3 className="ui-section-title text-xl">{campus.fullLabel}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {campus.description}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface-muted/60 px-4 py-3 text-sm text-muted-foreground">
              공개 제휴 {campus.partnerCount}건
            </div>
            <Button href={campus.href} variant="ghost" className="mt-auto w-full justify-center">
              {campus.fullLabel} 보기
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
