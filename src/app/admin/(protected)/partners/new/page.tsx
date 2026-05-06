import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateForm from "@/components/admin/AdminPartnerCreateForm";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizePartnerCompanies(value: unknown): PartnerCompanyRow[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as PartnerCompanyRow[];
  }
  if (typeof value === "object") {
    return [value as PartnerCompanyRow];
  }
  return [];
}

export default async function AdminPartnerNewPage() {
  const supabase = getSupabaseAdminClient();

  const [categoriesResult, companiesResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,created_at,updated_at")
      .order("name", { ascending: true }),
  ]);

  const categories = categoriesResult.data ?? [];
  const companies = normalizePartnerCompanies(companiesResult.data).map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
  }));
  const defaultCategoryId = categories[0]?.id ?? "";

  return (
    <AdminShell
      title="브랜드 추가"
      backHref="/admin/partners"
      backLabel="브랜드 관리"
    >
      <section className="grid gap-6">
        <ShellHeader
          eyebrow="Partners"
          title="브랜드 추가"
          description="브랜드 기본 정보와 노출 조건을 입력하고 협력사에 연결합니다."
        />
        <StatsRow
          items={[
            { label: "카테고리", value: `${categories.length}개`, hint: "선택 가능한 분류" },
            { label: "협력사", value: `${companies.length}개`, hint: "연결 가능한 협력사" },
          ]}
          minItemWidth="13rem"
        />
        {categories.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="먼저 카테고리를 추가해 주세요"
              description="브랜드를 추가하려면 최소 1개의 카테고리가 필요합니다."
            />
          </Card>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start">
            <section className="grid gap-4">
              <SectionHeading
                title="브랜드 입력"
                description="혜택, 기간, CTA, 태그, 이미지까지 한 번에 입력합니다."
              />
              <AdminPartnerCreateForm
                partner={{
                  name: "",
                  visibility: "public",
                  benefitVisibility: "public",
                  location: "",
                  campusSlugs: ["seoul", "gumi", "daejeon", "busan-ulsan-gyeongnam", "gwangju"],
                  mapUrl: "",
                  reservationLink: "",
                  inquiryLink: "",
                  period: { start: "", end: "" },
                  conditions: [],
                  benefits: [],
                  appliesTo: [],
                  thumbnail: null,
                  images: [],
                  tags: [],
                  company: null,
                }}
                categoryOptions={categories.map((category) => ({
                  id: category.id,
                  label: category.label,
                }))}
                companyOptions={companies}
                categoryId={defaultCategoryId}
              />
            </section>
            <Card tone="elevated" className="grid gap-3 2xl:sticky 2xl:top-24">
              <SectionHeading
                title="입력 가이드"
                description="메인 폼을 넓게 쓰고, 보조 기준은 우측에 둡니다."
              />
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>카테고리와 협력사를 먼저 선택한 뒤 기간과 CTA를 채우는 순서를 권장합니다.</p>
                <p>리스트 카드에서 바로 보이는 값은 썸네일, 혜택, 태그, 노출 상태입니다.</p>
              </div>
            </Card>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
