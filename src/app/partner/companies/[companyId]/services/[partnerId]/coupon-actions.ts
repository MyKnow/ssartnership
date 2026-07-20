"use server";

import { revalidatePath } from "next/cache";
import { parseCreateAdCouponForm } from "@/lib/ad-package-validation";
import { adPackageRepository } from "@/lib/repositories";
import { getPartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { parseCouponCodeWorkbook } from "@/lib/ad-coupon-code-import.server";

export async function createPartnerCouponAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) throw new Error("로그인이 필요합니다.");
  const companyId = String(formData.get("companyId") ?? "").trim();
  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope || !partnerId) throw new Error("제휴처 권한을 확인할 수 없습니다.");
  const context = await getPartnerChangeRequestContext(
    [scope.id],
    partnerId,
    session.accountId,
  );
  if (!context) throw new Error("제휴처 권한을 확인할 수 없습니다.");
  formData.set("partnerId", partnerId);
  const input = parseCreateAdCouponForm(formData, {
    partnerPeriodEnd: context.periodEnd,
  });
  await adPackageRepository.createCoupon({ ...input, partnerId });
  revalidatePath(`/partner/companies/${companyId}/services/${partnerId}`);
  revalidatePath(`/partners/${partnerId}`);
}

export async function uploadPartnerCouponCodesAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) throw new Error("로그인이 필요합니다.");
  const companyId = String(formData.get("companyId") ?? "").trim();
  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const couponId = String(formData.get("couponId") ?? "").trim();
  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope || !partnerId || !couponId) throw new Error("제휴처 권한을 확인할 수 없습니다.");
  const coupon = (await adPackageRepository.listActiveCouponsForPartner(partnerId)).find((item) => item.id === couponId);
  if (!coupon || coupon.issuanceType !== "partner_code_pool") throw new Error("코드형 쿠폰만 코드를 등록할 수 있습니다.");
  const file = formData.get("codePoolFile");
  if (!(file instanceof File)) throw new Error("엑셀 파일을 선택해 주세요.");
  const codes = await parseCouponCodeWorkbook(file);
  await adPackageRepository.addCouponCodes({ couponId, codes });
  revalidatePath(`/partner/companies/${companyId}/services/${partnerId}`);
}
