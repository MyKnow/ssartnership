import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  normalizeAdminIdentifier,
  normalizeMmUsername,
  parseMemberYearValue,
  PASSWORD_POLICY_MESSAGE,
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateAdminIdentifier,
  validateAdminPasswordInput,
  validateCategoryKey,
  validateDateRange,
  validateMemberYear,
  validateMmUsername,
  isValidEmail,
} from "./validation";

function ValidationPreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>policy:{PASSWORD_POLICY_MESSAGE}</div>
      <div>normalize-mm:{normalizeMmUsername("  Te.St_User  ")}</div>
      <div>normalize-admin:{normalizeAdminIdentifier("  admin.user  ")}</div>
      <div>validate-mm-empty:{validateMmUsername("")}</div>
      <div>validate-mm-at:{validateMmUsername("@user")}</div>
      <div>validate-mm-space:{validateMmUsername("user name")}</div>
      <div>validate-mm-char:{validateMmUsername("user!")}</div>
      <div>validate-mm-ok:{String(validateMmUsername("user.name"))}</div>
      <div>validate-admin-empty:{validateAdminIdentifier("")}</div>
      <div>validate-admin-at:{validateAdminIdentifier("@admin")}</div>
      <div>validate-admin-space:{validateAdminIdentifier("ad min")}</div>
      <div>validate-admin-short:{validateAdminIdentifier("ab")}</div>
      <div>validate-admin-ok:{String(validateAdminIdentifier("admin.user"))}</div>
      <div>validate-password-empty:{validateAdminPasswordInput("")}</div>
      <div>validate-password-long:{validateAdminPasswordInput("a".repeat(257))}</div>
      <div>
        validate-password-control:
        {validateAdminPasswordInput("good\u0007pass")}
      </div>
      <div>validate-password-ok:{String(validateAdminPasswordInput("valid-pass"))}</div>
      <div>validate-category-empty:{validateCategoryKey("")}</div>
      <div>validate-category-invalid:{validateCategoryKey("Upper Case")}</div>
      <div>validate-category-ok:{String(validateCategoryKey("partner_food"))}</div>
      <div>parse-year-empty:{String(parseMemberYearValue(""))}</div>
      <div>parse-year-invalid:{String(parseMemberYearValue("100"))}</div>
      <div>parse-year-ok:{parseMemberYearValue("15")}</div>
      <div>validate-year-invalid:{validateMemberYear("100")}</div>
      <div>validate-year-ok:{String(validateMemberYear(15))}</div>
      <div>email-false:{String(isValidEmail("invalid"))}</div>
      <div>email-true:{String(isValidEmail(" test@example.com "))}</div>
      <div>sanitize-url-empty:{String(sanitizeHttpUrl(""))}</div>
      <div>sanitize-url-javascript:{String(sanitizeHttpUrl("javascript:alert(1)"))}</div>
      <div>
        sanitize-url-auth:
        {String(sanitizeHttpUrl("https://user:pass@example.com/path"))}
      </div>
      <div>sanitize-url-ok:{sanitizeHttpUrl("https://example.com/path?q=1")}</div>
      <div>sanitize-color-empty:{String(sanitizeHexColor(""))}</div>
      <div>sanitize-color-invalid:{String(sanitizeHexColor("#fff"))}</div>
      <div>sanitize-color-ok:{sanitizeHexColor(" #AABBCC ")}</div>
      <div>date-start-invalid:{validateDateRange("2026/01/01", null)}</div>
      <div>date-end-invalid:{validateDateRange("2026-01-01", "2026/01/02")}</div>
      <div>date-order-invalid:{validateDateRange("2026-02-01", "2026-01-01")}</div>
      <div>date-ok:{String(validateDateRange("2026-01-01", "2026-02-01"))}</div>
      <div>link-empty:{String(sanitizePartnerLinkValue(""))}</div>
      <div>link-url:{sanitizePartnerLinkValue("https://example.com")}</div>
      <div>link-email:{sanitizePartnerLinkValue("hello@example.com")}</div>
      <div>link-phone:{sanitizePartnerLinkValue("010-1234-5678")}</div>
      <div>link-instagram:{sanitizePartnerLinkValue("@ssafy.seoul")}</div>
      <div>link-scheme:{String(sanitizePartnerLinkValue("ftp://example.com"))}</div>
      <div>link-text:{sanitizePartnerLinkValue("현장 문의")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/Validation",
  component: ValidationPreview,
} satisfies Meta<typeof ValidationPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/policy:비밀번호는 8~64자, 영문\/숫자\/특수문자를 모두 포함해야 합니다\./),
    ).toBeInTheDocument();
    await expect(canvas.getByText("normalize-mm:te.st_user")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-admin:admin.user")).toBeInTheDocument();
    await expect(canvas.getByText("validate-mm-empty:MM 아이디를 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("validate-mm-at:MM 아이디는 @ 없이 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("validate-mm-space:MM 아이디에 공백을 넣을 수 없습니다.")).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-mm-char:MM 아이디는 영문, 숫자, ., _, -만 사용할 수 있습니다."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("validate-mm-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("validate-admin-empty:아이디를 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("validate-admin-at:아이디는 @ 없이 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("validate-admin-space:아이디에 공백을 넣을 수 없습니다.")).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-admin-short:아이디는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("validate-admin-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("validate-password-empty:비밀번호를 입력해 주세요.")).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-password-long:비밀번호 형식이 올바르지 않습니다."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-password-control:비밀번호 형식이 올바르지 않습니다."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("validate-password-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("validate-category-empty:카테고리 키를 입력해 주세요.")).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-category-invalid:카테고리 키는 소문자 영문, 숫자, -, _만 사용할 수 있습니다."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("validate-category-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-year-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-year-invalid:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-year-ok:15")).toBeInTheDocument();
    await expect(canvas.getByText("validate-year-invalid:기수는 0~99 사이의 숫자로 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("validate-year-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("email-false:false")).toBeInTheDocument();
    await expect(canvas.getByText("email-true:true")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-url-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-url-javascript:null")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-url-auth:null")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-url-ok:https://example.com/path?q=1")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-color-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-color-invalid:null")).toBeInTheDocument();
    await expect(canvas.getByText("sanitize-color-ok:#aabbcc")).toBeInTheDocument();
    await expect(canvas.getByText("date-start-invalid:제휴 시작일 형식을 확인해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("date-end-invalid:제휴 종료일 형식을 확인해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("date-order-invalid:제휴 종료일은 시작일보다 빠를 수 없습니다.")).toBeInTheDocument();
    await expect(canvas.getByText("date-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText("link-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("link-url:https://example.com/")).toBeInTheDocument();
    await expect(canvas.getByText("link-email:hello@example.com")).toBeInTheDocument();
    await expect(canvas.getByText("link-phone:010-1234-5678")).toBeInTheDocument();
    await expect(canvas.getByText("link-instagram:@ssafy.seoul")).toBeInTheDocument();
    await expect(canvas.getByText("link-scheme:null")).toBeInTheDocument();
    await expect(canvas.getByText("link-text:현장 문의")).toBeInTheDocument();
  },
};
