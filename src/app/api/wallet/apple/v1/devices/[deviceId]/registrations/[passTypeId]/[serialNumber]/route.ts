import { scheduleProductEventLog } from "@/lib/activity-logs";
import { encryptApplePushToken } from "@/lib/wallet/apple/apple-wallet-device-token";
import { walletPassRepository } from "@/lib/repositories/wallet-pass";
import {
  appleWalletEmptyResponse,
  appleWalletJsonResponse,
  getAppleWalletPublicIdFromSerialNumber,
  getAppleWalletWebServiceConfig,
  hashAppleWalletDeviceIdentifier,
  isExpectedAppleWalletPassTypeIdentifier,
  parseAppleWalletRegistrationBody,
  normalizeAppleWalletSerialNumber,
  verifyAppleWalletPassAuthorization,
  verifyAppleWalletPassAuthorizationByPublicId,
} from "@/lib/wallet/apple/web-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logWalletDeviceEvent(
  eventName: "wallet_pass_device_register" | "wallet_pass_device_unregister",
  properties: Record<string, unknown>,
) {
  try {
    scheduleProductEventLog({
      eventName,
      actorType: "system",
      targetType: "wallet_pass",
      properties: {
        platform: "apple",
        ...properties,
      },
    });
  } catch {
    // Observability must not block the Apple Wallet device API.
  }
}

function mapRegistrationRepositoryError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("not_found")) {
    return appleWalletJsonResponse({ message: "패스를 찾을 수 없습니다." }, 404);
  }
  if (message.includes("revoked")) {
    return appleWalletJsonResponse({ message: "폐기된 패스입니다." }, 410);
  }
  return appleWalletJsonResponse(
    { message: "Apple Wallet 등록 요청을 처리하지 못했습니다." },
    500,
  );
}

async function loadAuthorizedPass(
  request: Request,
  params: { passTypeId: string; serialNumber: string },
  options?: { allowMissingPass?: boolean },
) {
  const configStatus = getAppleWalletWebServiceConfig();
  if (!configStatus.ok) {
    return configStatus;
  }

  if (
    !isExpectedAppleWalletPassTypeIdentifier(
      params.passTypeId,
      configStatus.config.passTypeIdentifier,
    )
  ) {
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "패스를 찾을 수 없습니다." },
        404,
      ),
    };
  }

  const serialNumber = normalizeAppleWalletSerialNumber(params.serialNumber);
  if (!serialNumber) {
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "패스를 찾을 수 없습니다." },
        404,
      ),
    };
  }
  const publicId = getAppleWalletPublicIdFromSerialNumber(serialNumber);
  if (!publicId) {
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "패스를 찾을 수 없습니다." },
        404,
      ),
    };
  }

  let pass;
  try {
    pass = await walletPassRepository.getAppleWalletPassBySerialNumber(
      serialNumber,
    );
  } catch {
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "Apple Wallet 등록 요청을 처리하지 못했습니다." },
        500,
      ),
    };
  }
  if (!pass) {
    if (options?.allowMissingPass) {
      if (
        !verifyAppleWalletPassAuthorizationByPublicId(
          request,
          publicId,
          configStatus.config,
        )
      ) {
        return {
          ok: false as const,
          response: appleWalletEmptyResponse(401),
        };
      }
      return {
        ok: true as const,
        config: configStatus.config,
        pass: null,
        publicId,
      };
    }
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "패스를 찾을 수 없습니다." },
        404,
      ),
    };
  }

  if (!verifyAppleWalletPassAuthorization(request, pass, configStatus.config)) {
    return {
      ok: false as const,
      response: appleWalletEmptyResponse(401),
    };
  }

  return { ok: true as const, config: configStatus.config, pass, publicId };
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      deviceId: string;
      passTypeId: string;
      serialNumber: string;
    }>;
  },
) {
  const params = await context.params;
  const authorized = await loadAuthorizedPass(request, params);
  if (!authorized.ok) {
    return authorized.response;
  }
  if (!authorized.pass) {
    return appleWalletJsonResponse(
      { message: "패스를 찾을 수 없습니다." },
      404,
    );
  }

  const hashedDeviceIdentifier = hashAppleWalletDeviceIdentifier(
    params.deviceId,
    authorized.config.deviceTokenEncryptionKey,
  );
  if (!hashedDeviceIdentifier) {
    return appleWalletJsonResponse(
      { message: "deviceLibraryIdentifier 형식이 올바르지 않습니다." },
      400,
    );
  }

  const parsedBody = await parseAppleWalletRegistrationBody(request);
  if (!parsedBody.success) {
    return appleWalletJsonResponse(
      { message: "pushToken 형식이 올바르지 않습니다." },
      400,
    );
  }

  try {
    const encryptedPushToken = encryptApplePushToken(parsedBody.data.pushToken, {
      key: authorized.config.deviceTokenEncryptionKey,
      keyVersion: 1,
    });
    const result = await walletPassRepository.registerAppleWalletDevice({
      publicId: authorized.pass.publicId,
      deviceLibraryIdentifierHash: hashedDeviceIdentifier,
      pushTokenCiphertext: encryptedPushToken.ciphertext,
      pushTokenIv: encryptedPushToken.iv,
      pushTokenAuthTag: encryptedPushToken.tag,
      pushTokenKeyVersion: encryptedPushToken.keyVersion,
    });
    logWalletDeviceEvent("wallet_pass_device_register", {
      registrationScope: "device_registration",
      outcome: result.isNewRegistration ? "registered" : "updated",
      isNewRegistration: result.isNewRegistration,
    });
    return appleWalletEmptyResponse(result.isNewRegistration ? 201 : 200);
  } catch (error) {
    logWalletDeviceEvent("wallet_pass_device_register", {
      registrationScope: "device_registration",
      outcome: "failed",
      reasonCode:
        error instanceof Error && error.message.includes("revoked")
          ? "revoked"
          : error instanceof Error && error.message.includes("not_found")
            ? "not_found"
            : "repository_error",
    });
    return mapRegistrationRepositoryError(error);
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      deviceId: string;
      passTypeId: string;
      serialNumber: string;
    }>;
  },
) {
  const params = await context.params;
  const authorized = await loadAuthorizedPass(request, params, {
    allowMissingPass: true,
  });
  if (!authorized.ok) {
    return authorized.response;
  }

  const hashedDeviceIdentifier = hashAppleWalletDeviceIdentifier(
    params.deviceId,
    authorized.config.deviceTokenEncryptionKey,
  );
  if (!hashedDeviceIdentifier) {
    return appleWalletJsonResponse(
      { message: "deviceLibraryIdentifier 형식이 올바르지 않습니다." },
      400,
    );
  }

  if (!authorized.pass) {
    logWalletDeviceEvent("wallet_pass_device_unregister", {
      registrationScope: "device_registration",
      outcome: "noop_missing_pass",
    });
    return appleWalletEmptyResponse(200);
  }

  try {
    const result = await walletPassRepository.unregisterAppleWalletDevice({
      publicId: authorized.pass.publicId,
      deviceLibraryIdentifierHash: hashedDeviceIdentifier,
    });
    logWalletDeviceEvent("wallet_pass_device_unregister", {
      registrationScope: "device_registration",
      outcome: result.removed ? "removed" : "already_removed",
      removed: result.removed,
    });
    return appleWalletEmptyResponse(200);
  } catch (error) {
    logWalletDeviceEvent("wallet_pass_device_unregister", {
      registrationScope: "device_registration",
      outcome: "failed",
      reasonCode:
        error instanceof Error && error.message.includes("revoked")
          ? "revoked"
          : error instanceof Error && error.message.includes("not_found")
            ? "not_found"
            : "repository_error",
    });
    return mapRegistrationRepositoryError(error);
  }
}
