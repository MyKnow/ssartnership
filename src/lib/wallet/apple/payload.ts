import type { PassProps } from "passkit-generator";

import type { AppleWalletConfig, AppleWalletPassInput } from "./types";

const APPLE_WALLET_WEB_SERVICE_PATH = "/api/wallet/apple";

function normalizeDisplayValue(value: string) {
  return value.trim() || "-";
}

function formatUpdatedAtKst(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("updatedAt 값이 올바르지 않습니다.");
  }

  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute} KST`;
}

export function getAppleWalletWebServiceUrl(siteUrl: string) {
  return new URL(APPLE_WALLET_WEB_SERVICE_PATH, siteUrl).toString();
}

export function buildAppleWalletPassPayload(
  input: AppleWalletPassInput,
  config: Pick<
    AppleWalletConfig,
    | "organizationName"
    | "passTypeIdentifier"
    | "teamIdentifier"
    | "siteUrl"
  >,
): PassProps {
  const barcodeUrl = new URL(input.verificationUrl, config.siteUrl).toString();

  const updatedAtLabel = formatUpdatedAtKst(input.updatedAt);

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    serialNumber: input.serialNumber,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: "싸트너십 회원 인증",
    logoText: "싸트너십 회원 인증",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(226, 232, 240)",
    backgroundColor: "rgb(15, 23, 42)",
    sharingProhibited: true,
    voided: input.voided ?? false,
    authenticationToken: input.authenticationToken,
    webServiceURL: getAppleWalletWebServiceUrl(config.siteUrl),
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: barcodeUrl,
        messageEncoding: "iso-8859-1",
        altText: "인증 QR",
      },
    ],
    generic: {
      headerFields: [
        {
          key: "generation",
          label: "기수",
          value: normalizeDisplayValue(input.generationLabel),
        },
      ],
      primaryFields: [
        {
          key: "displayName",
          label: "이름",
          value: normalizeDisplayValue(input.displayName),
        },
      ],
      secondaryFields: [
        {
          key: "campus",
          label: "캠퍼스",
          value: normalizeDisplayValue(input.campusLabel),
        },
        {
          key: "role",
          label: "권한",
          value: normalizeDisplayValue(input.roleLabel),
        },
      ],
      auxiliaryFields: [
        {
          key: "updatedAt",
          label: "마지막 갱신",
          value: updatedAtLabel,
        },
      ],
      backFields: [
        {
          key: "usage",
          label: "사용 안내",
          value: "제휴처에서 QR을 스캔해 현재 회원 인증 상태를 확인해 주세요.",
        },
        {
          key: "notice",
          label: "안내",
          value: "이 패스는 공식 SSAFY 학생증이나 신분증이 아닙니다.",
        },
      ],
    },
  };
}
