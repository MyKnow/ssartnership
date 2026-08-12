import {
  appleWalletEmptyResponse,
  appleWalletJsonResponse,
  getAppleWalletWebServiceConfig,
  parseAppleWalletLogBody,
} from "@/lib/wallet/apple/web-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configStatus = getAppleWalletWebServiceConfig();
  if (!configStatus.ok) {
    return configStatus.response;
  }

  const parsedBody = await parseAppleWalletLogBody(request);
  if (!parsedBody.success) {
    return appleWalletJsonResponse(
      { message: "로그 본문 형식이 올바르지 않습니다." },
      400,
    );
  }

  return appleWalletEmptyResponse(200);
}
