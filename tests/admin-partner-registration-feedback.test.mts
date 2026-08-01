import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("제휴 등록 신청은 관리자 알림과 같은 화면 편집 경로를 제공한다", async () => {
  const [publicAction, adminAction, page, view, notifications, context] =
    await Promise.all([
      read("src/app/(site)/partner-registration/actions.ts"),
      read("src/app/admin/(protected)/partner-registrations/actions.ts"),
      read("src/app/admin/(protected)/partner-registrations/page.tsx"),
      read("src/components/admin/AdminPartnerRegistrationsView.tsx"),
      read("src/lib/operational-notifications.ts"),
      read("src/lib/notification-templates/context.ts"),
    ]);

  assert.match(publicAction, /notifyAdminsOfPartnerRegistrationRequest/);
  assert.match(notifications, /partner-registration-request:\$\{input\.requestId\}/);
  assert.match(notifications, /partner_registration_request/);
  assert.match(context, /admin_partner_registration_request/);
  assert.match(page, /updatePartnerRegistrationRequestDetails/);
  assert.match(view, /신청 정보 수정/);
  assert.match(view, /name="brandName"/);
  assert.match(view, /PartnerChipSections/);
  assert.match(view, /혜택 이용 확인 PIN/);
  assert.match(view, /benefitItems/);
  assert.match(view, /최대 적용 횟수/);
  assert.match(adminAction, /updatePartnerRegistrationRequestDetails/);
  assert.match(adminAction, /hashCouponVerificationPassword/);
  assert.match(adminAction, /partner_form_multiple_groups/);
  assert.match(adminAction, /preservePartnerBenefitLimits/);
  assert.match(adminAction, /maxApplyCount: existingBenefits\[index\]/);
});
