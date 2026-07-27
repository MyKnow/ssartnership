import { AdminPartnerDetailDeferredFallback } from "@/components/admin/AdminPartnerDetailDeferredSections";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import PartnerCardForm from "@/components/PartnerCardForm";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { updatePartner } from "@/app/admin/(protected)/actions";
import { getAdminPartnerFormOptionsReadModel } from "@/lib/admin-partner-form-options.server";
import type { AdminPartnerDetailCoreReady } from "@/lib/admin-partner-detail.server";

export default async function AdminPartnerDetailEditSection({
  detail,
  managedCampusSlugs,
  canUpdatePartner,
  partnerSaved,
  detailPath,
  retryHref,
  thumbnail,
  galleryImages,
}: {
  detail: AdminPartnerDetailCoreReady;
  managedCampusSlugs: readonly string[] | null;
  canUpdatePartner: boolean;
  partnerSaved: boolean;
  detailPath: string;
  retryHref: string;
  thumbnail: string | null;
  galleryImages: string[];
}) {
  const { partner, company } = detail;
  const options = await getAdminPartnerFormOptionsReadModel({
    managedCampusSlugs,
  });

  return (
    <div className="grid min-w-0 gap-4">
        <AdminSectionHeading
          title={canUpdatePartner ? "제휴처 수정" : "제휴처 기본 정보"}
          description={
            canUpdatePartner
              ? "목록에서는 핵심 정보만 확인하고 이 상세 화면에서 제휴처 정보를 수정합니다."
              : "기본 정보는 확인할 수 있지만 제휴처 수정 권한이 없어 변경할 수 없습니다."
          }
        />
        {canUpdatePartner ? (
          options.loadError ? (
            <AdminStatePanel
              kind="error"
              title="제휴처 수정 옵션을 불러오지 못했습니다."
              description="기본 정보는 확인할 수 있습니다. 잠시 후 다시 시도해 주세요."
              action={
                <Button href={retryHref} variant="secondary">
                  다시 확인
                </Button>
              }
            />
          ) : (
            <PartnerCardForm
              mode="edit"
              partner={{
                id: partner.id,
                name: partner.name ?? "",
                visibility: partner.visibility,
                benefitVisibility: partner.benefit_visibility ?? "public",
                location: partner.location ?? "",
                detailDescription: partner.detail_description ?? "",
                campusSlugs: partner.campus_slugs ?? [],
                mapUrl: partner.map_url ?? "",
                benefitActionType: partner.benefit_action_type ?? undefined,
                benefitActionLink: partner.benefit_action_link ?? undefined,
                benefitItems: (partner.partner_benefits ?? []).map(
                  (benefit: {
                    id: string;
                    title: string;
                    max_apply_count: number | null;
                    display_order?: number | null;
                  }) => ({
                    id: benefit.id,
                    title: benefit.title,
                    maxApplyCount: benefit.max_apply_count,
                    displayOrder: benefit.display_order ?? undefined,
                  }),
                ),
                benefitVerificationPinConfigured: Boolean(
                  partner.benefit_verification_pin_hash &&
                    partner.benefit_verification_pin_salt,
                ),
                reservationLink: partner.reservation_link ?? "",
                inquiryLink: partner.inquiry_link ?? "",
                period: {
                  start: partner.period_start ?? "",
                  end: partner.period_end ?? "",
                },
                conditions: partner.conditions ?? [],
                benefits: partner.benefits ?? [],
                appliesTo: partner.applies_to ?? [],
                thumbnail,
                images: galleryImages,
                tags: partner.tags ?? [],
                company: company
                  ? {
                      id: company.id,
                      name: company.name,
                      description: company.description ?? "",
                      contactName: "",
                      contactEmail: "",
                      contactPhone: "",
                    }
                  : null,
              }}
              categoryOptions={options.categories.map((item) => ({
                id: item.id,
                label: item.label,
              }))}
              companyOptions={options.companies.map((item) => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
              }))}
              categoryId={partner.category_id ?? undefined}
              formAction={updatePartner}
              submitLabel="제휴처 저장"
              clearDraftOnSuccess={partnerSaved}
              hiddenFields={[{ name: "updateRedirectTo", value: detailPath }]}
            />
          )
        ) : (
          <Surface level="inset" padding="lg" className="grid min-w-0 gap-5">
            <div>
              <p className="text-sm font-semibold text-foreground">조회 전용 권한</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                제휴처 기본 정보와 운영 상태는 확인할 수 있지만, 수정은 제휴처 운영 권한이 있는 관리자만 할 수 있습니다.
              </p>
            </div>
            <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="ui-caption">제휴처명</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-foreground">{partner.name}</dd>
              </div>
              <div className="min-w-0">
                <dt className="ui-caption">파트너사</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-foreground">{company?.name ?? "회사 미연결"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="ui-caption">노출 상태</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {partner.visibility === "public" ? "공개" : "비공개"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="ui-caption">운영 기간</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {partner.period_start ?? "시작일 미입력"} ~ {partner.period_end ?? "종료일 미입력"}
                </dd>
              </div>
            </dl>
          </Surface>
        )}
    </div>
  );
}

export function AdminPartnerDetailEditSectionFallback() {
  return <AdminPartnerDetailDeferredFallback label="제휴처 수정 옵션을 불러오는 중입니다." />;
}
