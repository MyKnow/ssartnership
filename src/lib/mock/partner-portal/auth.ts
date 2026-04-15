import {
  isValidPassword,
  hashPassword,
  verifyPassword,
  generateTempPassword,
} from "../../password.ts";
import type {
  PartnerPortalLoginResult,
  PartnerPortalPasswordChangeResult,
  PartnerPortalPasswordResetResult,
} from "../../partner-portal.ts";
import { PartnerPortalLoginError } from "../../partner-portal-errors.ts";
import {
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "../../partner-password-errors.ts";
import { normalizePartnerLoginId } from "../../partner-utils.ts";
import {
  findMockPartnerPortalAccountByEmail,
  findMockPartnerPortalAccountById,
  listMockPartnerPortalSetupsInternal,
} from "./store.ts";

function toLoginResult(setup: NonNullable<ReturnType<typeof findMockPartnerPortalAccountById>>): PartnerPortalLoginResult {
  return {
    account: {
      id: setup.account.id,
      loginId: setup.account.loginId,
      displayName: setup.account.displayName,
      email: setup.account.email,
      mustChangePassword: setup.account.mustChangePassword,
      emailVerifiedAt: setup.account.emailVerifiedAt,
      initialSetupCompletedAt: setup.account.initialSetupCompletedAt,
      isActive: setup.account.isActive,
    },
    companyIds: [setup.company.id],
  };
}

export async function authenticateMockPartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  const normalizedLoginId = normalizePartnerLoginId(loginId);
  const setup = listMockPartnerPortalSetupsInternal().find(
    (item) => normalizePartnerLoginId(item.account.loginId) === normalizedLoginId,
  );

  if (!setup) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!setup.account.isActive) {
    throw new PartnerPortalLoginError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }

  if (setup.account.mustChangePassword && !setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalLoginError(
      "setup_required",
      "초기 설정이 필요합니다. 받은 링크로 먼저 비밀번호를 설정해 주세요.",
    );
  }

  const ok = verifyPassword(
    password,
    setup.account.passwordSalt,
    setup.account.passwordHash,
  );
  if (!ok) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  setup.account.lastLoginAt = new Date().toISOString();
  return toLoginResult(setup);
}

export async function requestMockPartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  const setup = findMockPartnerPortalAccountByEmail(email);
  if (!setup) {
    throw new PartnerPortalPasswordResetError(
      "not_found",
      "해당 이메일로 등록된 계정을 찾을 수 없습니다.",
    );
  }
  if (!setup.account.isActive) {
    throw new PartnerPortalPasswordResetError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }
  if (!setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalPasswordResetError(
      "setup_required",
      "아직 초기 설정이 완료되지 않았습니다. 초기 설정 링크를 먼저 사용해 주세요.",
    );
  }

  const temporaryPassword = generateTempPassword(12);
  const passwordRecord = hashPassword(temporaryPassword);
  const emailVerifiedAt = new Date().toISOString();

  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = true;
  setup.account.emailVerifiedAt = emailVerifiedAt;

  return {
    account: {
      ...toLoginResult(setup).account,
      mustChangePassword: true,
      emailVerifiedAt,
    },
    temporaryPassword,
    emailSentTo: setup.account.email,
  };
}

export async function changeMockPartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  const setup = findMockPartnerPortalAccountById(input.accountId);

  if (!setup || !setup.account.isActive) {
    throw new PartnerPortalPasswordChangeError(
      "unauthorized",
      "로그인 후 다시 시도해 주세요.",
    );
  }

  const ok = verifyPassword(
    input.currentPassword,
    setup.account.passwordSalt,
    setup.account.passwordHash,
  );
  if (!ok) {
    throw new PartnerPortalPasswordChangeError(
      "wrong_password",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!isValidPassword(input.nextPassword)) {
    throw new PartnerPortalPasswordChangeError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const passwordRecord = hashPassword(input.nextPassword);
  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = false;

  return {
    ...toLoginResult(setup),
    account: {
      ...toLoginResult(setup).account,
      mustChangePassword: false,
    },
  };
}
