import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerAccountManager from "@/components/admin/AdminPartnerAccountManager";
import PartnerChangeRequestQueue from "@/components/admin/PartnerChangeRequestQueue";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  createCategory,
  approvePartnerChangeRequest,
  createPartner,
  deleteCategory,
  deletePartner,
  rejectPartnerChangeRequest,
  updateCategory,
  updatePartner,
} from "@/app/admin/(protected)/actions";
import { ADMIN_COPY } from "@/lib/content";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
};

type PartnerAccountCompanyLinkRow = {
  id: string;
  role?: "owner" | "admin" | "manager" | "viewer" | null;
  is_active?: boolean | null;
  created_at?: string | null;
  company?: PartnerCompanyRow | null;
};

type PartnerAccountRowRecord = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links?: PartnerAccountCompanyLinkRow[] | PartnerAccountCompanyLinkRow | null;
};

type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links: PartnerAccountCompanyLinkRow[];
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

function normalizePartnerAccount(
  value: unknown,
): PartnerAccountRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as PartnerAccountRowRecord;
  const links = Array.isArray(row.links)
    ? row.links
    : row.links
      ? [row.links]
      : [];

  return {
    id: row.id,
    login_id: row.login_id,
    display_name: row.display_name,
    email: row.email ?? null,
    must_change_password: row.must_change_password ?? null,
    is_active: row.is_active ?? null,
    email_verified_at: row.email_verified_at ?? null,
    initial_setup_completed_at: row.initial_setup_completed_at ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    links: links.map((link) => ({
      id: link.id,
      role: link.role ?? null,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company: normalizePartnerCompany(link.company),
    })),
  };
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

export default async function AdminPartnersPage() {
  const supabase = getSupabaseAdminClient();

  const [
    categoriesResult,
    partnersResult,
    companiesResult,
    accountsResult,
    changeRequests,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,name,category_id,company_id,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active)")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
      .order("name", { ascending: true }),
    supabase
      .from("partner_accounts")
      .select("id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,last_login_at,created_at,updated_at,links:partner_account_companies(id,role,is_active,created_at,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active))")
      .order("created_at", { ascending: false }),
    listPartnerChangeRequests(),
  ]);

  const safeCategories = categoriesResult.data ?? [];
  const safePartners = (partnersResult.data ?? []).map((partner) => ({
    ...partner,
    company: normalizePartnerCompany((partner as { company?: unknown }).company),
  }));
  const safeCompanies = companiesResult.data ?? [];
  const safeAccounts = (accountsResult.data ?? [])
    .map((account) => normalizePartnerAccount(account))
    .filter((account): account is PartnerAccountRow => Boolean(account));

  return (
    <AdminShell
      title="업체 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <PartnerChangeRequestQueue
          requests={changeRequests}
          approveAction={approvePartnerChangeRequest}
          rejectAction={rejectPartnerChangeRequest}
        />

        <Card>
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
                  className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface p-1"
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
                                className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface p-1"
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

        <Card>
          <SectionHeading
            title="제휴 업체 관리"
            description="회사와 담당자 이메일을 함께 관리하고, 이용 조건/혜택/태그는 칩으로 다룹니다."
          />
          <AdminPartnerManager
            categories={safeCategories}
            partners={safePartners}
            companies={safeCompanies}
            createPartner={createPartner}
            updatePartner={updatePartner}
            deletePartner={deletePartner}
          />
        </Card>

        <Card>
          <SectionHeading
            title="업체 아이디 및 권한 관리"
            description="로그인 아이디, 활성 상태, 비밀번호 변경 필요 여부와 회사별 권한을 관리합니다."
          />
          <AdminPartnerAccountManager accounts={safeAccounts} />
        </Card>

      </section>
    </AdminShell>
  );
}
