import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";

/**
 * Shared promotion-slide (home carousel card) rules. The admin editor runs them
 * before submit for field focus, and the save action runs the same rules as the
 * trust boundary, redirecting with the code and 1-based card number.
 */
export type PromotionSlideField =
  | "title"
  | "subtitle"
  | "href"
  | "imageAlt"
  | "image"
  | "audiences"
  | "sponsorLabel";

export const PROMOTION_SLIDE_ERROR_MESSAGES = {
  promotion_slide_title_required: "타이틀을 입력해 주세요.",
  promotion_slide_subtitle_required: "부제를 입력해 주세요.",
  promotion_slide_href_required: "연결 페이지를 입력해 주세요.",
  promotion_slide_image_alt_required: "이미지 대체 텍스트를 입력해 주세요.",
  promotion_slide_image_required: "이미지를 업로드해 주세요.",
  promotion_slide_audiences_required: "노출 대상을 하나 이상 선택해 주세요.",
  promotion_slide_sponsor_label_too_long: `스폰서 표기는 ${AD_PACKAGE_FORM_LIMITS.sponsorLabelMax}자 이하로 입력해 주세요.`,
  promotion_slide_image_source_invalid:
    "기존에 저장된 이미지 외에는 이미지 주소를 직접 넣을 수 없습니다. 이미지를 다시 업로드해 주세요.",
  promotion_slide_image_attach_failed:
    "업로드한 이미지를 저장하지 못했습니다. 업로드가 만료되었을 수 있으니 이미지를 다시 선택해 저장해 주세요.",
  promotion_slide_upload_invalid: "광고 이미지 업로드 정보를 확인해 주세요. 이미지를 다시 선택해 저장해 주세요.",
  promotion_slide_id_required: "광고 카드 식별자가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
  promotion_slide_id_duplicated: "같은 광고 카드가 두 번 들어 있습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
  promotion_slide_payload_invalid: "광고 카드 데이터를 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
  promotion_slide_empty: "최소 1개의 광고 카드가 필요합니다.",
} as const;

export type PromotionSlideErrorCode = keyof typeof PROMOTION_SLIDE_ERROR_MESSAGES;

export const PROMOTION_SLIDE_ERROR_FIELDS: Partial<Record<PromotionSlideErrorCode, PromotionSlideField>> = {
  promotion_slide_title_required: "title",
  promotion_slide_subtitle_required: "subtitle",
  promotion_slide_href_required: "href",
  promotion_slide_image_alt_required: "imageAlt",
  promotion_slide_image_required: "image",
  promotion_slide_audiences_required: "audiences",
  promotion_slide_sponsor_label_too_long: "sponsorLabel",
  promotion_slide_image_source_invalid: "image",
  promotion_slide_image_attach_failed: "image",
  promotion_slide_upload_invalid: "image",
};

export type PromotionSlideValidationInput = {
  title: string;
  subtitle: string;
  href: string;
  imageAlt: string;
  audiences: readonly string[];
  sponsorLabel: string;
  /** A stored image, a completed upload, or a newly chosen file awaiting upload. */
  hasImage: boolean;
};

export type PromotionSlideIssue = {
  code: PromotionSlideErrorCode;
  field: PromotionSlideField;
  message: string;
};

export function validatePromotionSlide(slide: PromotionSlideValidationInput): PromotionSlideIssue[] {
  const codes: PromotionSlideErrorCode[] = [];
  if (!slide.title.trim()) codes.push("promotion_slide_title_required");
  if (!slide.subtitle.trim()) codes.push("promotion_slide_subtitle_required");
  if (!slide.hasImage) codes.push("promotion_slide_image_required");
  if (!slide.imageAlt.trim()) codes.push("promotion_slide_image_alt_required");
  if (!slide.href.trim()) codes.push("promotion_slide_href_required");
  if (slide.audiences.length === 0) codes.push("promotion_slide_audiences_required");
  if (slide.sponsorLabel.length > AD_PACKAGE_FORM_LIMITS.sponsorLabelMax) {
    codes.push("promotion_slide_sponsor_label_too_long");
  }
  return codes.map((code) => ({
    code,
    field: PROMOTION_SLIDE_ERROR_FIELDS[code] as PromotionSlideField,
    message: PROMOTION_SLIDE_ERROR_MESSAGES[code],
  }));
}

/** Thrown by the save action; `message` is the code so it survives the safe redirect filter. */
export class PromotionSlideSaveError extends Error {
  readonly code: PromotionSlideErrorCode;
  readonly slideNumber: number | null;

  constructor(code: PromotionSlideErrorCode, slideNumber: number | null = null) {
    super(code);
    this.name = "PromotionSlideSaveError";
    this.code = code;
    this.slideNumber = slideNumber;
  }
}

export function isPromotionSlideErrorCode(value: string | undefined | null): value is PromotionSlideErrorCode {
  return Boolean(value) && Object.hasOwn(PROMOTION_SLIDE_ERROR_MESSAGES, value as string);
}

export function formatPromotionSlideError(code: PromotionSlideErrorCode, slideNumber?: number | null) {
  const message = PROMOTION_SLIDE_ERROR_MESSAGES[code];
  return slideNumber && slideNumber > 0 ? `카드 ${slideNumber}: ${message}` : message;
}

/** Parses the `slide` redirect parameter (1-based card number). */
export function parsePromotionSlideNumber(value: string | undefined | null) {
  if (!value || !/^[1-9]\d{0,2}$/.test(value)) return null;
  return Number(value);
}
