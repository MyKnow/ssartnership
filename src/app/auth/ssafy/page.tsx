import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SsafyVerifyCallbackRelay from "@/components/auth/SsafyVerifyCallbackRelay";
import { sanitizeReturnTo } from "@/lib/return-to";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `SSAFY 인증 처리 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParamValue = string | string[] | undefined;

function firstSearchParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function hasSsafyVerifyCallbackParams(params: Record<string, SearchParamValue>) {
  const state = firstSearchParam(params.state);
  if (!state) {
    return false;
  }

  const code = firstSearchParam(params.code);
  const iss = firstSearchParam(params.iss);
  const error = firstSearchParam(params.error);
  const errorCode = firstSearchParam(params.error_code);

  return Boolean((code && iss) || error || errorCode);
}

function buildSignupRedirect(rawReturnTo: SearchParamValue) {
  const returnTo = sanitizeReturnTo(firstSearchParam(rawReturnTo), "/");
  if (returnTo === "/") {
    return "/auth/signup";
  }
  return `/auth/signup?returnTo=${encodeURIComponent(returnTo)}`;
}

export default async function SsafyCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const params = await searchParams;

  if (!hasSsafyVerifyCallbackParams(params)) {
    redirect(buildSignupRedirect(params.returnTo));
  }

  return <SsafyVerifyCallbackRelay />;
}
