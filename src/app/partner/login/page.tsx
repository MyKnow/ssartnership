import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PartnerLoginScreen from "@/components/partner/PartnerLoginScreen";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { loginAction } from "./_actions/login";
import {
  getPartnerLoginFieldErrors,
  getLoginErrorMessage,
  readSearchParam,
  type PartnerLoginSearchParams,
} from "./_actions/shared";

export const metadata: Metadata = {
  title: `파트너 포털 로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<PartnerLoginSearchParams>;
}) {
  const session = await getPartnerSession();
  if (session) {
    redirect(session.mustChangePassword ? "/partner/change-password" : "/partner");
  }

  const params = (await searchParams) ?? {};
  const errorCode = readSearchParam(params.error);
  const defaultLoginId = readSearchParam(params.loginId);
  const setupStatus = readSearchParam(params.setup);
  const errorMessage = getLoginErrorMessage(errorCode);
  const fieldErrors = getPartnerLoginFieldErrors(errorCode);
  const formErrorMessage =
    fieldErrors.loginId || fieldErrors.password ? null : errorMessage;

  return (
    <PartnerLoginScreen
      action={loginAction}
      defaultLoginId={defaultLoginId}
      setupCompleted={setupStatus === "completed"}
      fieldErrors={fieldErrors}
      formErrorMessage={formErrorMessage}
    />
  );
}
