import type { PartnerVisibility } from "@/lib/types";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import FieldGroup from "@/components/partner-card-form/FieldGroup";
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
  values,
  setters,
}: {
  partner: PartnerCardFormValues;
  categoryOptions?: PartnerCardCategoryOption[];
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
  focusField?: PartnerCardFormField;
  values: {
    nameValue: string;
    visibilityValue: PartnerVisibility;
    categoryValue: string;
    periodStartValue: string;
    periodEndValue: string;
    locationValue: string;
    mapUrlValue: string;
    reservationLinkValue: string;
    inquiryLinkValue: string;
  };
  setters: {
    setNameValue: (value: string) => void;
    setVisibilityValue: (value: PartnerVisibility) => void;
    setCategoryValue: (value: string) => void;
    setPeriodStartValue: (value: string) => void;
    setPeriodEndValue: (value: string) => void;
    setLocationValue: (value: string) => void;
    setMapUrlValue: (value: string) => void;
    setReservationLinkValue: (value: string) => void;
    setInquiryLinkValue: (value: string) => void;
  };
}) {
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

        <FieldGroup label="위치" error={fieldErrors?.location}>
          <Input
            name="location"
            value={values.locationValue}
            onChange={(event) => setters.setLocationValue(event.target.value)}
            required
            autoFocus={focusField === "location"}
            aria-invalid={Boolean(fieldErrors?.location) || undefined}
            className={getPartnerCardInvalidClass(Boolean(fieldErrors?.location))}
          />
        </FieldGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="지도 URL" error={fieldErrors?.mapUrl}>
            <Input
              name="mapUrl"
              value={values.mapUrlValue}
              onChange={(event) => setters.setMapUrlValue(event.target.value)}
              autoFocus={focusField === "mapUrl"}
              aria-invalid={Boolean(fieldErrors?.mapUrl) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.mapUrl))}
            />
          </FieldGroup>
          <FieldGroup label="예약 링크" error={fieldErrors?.reservationLink}>
            <Input
              name="reservationLink"
              value={values.reservationLinkValue}
              onChange={(event) => setters.setReservationLinkValue(event.target.value)}
              autoFocus={focusField === "reservationLink"}
              aria-invalid={Boolean(fieldErrors?.reservationLink) || undefined}
              className={getPartnerCardInvalidClass(Boolean(fieldErrors?.reservationLink))}
            />
          </FieldGroup>
        </div>

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
