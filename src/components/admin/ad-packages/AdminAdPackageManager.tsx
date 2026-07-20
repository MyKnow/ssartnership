import Card from "@/components/ui/Card";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import StatsRow from "@/components/ui/StatsRow";
import Textarea from "@/components/ui/Textarea";
import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";
import {
  INITIAL_AD_CHANNELS,
  getAdPackageDefinition,
  listAdPackageDefinitions,
  type AdCampaignStatus,
  type InitialAdChannel,
} from "@/lib/ad-packages";
import type { AdCampaignWithStats } from "@/lib/repositories/ad-package-repository";
import { cn } from "@/lib/cn";

type PartnerOption = {
  id: string;
  name: string;
};

type ServerAction = (formData: FormData) => void | Promise<void>;

const channelLabels: Record<InitialAdChannel, string> = {
  coupon: "쿠폰",
  home_banner: "홈 배너",
  push: "광고성 푸시",
  mm: "Mattermost",
  ad_banner: "일반 애드배너",
};

const statusLabels: Record<AdCampaignStatus, string> = {
  draft: "초안",
  active: "활성",
  paused: "일시중지",
  ended: "종료",
};

const statusBadgeClass: Record<AdCampaignStatus, string> = {
  draft: "bg-surface-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ended: "bg-surface-inset text-muted-foreground",
};

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatPeriod(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2 text-sm font-medium text-foreground", className)}>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: AdCampaignStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold",
        statusBadgeClass[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function PackageCatalog() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {listAdPackageDefinitions().map((definition) => (
        <Card key={definition.tier} tone="muted" padding="sm" className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{definition.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {definition.description}
              </p>
            </div>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              P{definition.priority}
            </span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {definition.monthlyPriceKrw === 0
              ? "무료"
              : `월 ${formatCurrency(definition.monthlyPriceKrw)}`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {definition.includedChannels.map((channel) => (
              <span
                key={channel}
                className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {channelLabels[channel]}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdminAdPackageManager({
  campaigns,
  partners,
  createCampaignAction,
  updateCampaignStatusAction,
}: {
  campaigns: AdCampaignWithStats[];
  partners: PartnerOption[];
  createCampaignAction: ServerAction;
  updateCampaignStatusAction: ServerAction;
}) {
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const couponCount = campaigns.reduce((sum, campaign) => sum + campaign.coupons.length, 0);
  const redemptions = campaigns.reduce(
    (sum, campaign) => sum + campaign.metrics.couponRedemptions,
    0,
  );
  const bannerClicks = campaigns.reduce(
    (sum, campaign) => sum + campaign.metrics.homeBannerClicks,
    0,
  );

  return (
    <section className="grid gap-5">
      <SectionHeading
        title="광고 패키지 운영"
        description="쿠폰, 홈 스폰서 배너, 광고성 푸시를 캠페인 단위로 묶어 판매하고 성과를 확인합니다."
        headingLevel="h2"
      />

      <StatsRow
        items={[
          { label: "캠페인", value: `${campaigns.length}개`, hint: "전체 패키지" },
          { label: "활성 캠페인", value: `${activeCampaigns.length}개`, hint: "현재 판매/노출" },
          { label: "쿠폰", value: `${couponCount}개`, hint: "등록된 쿠폰" },
          { label: "성과", value: `${redemptions}건`, hint: `배너 클릭 ${bannerClicks}회` },
        ]}
        minItemWidth="12rem"
      />

      <PackageCatalog />

      <div className="grid gap-4">
        <Card tone="elevated" className="grid gap-4">
          <SectionHeading
            title="캠페인 생성"
            description="제휴처와 패키지를 연결하고 홈 배너/푸시/쿠폰 채널을 선택합니다."
          />
          <form action={createCampaignAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel>
                제휴처
                <Select name="partnerId" required>
                  <option value="">선택</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel>
                패키지
                <Select name="packageTier" defaultValue="boost" required>
                  {listAdPackageDefinitions().map((definition) => (
                    <option key={definition.tier} value={definition.tier}>
                      {definition.label} ({formatCurrency(definition.monthlyPriceKrw)})
                    </option>
                  ))}
                </Select>
              </FieldLabel>
            </div>
            <FieldLabel>
              캠페인명
              <Input
                name="title"
                maxLength={AD_PACKAGE_FORM_LIMITS.titleMax}
                required
                placeholder="예: 역삼 국밥집 점심 부스트"
              />
            </FieldLabel>
            <FieldLabel>
              설명
              <Textarea
                name="description"
                maxLength={AD_PACKAGE_FORM_LIMITS.descriptionMax}
                rows={3}
                placeholder="운영자가 확인할 캠페인 목적"
              />
            </FieldLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel>
                상태
                <Select name="status" defaultValue="draft">
                  <option value="draft">초안</option>
                  <option value="active">활성</option>
                  <option value="paused">일시중지</option>
                  <option value="ended">종료</option>
                </Select>
              </FieldLabel>
              <FieldLabel>
                월 과금
                <Input name="monthlyPriceKrw" type="number" min={0} step={1000} placeholder="150000" />
              </FieldLabel>
            </div>
            <FieldLabel>
              스폰서 표기
              <Input
                name="sponsorLabel"
                maxLength={AD_PACKAGE_FORM_LIMITS.sponsorLabelMax}
                placeholder="예: 역삼 국밥집 제공"
              />
            </FieldLabel>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">채널</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {INITIAL_AD_CHANNELS.map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      name="channels"
                      value={channel}
                      defaultChecked
                      className="h-4 w-4 accent-primary"
                    />
                    {channelLabels[channel]}
                  </label>
                ))}
              </div>
            </div>
            <FieldLabel>
              운영 메모
              <Textarea
                name="notes"
                maxLength={AD_PACKAGE_FORM_LIMITS.notesMax}
                rows={3}
                placeholder="계약 조건, 후속 연락, 리포트 전달 방식"
              />
            </FieldLabel>
            <FormSubmitButton loadingText="생성 중" className="w-full justify-center sm:w-auto">
              캠페인 생성
            </FormSubmitButton>
          </form>
        </Card>
      </div>

      <section className="grid gap-4" aria-label="광고 캠페인 목록">
        {campaigns.length === 0 ? (
          <Card tone="muted" className="text-sm text-muted-foreground">
            아직 등록된 광고 패키지가 없습니다.
          </Card>
        ) : (
          campaigns.map((campaign) => {
            const definition = getAdPackageDefinition(campaign.packageTier);
            return (
              <Card key={campaign.id} tone="default" className="grid gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={campaign.status} />
                      <span className="rounded-full border border-border bg-surface-inset px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {definition.label}
                      </span>
                      {campaign.channels.map((channel) => (
                        <span
                          key={channel}
                          className="rounded-full border border-border bg-surface-inset px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {channelLabels[channel]}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-foreground">
                      {campaign.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {campaign.partnerName} · {formatPeriod(campaign.startsAt, campaign.endsAt)}
                    </p>
                    {campaign.description ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {campaign.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["active", "paused", "ended"] as const).map((status) => (
                      <form key={status} action={updateCampaignStatusAction}>
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <input type="hidden" name="status" value={status} />
                        <FormSubmitButton
                          variant={status === "active" ? "soft" : "secondary"}
                          size="sm"
                          disabled={campaign.status === status}
                          loadingText="변경 중"
                        >
                          {statusLabels[status]}
                        </FormSubmitButton>
                      </form>
                    ))}
                  </div>
                </div>

                <StatsRow
                  items={[
                    {
                      label: "월 과금",
                      value: formatCurrency(campaign.monthlyPriceKrw),
                      hint: campaign.sponsorLabel || "스폰서 표기 없음",
                    },
                    {
                      label: "배너 클릭",
                      value: campaign.metrics.homeBannerClicks.toLocaleString("ko-KR"),
                      hint: "홈 스폰서 배너",
                    },
                    {
                      label: "쿠폰 관심",
                      value: campaign.metrics.couponIntentCount.toLocaleString("ko-KR"),
                      hint: `조회 ${campaign.metrics.couponViews} · 복사 ${campaign.metrics.couponCopies}`,
                    },
                    {
                      label: "쿠폰 사용",
                      value: campaign.metrics.couponRedemptions.toLocaleString("ko-KR"),
                      hint: `${campaign.coupons.length}개 쿠폰`,
                    },
                  ]}
                  minItemWidth="11rem"
                />

              </Card>
            );
          })
        )}
      </section>
    </section>
  );
}
