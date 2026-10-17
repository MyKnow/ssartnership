export class ManualMemberImportDeliveryOutcomeUnknownError extends Error {
  constructor() {
    super("설정 링크 전송 결과를 확인해야 하므로 자동 재시도할 수 없습니다.");
  }
}

export class ManualMemberImportExistingMemberError extends Error {
  readonly memberId: string;

  constructor(memberId: string) {
    super("이미 등록된 회원입니다.");
    this.name = "ManualMemberImportExistingMemberError";
    this.memberId = memberId;
  }
}

export function getSafeFailureMessage(error: unknown) {
  if (error instanceof ManualMemberImportDeliveryOutcomeUnknownError) {
    return error.message;
  }
  if (!(error instanceof Error)) return "회원 생성에 실패했습니다.";
  if (/^(XLSX|회원 가져오기|기수|이름|캠퍼스|MM ID|이메일|사진 파일명|사진 목록|사진 ZIP|한 번에|가져올 회원 행)/.test(error.message)) {
    return error.message;
  }
  if (/duplicate|already|exists/i.test(error.message)) return "이미 활성화된 MM ID 또는 이메일입니다.";
  if (/photo|사진/i.test(error.message)) return "사진을 처리하지 못했습니다.";
  if (/mattermost|MM/i.test(error.message)) return "Mattermost 조회 또는 알림에 실패했습니다.";
  if (/email|SMTP/i.test(error.message)) return "이메일 알림을 보낼 수 없습니다.";
  return "회원 생성에 실패했습니다.";
}
