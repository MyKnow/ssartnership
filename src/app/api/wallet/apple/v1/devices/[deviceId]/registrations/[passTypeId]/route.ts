import { scheduleProductEventLog } from "@/lib/activity-logs";
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

function logWalletSyncEvent(properties: Record<string, unknown>) {
  try {
    scheduleProductEventLog({
      eventName: "wallet_pass_sync",
      actorType: "system",
      targetType: "wallet_pass",
      properties: {
        platform: "apple",
        ...properties,
      },
    });
  } catch {
    // Device update checks must not fail because telemetry scheduling is unavailable.
  }
}

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
    logWalletSyncEvent({
      syncScope: "device_updates",
      outcome: "failed",
      reasonCode: "repository_error",
    });
    return appleWalletJsonResponse(
      { message: "Apple Wallet 갱신 요청을 처리하지 못했습니다." },
      500,
    );
  }
  if (updatedPasses.length === 0) {
    logWalletSyncEvent({
      syncScope: "device_updates",
      outcome: "empty",
      updatedPassCount: 0,
      hasUpdates: false,
    });
    return appleWalletEmptyResponse(204);
  }

  logWalletSyncEvent({
    syncScope: "device_updates",
    outcome: "updated",
    updatedPassCount: updatedPasses.length,
    hasUpdates: true,
  });
  return appleWalletJsonResponse(
    buildAppleWalletUpdatedPassesResponse(updatedPasses),
  );
}
