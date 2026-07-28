import type { ComponentProps } from "react";
import { Suspense } from "react";
import AdminAdPackageManager from "@/components/admin/ad-packages/AdminAdPackageManager";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminOperationFlow from "@/components/admin/AdminOperationFlow";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Button from "@/components/ui/Button";
import PromotionCarouselEditor from "@/components/admin/promotion-carousel-editor/PromotionCarouselEditor";
import PromotionCarouselDraftClearOnSuccess from "@/components/admin/promotion-carousel-editor/PromotionCarouselDraftClearOnSuccess";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";

type AdManagerProps = ComponentProps<typeof AdminAdPackageManager>;
type CarouselEditorProps = ComponentProps<typeof PromotionCarouselEditor>;

type DeferredCampaignData = Promise<
  | {
      status: "ready";
      campaigns: AdManagerProps["campaigns"];
      partners: AdManagerProps["partners"];
    }
  | { status: "error" }
>;

export type AdminAdvertisementViewProps = Pick<
  AdManagerProps,
  "createCampaignAction" | "updateCampaignStatusAction"
> &
  Pick<
    CarouselEditorProps,
    "initialSlides" | "eventPageOptions" | "adCampaignOptions" | "saveAction"
  > & {
    campaigns?: AdManagerProps["campaigns"];
    partners?: AdManagerProps["partners"];
    campaignsPromise?: DeferredCampaignData;
    canCreate?: boolean;
    canUpdate?: boolean;
    message?: string | null;
  errorMessage?: string | null;
  clearPromotionDraft?: boolean;
  showHeader?: boolean;
  };

async function DeferredCampaignManager({
  campaignsPromise,
  createCampaignAction,
  updateCampaignStatusAction,
  canCreate,
  canUpdate,
}: {
  campaignsPromise: DeferredCampaignData;
  createCampaignAction: AdManagerProps["createCampaignAction"];
  updateCampaignStatusAction: AdManagerProps["updateCampaignStatusAction"];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const result = await campaignsPromise;
  if (result.status === "error") {
    return (
      <AdminStatePanel
        kind="error"
        title="광고 패키지 운영 정보를 불러오지 못했습니다."
        description="캐러셀 편집은 사용할 수 있습니다. 잠시 후 다시 확인해 주세요."
        action={
          <Button href="/admin/advertisement" variant="secondary">
            다시 확인
          </Button>
        }
      />
    );
  }

  return (
    <AdminAdPackageManager
      campaigns={result.campaigns}
      partners={result.partners}
      createCampaignAction={createCampaignAction}
      updateCampaignStatusAction={updateCampaignStatusAction}
      canCreate={canCreate}
      canUpdate={canUpdate}
    />
  );
}

export default function AdminAdvertisementView({
  campaigns,
  partners,
  campaignsPromise,
  createCampaignAction,
  updateCampaignStatusAction,
  initialSlides,
  eventPageOptions,
  adCampaignOptions,
  saveAction,
  canCreate = true,
  canUpdate = true,
  message,
  errorMessage,
  clearPromotionDraft = false,
  showHeader = true,
}: AdminAdvertisementViewProps) {
  const resolvedCampaignsPromise =
    campaignsPromise ??
    Promise.resolve({
      status: "ready" as const,
      campaigns: campaigns ?? [],
      partners: partners ?? [],
    });
  const activeSlides = initialSlides.filter((slide) => slide.isActive).length;
  const databaseSlides = initialSlides.filter(
    (slide) => slide.source === "database",
  ).length;
  const catalogSlides = initialSlides.filter(
    (slide) => slide.source === "catalog",
  ).length;

  return (
    <div className="grid gap-6">
      <PromotionCarouselDraftClearOnSuccess shouldClear={clearPromotionDraft} />
      {showHeader ? (
        <AdminPageHeader
          eyebrow="자동화"
          title="홈 광고 관리"
          description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지, 노출 권한을 한 번에 편집합니다."
        />
      ) : null}
      <StatsRow
        items={[
          {
            label: "전체 카드",
            value: `${initialSlides.length}개`,
            hint: "운영 중인 광고 카드",
          },
          {
            label: "활성 카드",
            value: `${activeSlides}개`,
            hint: "홈 노출 기준",
          },
          {
            label: "편집 가능",
            value: `${databaseSlides}개`,
            hint: "DB 기반 카드",
          },
          {
            label: "카탈로그",
            value: `${catalogSlides}개`,
            hint: "코드 정의 카드",
          },
        ]}
        minItemWidth="13rem"
      />
      <AdminOperationFlow
        steps={[
          {
            label: "노출 구성",
            description: "홈 카드와 노출 순서를 관리합니다.",
            state: "current",
          },
          {
            label: "이벤트 연결",
            description: "공개 이벤트 목적지를 확인합니다.",
            href: "/admin/event",
            state: "upcoming",
          },
          {
            label: "운영 기록",
            description: "변경 결과와 기록을 확인합니다.",
            href: "/admin/logs",
            state: "upcoming",
          },
        ]}
      />
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      <section className="grid gap-4">
        <AdminSectionHeading
          title="캐러셀 편집기"
          description="메인 미리보기와 카드별 상세 편집을 같은 워크스페이스에서 다룹니다."
        />
        <PromotionCarouselEditor
          initialSlides={initialSlides}
          eventPageOptions={eventPageOptions}
          adCampaignOptions={adCampaignOptions}
          saveAction={saveAction}
          canUpdate={canUpdate}
        />
      </section>
      <section className="grid gap-4">
        <Suspense
          fallback={
            <div className="grid gap-3">
              <AdminSectionHeading
                title="광고 패키지 운영"
                description="쿠폰, 홈 스폰서 배너, 광고성 푸시 캠페인을 관리합니다."
              />
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="rounded-2xl border border-border bg-surface-inset px-4 py-5 text-sm text-muted-foreground"
              >
                광고 캠페인과 제휴처 선택지를 불러오는 중입니다.
              </div>
            </div>
          }
        >
          <DeferredCampaignManager
            campaignsPromise={resolvedCampaignsPromise}
            createCampaignAction={createCampaignAction}
            updateCampaignStatusAction={updateCampaignStatusAction}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </Suspense>
      </section>
    </div>
  );
}
