import { getRequestLogContext } from "@/lib/activity-logs";
import { consumeProductEventIngressQuota } from "@/lib/product-event-throttle";
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

  const context = getRequestLogContext(request);
  if (!consumeProductEventIngressQuota({ ipAddress: context.ipAddress })) {
    return appleWalletEmptyResponse(200);
  }

  const parsedBody = await parseAppleWalletLogBody(request);
  if (!parsedBody.success) {
    return appleWalletJsonResponse({ message: parsedBody.message }, parsedBody.status);
  }

  return appleWalletEmptyResponse(200);
}
