import { CheckIcon } from "@heroicons/react/24/solid";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";
import { PROMOTION_AUDIENCE_OPTIONS } from "@/lib/promotions/catalog";
import { cn } from "@/lib/cn";
import {
  extractEventSlugFromHref,
  promotionSlideFieldId,
  toggleAudience,
  toggleCampus,
  type PromotionAdCampaignOption,
  type PromotionEventPageOption,
  type SlideDraft,
  type SlideUpdater,
} from "./slide-helpers";

/** Link, sponsor, activation, audience, and campus controls for one slide. */
export default function PromotionSlideTargetingFields({
  slide,
  editable,
  eventPageOptions,
  adCampaignOptions,
  onUpdate,
}: {
  slide: SlideDraft;
  editable: boolean;
  eventPageOptions: PromotionEventPageOption[];
  adCampaignOptions: PromotionAdCampaignOption[];
  onUpdate: (updater: SlideUpdater) => void;
}) {
  const hrefInvalid = !slide.href.trim();
  const audienceInvalid = slide.audiences.length === 0;
  const sponsorInvalid =
    slide.sponsorLabel.length > AD_PACKAGE_FORM_LIMITS.sponsorLabelMax;

  return (
    <div className="grid gap-4 rounded-panel border border-border/70 bg-surface-inset p-4">
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor={`event-page-${slide.id}`}
        >
          이벤트 페이지에서 선택
        </label>
        <Select
          id={`event-page-${slide.id}`}
          value={
            eventPageOptions.some((option) => option.href === slide.href)
              ? slide.href
              : ""
          }
          disabled={!editable || eventPageOptions.length === 0}
          onChange={(event) => {
            const href = event.target.value;
            if (!href) {
              return;
            }
            const option = eventPageOptions.find((item) => item.href === href);
            onUpdate((current) => ({
              ...current,
              href,
              eventSlug: option?.slug ?? null,
            }));
          }}
        >
          <option value="">
            {eventPageOptions.length > 0
              ? "활성 이벤트 페이지 선택"
              : "활성 이벤트 페이지 없음"}
          </option>
          {eventPageOptions.map((option) => (
            <option key={option.href} value={option.href}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor={`ad-campaign-${slide.id}`}
        >
          제휴 캠페인 연결
        </label>
        <Select
          id={`ad-campaign-${slide.id}`}
          value={slide.adCampaignId ?? ""}
          disabled={!editable || adCampaignOptions.length === 0}
          onChange={(event) => {
            const campaignId = event.target.value || null;
            const option = adCampaignOptions.find((item) => item.id === campaignId);
            onUpdate((current) => ({
              ...current,
              adCampaignId: campaignId,
              sponsorLabel:
                current.sponsorLabel || option?.label.split(" · ")[0] || "",
            }));
          }}
        >
          <option value="">
            {adCampaignOptions.length > 0 ? "연결 안 함" : "생성된 광고 캠페인 없음"}
          </option>
          {adCampaignOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        스폰서 표기
        <Input
          id={promotionSlideFieldId(slide.id, "sponsorLabel")}
          aria-invalid={sponsorInvalid || undefined}
          value={slide.sponsorLabel}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              sponsorLabel: event.target.value,
            }))
          }
          placeholder="예: 역삼 국밥집 제공"
          disabled={!editable}
          maxLength={AD_PACKAGE_FORM_LIMITS.sponsorLabelMax}
          className={
            sponsorInvalid
              ? "border-danger/40 bg-danger/5 focus:border-danger"
              : undefined
          }
        />
        <span className="text-xs font-normal leading-5 text-muted-foreground">
          홈 배너에 광고 표기로 함께 노출됩니다.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        연결 페이지
        <Input
          id={promotionSlideFieldId(slide.id, "href")}
          aria-invalid={hrefInvalid || undefined}
          value={slide.href}
          onChange={(event) => {
            const href = event.target.value;
            onUpdate((current) => ({
              ...current,
              href,
              eventSlug:
                eventPageOptions.find((option) => option.href === href)?.slug ??
                extractEventSlugFromHref(href),
            }));
          }}
          placeholder="/events/signup-reward"
          disabled={!editable}
          className={
            hrefInvalid
              ? "border-danger/40 bg-danger/5 focus:border-danger"
              : undefined
          }
        />
        <span className="text-xs font-normal leading-5 text-muted-foreground">
          직접 입력하거나 위의 활성 이벤트 페이지 목록에서 선택할 수 있습니다.
        </span>
      </label>

      <div className="grid gap-3">
        <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-surface px-3 py-2.5 text-sm font-medium text-foreground">
          <span className="flex items-center gap-2">
            <CheckIcon className="size-4 text-muted-foreground" />
            활성 여부
          </span>
          <input
            type="checkbox"
            checked={slide.isActive}
            onChange={(event) =>
              onUpdate((current) => ({
                ...current,
                isActive: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-primary"
            disabled={!editable}
          />
        </label>
      </div>

      <div className="grid gap-2">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-foreground">노출 대상</p>
          <p className="text-xs leading-5 text-muted-foreground">
            로그인 여부와 허용 기수를 통합해 대상군별로 선택합니다.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROMOTION_AUDIENCE_OPTIONS.map((option, optionIndex) => {
            const checked = slide.audiences.includes(option.key);
            return (
              <label
                key={option.key}
                className={cn(
                  "grid gap-1 rounded-[1rem] border px-3 py-2 text-sm transition-colors",
                  checked
                    ? "border-primary/20 bg-primary-soft/50 text-foreground"
                    : "border-border/70 bg-surface text-foreground",
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    id={
                      optionIndex === 0
                        ? promotionSlideFieldId(slide.id, "audiences")
                        : undefined
                    }
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        audiences: toggleAudience(
                          current.audiences,
                          option.key,
                          event.target.checked,
                        ),
                      }))
                    }
                    className="h-4 w-4 accent-primary"
                    disabled={!editable}
                  />
                  {option.label}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
        {audienceInvalid ? (
          <p className="text-xs font-medium text-danger">
            노출 대상을 하나 이상 선택해 주세요.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">허용 캠퍼스</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CAMPUS_DIRECTORY.map((campus) => {
            const checked = slide.allowedCampuses.includes(campus.slug);
            return (
              <label
                key={campus.slug}
                className="flex items-center gap-2 rounded-[1rem] border border-border/70 bg-surface px-3 py-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onUpdate((current) => ({
                      ...current,
                      allowedCampuses: toggleCampus(
                        current.allowedCampuses,
                        campus.slug,
                        event.target.checked,
                      ),
                    }))
                  }
                  className="h-4 w-4 accent-primary"
                  disabled={!editable}
                />
                {campus.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
