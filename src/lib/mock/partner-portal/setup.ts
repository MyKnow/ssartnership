import { isValidPassword, hashPassword } from "../../password.ts";
import type {
  PartnerPortalDemoSetupSummary,
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "../../partner-portal.ts";
import { PartnerPortalSetupError } from "../../partner-portal-errors.ts";
import type { MockPortalSetupRecord } from "./shared.ts";
import { cloneSetupSummary } from "./shared.ts";
import {
  findMockPartnerPortalSetup,
  listMockPartnerPortalSetupsInternal,
} from "./store.ts";

export function toMockPartnerPortalSetupContext(
  record: MockPortalSetupRecord,
): PartnerPortalSetupContext {
  return {
    token: record.token,
    account: {
      id: record.account.id,
      loginId: record.account.loginId,
      displayName: record.account.displayName,
      email: record.account.email,
      mustChangePassword: record.account.mustChangePassword,
      emailVerifiedAt: record.account.emailVerifiedAt,
      initialSetupCompletedAt: record.account.initialSetupCompletedAt,
      isActive: record.account.isActive,
    },
    company: {
      id: record.company.id,
      name: record.company.name,
      slug: record.company.slug,
      description: record.company.description ?? null,
      services: record.company.services.map((service) => ({
        id: service.id,
        name: service.name,
        location: service.location,
        categoryLabel: service.categoryLabel,
        visibility: service.visibility,
      })),
    },
    isSetupComplete: Boolean(record.account.initialSetupCompletedAt),
    isMock: true,
  };
}

export async function listMockPartnerPortalSetups() {
  return listMockPartnerPortalSetupsInternal().map(cloneSetupSummary);
}

export async function getMockPartnerPortalSetupContext(token: string) {
  const setup = findMockPartnerPortalSetup(token);
  if (!setup) {
    return null;
  }
  return toMockPartnerPortalSetupContext(setup);
}

export async function completeMockPartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  const setup = findMockPartnerPortalSetup(input.token);
  if (!setup) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }

  if (setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalSetupError(
      "already_completed",
      "이미 초기 설정이 완료되었습니다.",
    );
  }

  if (input.password !== input.confirmPassword) {
    throw new PartnerPortalSetupError(
      "password_mismatch",
      "비밀번호 확인이 일치하지 않습니다.",
    );
  }

  if (!isValidPassword(input.password)) {
    throw new PartnerPortalSetupError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const passwordRecord = hashPassword(input.password);
  const completedAt = new Date().toISOString();

  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = false;
  setup.account.emailVerifiedAt = completedAt;
  setup.account.initialSetupCompletedAt = completedAt;
  setup.account.isActive = true;

  return {
    token: setup.token,
    accountId: setup.account.id,
    companyId: setup.company.id,
    loginId: setup.account.loginId,
    completedAt,
  };
}

export const mockPartnerPortalSetupTokens: PartnerPortalDemoSetupSummary[] =
  listMockPartnerPortalSetupsInternal().map(cloneSetupSummary);
