import { normalizeBusinessRegistrationNumber } from "@/lib/partner-billing";

const NTS_BUSINESS_STATUS_ENDPOINT =
  "https://api.odcloud.kr/api/nts-businessman/v1/status";

const NTS_BUSINESS_STATUS_LABEL_BY_CODE: Record<string, string> = {
  "01": "계속사업자",
  "02": "휴업자",
  "03": "폐업자",
};

export type NtsBusinessStatusLookupResult =
  | {
      ok: true;
      businessRegistrationNumber: string;
      businessStatus: string;
      businessStatusCode: string;
      taxType: string;
      taxTypeCode: string;
      closedAt: string | null;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      code: "not_configured" | "invalid_response" | "network_error";
      message: string;
    };

function getNtsBusinessStatusServiceKey() {
  return (
    process.env.NTS_BUSINESS_STATUS_SERVICE_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY ??
    ""
  ).trim();
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBusinessStatusLabel(rawStatus: string, statusCode: string) {
  return NTS_BUSINESS_STATUS_LABEL_BY_CODE[statusCode] ?? rawStatus;
}

function getServiceKeyQueryValue(serviceKey: string) {
  return serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
}

export function isNtsBusinessStatusLookupConfigured() {
  return Boolean(getNtsBusinessStatusServiceKey());
}

export async function lookupNtsBusinessStatus(
  businessRegistrationNumber: string,
): Promise<NtsBusinessStatusLookupResult> {
  const normalizedBusinessRegistrationNumber = normalizeBusinessRegistrationNumber(
    businessRegistrationNumber,
  );
  const serviceKey = getNtsBusinessStatusServiceKey();
  if (!serviceKey) {
    return {
      ok: false,
      code: "not_configured",
      message: "사업자 상태조회 API 키가 설정되지 않았습니다.",
    };
  }

  try {
    const response = await fetch(
      `${NTS_BUSINESS_STATUS_ENDPOINT}?serviceKey=${getServiceKeyQueryValue(serviceKey)}&returnType=JSON`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ b_no: [normalizedBusinessRegistrationNumber] }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        code: "network_error",
        message: "사업자 상태조회 API 응답을 받지 못했습니다.",
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { status_code?: unknown; data?: unknown }
      | null;
    const apiStatusCode = getStringValue(payload?.status_code);
    if (apiStatusCode && apiStatusCode !== "OK") {
      return {
        ok: false,
        code: "invalid_response",
        message: `사업자 상태조회 API 응답을 확인해 주세요. (${apiStatusCode})`,
      };
    }

    const [rawStatus] = Array.isArray(payload?.data) ? payload.data : [];
    if (!rawStatus || typeof rawStatus !== "object") {
      return {
        ok: false,
        code: "invalid_response",
        message: "사업자 상태조회 API 응답 형식을 확인해 주세요.",
      };
    }

    const raw = rawStatus as Record<string, unknown>;
    const businessStatusCode = getStringValue(raw.b_stt_cd);
    const rawBusinessStatus = getStringValue(raw.b_stt);
    return {
      ok: true,
      businessRegistrationNumber: normalizedBusinessRegistrationNumber,
      businessStatus: getBusinessStatusLabel(rawBusinessStatus, businessStatusCode),
      businessStatusCode,
      taxType: getStringValue(raw.tax_type),
      taxTypeCode: getStringValue(raw.tax_type_cd),
      closedAt: getStringValue(raw.end_dt) || null,
      raw,
    };
  } catch {
    return {
      ok: false,
      code: "network_error",
      message: "사업자 상태조회 API 호출 중 오류가 발생했습니다.",
    };
  }
}
