const SAFE_BRANCH_FILE_MESSAGES = new Set([
  "지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다.",
  "지점 목록은 .xlsx 파일만 업로드할 수 있습니다.",
  "지점 목록 시트를 찾지 못했습니다.",
  "XLSX 파일의 크기나 구조를 확인해 주세요.",
]);

const SAFE_BRANCH_ROW_MESSAGE_PATTERN =
  /\d+번째 지점(?:의 주소를 입력해 주세요\.|명을 확인해 주세요\.|의 지도 URL 형식을 확인해 주세요\.|의 전화번호 형식을 확인해 주세요\.)/;

export type SafePartnerRegistrationError = {
  message: string;
  fieldErrors?: { branchListText: string };
};

export function getSafePartnerRegistrationError(
  error: unknown,
  fallback: string,
): SafePartnerRegistrationError {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  const rowMessage = rawMessage.match(SAFE_BRANCH_ROW_MESSAGE_PATTERN)?.[0];
  const branchMessage = SAFE_BRANCH_FILE_MESSAGES.has(rawMessage)
    ? rawMessage
    : rowMessage;

  return branchMessage
    ? {
        message: branchMessage,
        fieldErrors: { branchListText: branchMessage },
      }
    : { message: fallback };
}
