import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPartnerCreateWorkspace, {
  type AdminPartnerCreateWorkspaceProps,
} from "@/components/admin/AdminPartnerCreateWorkspace";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StatsRow from "@/components/ui/StatsRow";

export default function AdminPartnerNewView(
  props: AdminPartnerCreateWorkspaceProps,
) {
  const { categoryOptions, companyOptions } = props;

  return (
    <section className="grid gap-6">
      <AdminPageHeader
        eyebrow="Partners"
        title="제휴처 추가"
        description="사용자에게 노출할 제휴처 정보와 혜택 조건을 입력하고 파트너사에 연결합니다."
      />
      <StatsRow
        items={[
          {
            label: "카테고리",
            value: `${categoryOptions.length}개`,
            hint: "선택 가능한 분류",
          },
          {
            label: "파트너사",
            value: `${companyOptions.length}개`,
            hint: "연결 가능한 계약 회사",
          },
        ]}
        minItemWidth="13rem"
      />
      {categoryOptions.length === 0 ? (
        <Card tone="elevated">
          <EmptyState
            title="먼저 카테고리를 추가해 주세요"
            description="제휴처를 추가하려면 최소 1개의 카테고리가 필요합니다."
          />
        </Card>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <section className="grid gap-4">
            <AdminSectionHeading
              title="제휴처 입력"
              description="혜택, 기간, CTA, 태그, 이미지까지 한 번에 입력합니다."
            />
            <AdminPartnerCreateWorkspace {...props} />
          </section>
          <Card tone="elevated" className="grid gap-3 2xl:sticky 2xl:top-24">
            <AdminSectionHeading
              title="입력 가이드"
              description="메인 폼을 넓게 쓰고, 보조 기준은 우측에 둡니다."
            />
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>카테고리와 파트너사를 먼저 선택한 뒤 기간과 CTA를 채우는 순서를 권장합니다.</p>
              <p>리스트 카드에서 바로 보이는 값은 썸네일, 혜택, 태그, 노출 상태입니다.</p>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
