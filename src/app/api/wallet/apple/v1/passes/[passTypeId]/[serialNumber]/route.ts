import {
  buildAppleWalletPassBuffer,
  getAppleWalletPassLastModified,
  WalletPassServiceError,
} from "@/lib/wallet/wallet-pass-service";
import { walletPassRepository } from "@/lib/repositories/wallet-pass";
import {
  appleWalletEmptyResponse,
  appleWalletJsonResponse,
  createAppleWalletPkPassResponse,
  getAppleWalletWebServiceConfig,
  isAppleWalletPassModifiedAfter,
  isExpectedAppleWalletPassTypeIdentifier,
  normalizeAppleWalletSerialNumber,
  parseAppleWalletIfModifiedSince,
  verifyAppleWalletPassAuthorization,
} from "@/lib/wallet/apple/web-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapPassServiceError(error: unknown) {
  if (error instanceof WalletPassServiceError) {
    switch (error.code) {
      case "wallet_not_configured":
        return appleWalletJsonResponse(
          { message: "Apple Wallet 웹서비스를 사용할 수 없습니다." },
          503,
        );
      case "wallet_pass_build_failed":
      case "wallet_pass_snapshot_invalid":
        return appleWalletJsonResponse(
          { message: "Apple Wallet 패스를 생성하지 못했습니다." },
          500,
        );
      case "wallet_pass_not_found":
        return appleWalletJsonResponse(
          { message: "패스를 찾을 수 없습니다." },
          404,
        );
      case "wallet_pass_revoked":
      case "wallet_ineligible":
      case "wallet_pass_idempotency_conflict":
        break;
    }
  }
  return appleWalletJsonResponse(
    { message: "Apple Wallet 패스를 생성하지 못했습니다." },
    500,
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      passTypeId: string;
      serialNumber: string;
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

  const serialNumber = normalizeAppleWalletSerialNumber(params.serialNumber);
  if (!serialNumber) {
    return appleWalletJsonResponse({ message: "패스를 찾을 수 없습니다." }, 404);
  }
  let pass;
  try {
    pass = await walletPassRepository.getAppleWalletPassBySerialNumber(
      serialNumber,
    );
  } catch {
    return appleWalletJsonResponse(
      { message: "Apple Wallet 패스를 불러오지 못했습니다." },
      500,
    );
  }
  if (!pass) {
    return appleWalletJsonResponse({ message: "패스를 찾을 수 없습니다." }, 404);
  }

  if (!verifyAppleWalletPassAuthorization(request, pass, configStatus.config)) {
    return appleWalletEmptyResponse(401);
  }

  const ifModifiedSince = parseAppleWalletIfModifiedSince(request);
  if (!ifModifiedSince.ok) {
    return appleWalletJsonResponse(
      { message: "If-Modified-Since 형식이 올바르지 않습니다." },
      400,
    );
  }

  const lastModified = getAppleWalletPassLastModified(pass);
  if (!isAppleWalletPassModifiedAfter(pass, ifModifiedSince.value)) {
    return appleWalletEmptyResponse(304, {
      "last-modified": lastModified,
    });
  }

  try {
    const buffer = await buildAppleWalletPassBuffer(pass, {
      requireCurrentEligibility: false,
    });
    return createAppleWalletPkPassResponse(buffer, lastModified);
  } catch (error) {
    return mapPassServiceError(error);
  }
}
