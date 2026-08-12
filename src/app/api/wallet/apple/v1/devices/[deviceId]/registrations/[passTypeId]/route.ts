import { walletPassRepository } from "@/lib/repositories/wallet-pass";
import {
  appleWalletEmptyResponse,
  appleWalletJsonResponse,
  buildAppleWalletUpdatedPassesResponse,
  getAppleWalletUpdateQueryLimit,
  getAppleWalletWebServiceConfig,
  hashAppleWalletDeviceIdentifier,
  isExpectedAppleWalletPassTypeIdentifier,
  parseAppleWalletUpdatedSince,
} from "@/lib/wallet/apple/web-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      deviceId: string;
      passTypeId: string;
    }>;
  },
) {
  const params = await context.params;
  const configStatus = getAppleWalletWebServiceConfig();
  if (!configStatus.ok) {
    return configStatus.response;
  }

  if (
    !isExpectedAppleWalletPassTypeIdentifier(
      params.passTypeId,
      configStatus.config.passTypeIdentifier,
    )
  ) {
    return appleWalletJsonResponse({ message: "패스를 찾을 수 없습니다." }, 404);
  }

  const hashedDeviceIdentifier = hashAppleWalletDeviceIdentifier(
    params.deviceId,
    configStatus.config.deviceTokenEncryptionKey,
  );
  if (!hashedDeviceIdentifier) {
    return appleWalletJsonResponse(
      { message: "deviceLibraryIdentifier 형식이 올바르지 않습니다." },
      400,
    );
  }

  const updatedSince = parseAppleWalletUpdatedSince(request);
  if (!updatedSince.ok) {
    return appleWalletJsonResponse(
      { message: "passesUpdatedSince 형식이 올바르지 않습니다." },
      400,
    );
  }

  const updatedPasses = await walletPassRepository
    .listUpdatedAppleWalletPasses({
      deviceLibraryIdentifierHash: hashedDeviceIdentifier,
      updatedSince: updatedSince.value,
      limit: getAppleWalletUpdateQueryLimit(),
    })
    .catch(() => null);
  if (!updatedPasses) {
    return appleWalletJsonResponse(
      { message: "Apple Wallet 갱신 요청을 처리하지 못했습니다." },
      500,
    );
  }
  if (updatedPasses.length === 0) {
    return appleWalletEmptyResponse(204);
  }

  return appleWalletJsonResponse(
    buildAppleWalletUpdatedPassesResponse(updatedPasses),
  );
}
