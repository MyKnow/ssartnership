import type { PartnerVisibility } from "@/lib/types";
import type { PartnerBenefitVisibility } from "@/lib/partner-benefit-visibility";
import type { PartnerBenefitActionType } from "@/lib/partner-benefit-action";
import type { CampusSlug } from "@/lib/campuses";
import {
  ONLINE_PARTNER_LOCATION,
  type PartnerServiceMode,
} from "@/lib/partner-service-mode";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import FieldGroup from "@/components/partner-card-form/FieldGroup";
import PartnerCampusSlugField from "@/components/partner-card-form/PartnerCampusSlugField";
import { getPartnerCardInvalidClass } from "@/components/partner-card-form/usePartnerCardFormState";
import type {
  PartnerCardCategoryOption,
  PartnerCardFormField,
  PartnerCardFormValues,
} from "@/components/partner-card-form/types";

export default function PartnerBasicInfoSection({
  partner,
  categoryOptions,
  fieldErrors,
  focusField,
  onCampusSlugSelectionChange,
  values,
  setters,
}: {
  partner: PartnerCardFormValues;
  categoryOptions?: PartnerCardCategoryOption[];
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
  focusField?: PartnerCardFormField;
  onCampusSlugSelectionChange?: (value: CampusSlug[]) => void;
  values: {
    nameValue: string;
    visibilityValue: PartnerVisibility;
    benefitVisibilityValue: PartnerBenefitVisibility;
    categoryValue: string;
    serviceModeValue: PartnerServiceMode;
    periodStartValue: string;
    periodEndValue: string;
    locationValue: string;
    mapUrlValue: string;
    benefitActionTypeValue: PartnerBenefitActionType;
    benefitActionLinkValue: string;
    reservationLinkValue: string;
    inquiryLinkValue: string;
  };
  setters: {
    setNameValue: (value: string) => void;
    setVisibilityValue: (value: PartnerVisibility) => void;
    setBenefitVisibilityValue: (value: PartnerBenefitVisibility) => void;
    setCategoryValue: (value: string) => void;
    setServiceModeValue: (value: PartnerServiceMode) => void;
    setPeriodStartValue: (value: string) => void;
    setPeriodEndValue: (value: string) => void;
    setLocationValue: (value: string) => void;
    setMapUrlValue: (value: string) => void;
    setBenefitActionTypeValue: (value: PartnerBenefitActionType) => void;
    setBenefitActionLinkValue: (value: string) => void;
    setReservationLinkValue: (value: string) => void;
    setInquiryLinkValue: (value: string) => void;
  };
}) {
  const isOnlineService = values.serviceModeValue === "online";
  const placeLinkLabel = isOnlineService ? "사이트 링크" : "지도 URL";
  const placeLinkPlaceholder = isOnlineService
    ? "https://service.example.com"
    : "https://map.naver.com/...";

  return (
    <Card className="overflow-hidden">
      <SectionHeading
        title="기본 정보"
        description="상세 페이지의 왼쪽 요약 카드처럼 보이도록 핵심 정보를 정리합니다."
      />

      <div className="mt-6 grid gap-5">
        <PartnerThumbnailField
          initial={partner.thumbnail ?? null}
          className="w-full"
        />

        <FieldGroup label="브랜드명" error={fieldErrors?.name}>
          <Input
            name="name"
            value={values.nameValue}
            onChange={(event) => setters.setNameValue(event.target.value)}
            required
            autoFocus={focusField === "name"}
            aria-invalid={Boolean(fieldErrors?.name) || undefined}
            className={getPartnerCardInvalidClass(Boolean(fieldErrors?.name))}
          />
        </FieldGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="노출 상태" error={fieldErrors?.visibility}>
            <Select
              name="visibility"
              value={values.visibilityValue}
              onChange={(event) => setters.setVisibilityValue(event.target.value as PartnerVisibility)}
              required
              autoFocus={focusField === "visibility"}
              aria-invalid={Boolean(fieldErrors?.visibility) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.visibility))}
            >
              <option value="public">공개</option>
              <option value="confidential">대외비</option>
              <option value="private">비공개</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="혜택 공개 범위" error={fieldErrors?.benefitVisibility}>
            <Select
              name="benefitVisibility"
              value={values.benefitVisibilityValue}
              onChange={(event) =>
                setters.setBenefitVisibilityValue(
                  event.target.value as PartnerBenefitVisibility,
                )
              }
              required
              autoFocus={focusField === "benefitVisibility"}
              aria-invalid={Boolean(fieldErrors?.benefitVisibility) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.benefitVisibility))}
            >
              <option value="public">혜택 전체 공개</option>
              <option value="eligible_only">적용 대상만 공개</option>
            </Select>
          </FieldGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="카테고리" error={fieldErrors?.categoryId}>
            <Select
              name="categoryId"
              value={values.categoryValue}
              onChange={(event) => setters.setCategoryValue(event.target.value)}
              required
              autoFocus={focusField === "categoryId"}
              aria-invalid={Boolean(fieldErrors?.categoryId) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.categoryId))}
            >
              {(categoryOptions ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="브랜드 운영 형태">
            <Select
              name="serviceMode"
              value={values.serviceModeValue}
              onChange={(event) =>
                setters.setServiceModeValue(event.target.value as PartnerServiceMode)
              }
            >
              <option value="offline">오프라인</option>
              <option value="online">온라인</option>
            </Select>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              온라인 브랜드는 위치 대신 사이트 링크를 노출합니다.
            </p>
          </FieldGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="시작일" error={fieldErrors?.periodStart}>
            <Input
              type="date"
              name="periodStart"
              value={values.periodStartValue}
              onChange={(event) => setters.setPeriodStartValue(event.target.value)}
              autoFocus={focusField === "periodStart"}
              aria-invalid={Boolean(fieldErrors?.periodStart) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.periodStart))}
            />
          </FieldGroup>
          <FieldGroup label="종료일" error={fieldErrors?.periodEnd}>
            <Input
              type="date"
              name="periodEnd"
              value={values.periodEndValue}
              onChange={(event) => setters.setPeriodEndValue(event.target.value)}
              autoFocus={focusField === "periodEnd"}
              aria-invalid={Boolean(fieldErrors?.periodEnd) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.periodEnd))}
            />
          </FieldGroup>
        </div>

        {isOnlineService ? (
          <input type="hidden" name="location" value={ONLINE_PARTNER_LOCATION} />
        ) : (
          <FieldGroup label="위치" error={fieldErrors?.location}>
            <Input
              name="location"
              value={values.locationValue}
              onChange={(event) => setters.setLocationValue(event.target.value)}
              required
              autoFocus={focusField === "location"}
              aria-invalid={Boolean(fieldErrors?.location) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.location))}
              placeholder="서울 강남구 테헤란로 212"
            />
          </FieldGroup>
        )}

        <PartnerCampusSlugField
          defaultValue={partner.campusSlugs}
          location={values.locationValue}
          error={fieldErrors?.campusSlugs}
          onSelectionChange={onCampusSlugSelectionChange}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label={placeLinkLabel} error={fieldErrors?.mapUrl}>
            <Input
              name="mapUrl"
              value={values.mapUrlValue}
              onChange={(event) => setters.setMapUrlValue(event.target.value)}
              autoFocus={focusField === "mapUrl"}
              aria-invalid={Boolean(fieldErrors?.mapUrl) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.mapUrl))}
              placeholder={placeLinkPlaceholder}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {isOnlineService
                ? "카드에서는 위치 문구 없이 웹사이트 바로가기 아이콘으로 표시됩니다."
                : "지도 URL이 없으면 위치와 브랜드명으로 지도 검색 링크를 만듭니다."}
            </p>
          </FieldGroup>
          <FieldGroup label="혜택 이용 방식" error={fieldErrors?.benefitActionType}>
            <Select
              name="benefitActionType"
              value={values.benefitActionTypeValue}
              onChange={(event) => {
                const nextType = event.target.value as PartnerBenefitActionType;
                setters.setBenefitActionTypeValue(nextType);
                if (nextType !== "external_link") {
                  setters.setBenefitActionLinkValue("");
                  setters.setReservationLinkValue("");
                }
              }}
              autoFocus={focusField === "benefitActionType"}
              aria-invalid={Boolean(fieldErrors?.benefitActionType) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.benefitActionType))}
            >
              <option value="external_link">외부 링크로 이용</option>
              <option value="certification">싸트너십 인증으로 이용</option>
              <option value="onsite">현장 제시로 이용</option>
              <option value="none">별도 행동 없음</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup
          label="혜택 이용 링크"
          error={fieldErrors?.benefitActionLink ?? fieldErrors?.reservationLink}
        >
          <Input
            name="benefitActionLink"
            value={values.benefitActionLinkValue}
            onChange={(event) => {
              setters.setBenefitActionLinkValue(event.target.value);
              setters.setReservationLinkValue(event.target.value);
            }}
            autoFocus={focusField === "benefitActionLink" || focusField === "reservationLink"}
            aria-invalid={
              Boolean(fieldErrors?.benefitActionLink ?? fieldErrors?.reservationLink) ||
              undefined
            }
            className={getPartnerCardInvalidClass(
              Boolean(fieldErrors?.benefitActionLink ?? fieldErrors?.reservationLink),
            )}
            disabled={values.benefitActionTypeValue !== "external_link"}
            placeholder={
              values.benefitActionTypeValue === "external_link"
                ? "https://booking.naver.com/... 또는 연락처"
                : "외부 링크 방식에서만 입력합니다."
            }
          />
          <input
            type="hidden"
            name="reservationLink"
            value={
              values.benefitActionTypeValue === "external_link"
                ? values.benefitActionLinkValue
                : ""
            }
          />
        </FieldGroup>

        <FieldGroup label="문의 링크" error={fieldErrors?.inquiryLink}>
          <Input
            name="inquiryLink"
            value={values.inquiryLinkValue}
            onChange={(event) => setters.setInquiryLinkValue(event.target.value)}
            autoFocus={focusField === "inquiryLink"}
            aria-invalid={Boolean(fieldErrors?.inquiryLink) || undefined}
            className={getPartnerCardInvalidClass(Boolean(fieldErrors?.inquiryLink))}
          />
        </FieldGroup>

        <PartnerGalleryField
          initial={partner.images ?? []}
          className="w-full"
        />
      </div>
    </Card>
  );
}
