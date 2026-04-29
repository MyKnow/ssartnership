import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerCreateToast from "@/components/admin/AdminPartnerCreateToast";
import PartnerChangeRequestQueue from "@/components/admin/PartnerChangeRequestQueue";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import InlineMessage from "@/components/ui/InlineMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import {
  createCategory,
  approvePartnerChangeRequest,
  deleteCategory,
  rejectPartnerChangeRequest,
  updateCategory,
} from "@/app/admin/(protected)/actions";
import { ADMIN_COPY } from "@/lib/content";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const adminPartnersErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizePartnerCompany(
  value: unknown,
): PartnerCompanyRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const first = value[0] as PartnerCompanyRow | undefined;
    return first ?? null;
  }
  if (typeof value === "object") {
    return value as PartnerCompanyRow;
  }
  return null;
}

function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const partnerFormError = params.error ? adminPartnersErrorMessages[params.error] : null;

  const [
    categoriesResult,
    partnersResult,
    changeRequests,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,name,category_id,company_id,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,company:partner_companies(id,name,slug,description,is_active)")
      .order("created_at", { ascending: false }),
    listPartnerChangeRequests(),
  ]);

  const safeCategories = categoriesResult.data ?? [];
  const normalizedPartners = (partnersResult.data ?? []).map((partner) => ({
    ...partner,
    company: normalizePartnerCompany((partner as { company?: unknown }).company),
  }));
  const partnerMetrics = await getAdminPartnerMetrics(
    normalizedPartners.map((partner) => partner.id),
  );
  const safePartners = normalizedPartners.map((partner) => ({
    ...partner,
    metrics: partnerMetrics.metricsByPartnerId.get(partner.id) ?? null,
  }));
  const publicCount = safePartners.filter((partner) => partner.visibility === "public").length;
  const confidentialCount = safePartners.filter((partner) => partner.visibility === "confidential").length;
  const privateCount = safePartners.filter((partner) => partner.visibility === "private").length;

  return (
    <AdminShell
      title="브랜드 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <AdminPartnerCreateToast />
        <ShellHeader
          eyebrow="Partners"
          title="브랜드와 변경 요청 관리"
          description="카테고리, 브랜드, 승인 대기 요청을 같은 디자인 규칙 아래에서 관리합니다."
          actions={<Button variant="soft" href="/admin/partners/new">브랜드 추가</Button>}
        />
        <StatsRow
          items={[
            { label: "브랜드", value: `${safePartners.length.toLocaleString()}개`, hint: "현재 등록된 전체 브랜드" },
            { label: "카테고리", value: `${safeCategories.length.toLocaleString()}개`, hint: "운영 중인 분류 체계" },
            { label: "공개/대외비", value: `${publicCount.toLocaleString()} · ${confidentialCount.toLocaleString()}`, hint: "public · confidential" },
            { label: "비공개/요청", value: `${privateCount.toLocaleString()}개`, hint: `승인 대기 ${changeRequests.length.toLocaleString()}건` },
          ]}
          minItemWidth="13rem"
        />
        {partnerFormError ? (
          <FormMessage variant="error">{partnerFormError}</FormMessage>
        ) : null}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
          <Card tone="elevated">
            <SectionHeading
              title="브랜드 관리"
              description="협력사와 담당자 이메일을 함께 관리하고, 이용 조건/혜택/태그는 칩으로 다룹니다."
            />
            {partnerMetrics.warningMessage ? (
              <InlineMessage
                className="mt-6"
                tone="warning"
                title="브랜드 집계 일부를 불러오지 못했습니다."
                description={partnerMetrics.warningMessage}
              />
            ) : null}
            <div className="mt-6">
              <AdminPartnerManager
                categories={safeCategories}
                partners={safePartners}
              />
            </div>
          </Card>

          <div className="grid gap-6">
            <PartnerChangeRequestQueue
              requests={changeRequests}
              approveAction={approvePartnerChangeRequest}
              rejectAction={rejectPartnerChangeRequest}
            />
            <Card tone="elevated">
              <SectionHeading
                title="카테고리 관리"
                description="카테고리 키는 소문자 영문/숫자 조합을 권장합니다."
              />

              <form
                className="mt-6 grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto] lg:items-end"
                action={createCategory}
              >
                <div className="grid grid-cols-2 gap-4 lg:contents">
                  <FieldGroup label="카테고리 키" className="min-w-0">
                    <Input name="key" placeholder="category-key" required />
                  </FieldGroup>
                  <FieldGroup label="라벨" className="min-w-0">
                    <Input name="label" placeholder="라벨" required />
                  </FieldGroup>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-4 lg:contents">
                  <FieldGroup label="설명" className="min-w-0">
                    <Input name="description" placeholder="설명" />
                  </FieldGroup>
                  <FieldGroup label="색상">
                    <input
                      type="color"
                      name="color"
                      defaultValue="#0f172a"
                      className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface-control p-1"
                      title="카테고리 색상"
                    />
                  </FieldGroup>
                </div>
                <div className="flex justify-end lg:justify-start">
                  <SubmitButton pendingText="추가 중" className="w-full sm:w-auto">
                    추가
                  </SubmitButton>
                </div>
              </form>

              <div className="mt-6 grid gap-3">
                {safeCategories.length === 0 ? (
                  <EmptyState
                    title={ADMIN_COPY.emptyCategoryTitle}
                    description={ADMIN_COPY.emptyCategoryDescription}
                  />
                ) : (
                  safeCategories.map((category) => (
                    (() => {
                      const updateFormId = `category-update-${category.id}`;
                      const deleteFormId = `category-delete-${category.id}`;

                      return (
                        <div
                          key={category.id}
                          className="rounded-2xl border border-border bg-surface-elevated p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto_auto] lg:items-end">
                            <form
                              id={updateFormId}
                              className="contents"
                              action={updateCategory}
                            >
                              <input type="hidden" name="id" value={category.id} />
                              <div className="grid grid-cols-2 gap-4 lg:contents">
                                <FieldGroup label="카테고리 키" className="min-w-0">
                                  <Input name="key" defaultValue={category.key} />
                                </FieldGroup>
                                <FieldGroup label="라벨" className="min-w-0">
                                  <Input name="label" defaultValue={category.label} />
                                </FieldGroup>
                              </div>
                              <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-4 lg:contents">
                                <FieldGroup label="설명" className="min-w-0">
                                  <Input
                                    name="description"
                                    defaultValue={category.description ?? ""}
                                  />
                                </FieldGroup>
                                <FieldGroup label="색상">
                                  <input
                                    type="color"
                                    name="color"
                                    defaultValue={category.color ?? "#0f172a"}
                                    className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface-control p-1"
                                    title="카테고리 색상"
                                  />
                                </FieldGroup>
                              </div>
                            </form>
                            <form
                              id={deleteFormId}
                              className="contents"
                              action={deleteCategory}
                            >
                              <input type="hidden" name="id" value={category.id} />
                            </form>
                            <div className="flex justify-end gap-2 lg:justify-start">
                              <SubmitButton
                                form={updateFormId}
                                variant="ghost"
                                pendingText="수정 중"
                                className="w-full sm:w-auto"
                              >
                                수정
                              </SubmitButton>
                              <SubmitButton
                                form={deleteFormId}
                                variant="danger"
                                pendingText="삭제 중"
                                className="w-full sm:w-auto"
                              >
                                삭제
                              </SubmitButton>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

      </section>
    </AdminShell>
  );
}
