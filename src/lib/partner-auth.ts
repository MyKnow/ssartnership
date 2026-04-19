import {
  authenticateMockPartnerPortalLogin,
  requestMockPartnerPortalPasswordReset,
} from "./mock/partner-portal.ts";
import type {
  PartnerPortalLoginResult,
  PartnerPortalPasswordChangeResult,
  PartnerPortalPasswordResetResult,
  PartnerPortalSetupContext,
  PartnerPortalSetupInput,
  PartnerPortalSetupResult,
} from "./partner-portal.ts";
import {
  PartnerPortalSetupError,
  type PartnerPortalSetupErrorCode,
} from "./partner-portal-errors.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import {
  changeMockPartnerPortalPassword as changeMockPassword,
} from "./mock/partner-portal.ts";
import { activePartnerPortalRepository } from "./partner-auth/repository.ts";
import {
  authenticateSupabasePartnerPortalLogin,
  changeSupabasePartnerPortalPassword,
  completeSupabasePartnerPortalInitialSetup,
  getSupabasePartnerPortalSetupContext,
  requestSupabasePartnerPortalPasswordReset,
} from "./partner-auth/supabase.ts";

export { listPartnerPortalDemoSetups } from "./partner-auth/repository.ts";

export async function requestPartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  if (isPartnerPortalMock) {
    return requestMockPartnerPortalPasswordReset(email);
  }
  return requestSupabasePartnerPortalPasswordReset(email);
}

export async function changePartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  if (isPartnerPortalMock) {
    return changeMockPassword(input);
  }
  return changeSupabasePartnerPortalPassword(input);
}

export async function authenticatePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  if (isPartnerPortalMock) {
    return authenticateMockPartnerPortalLogin(loginId, password);
  }
  return authenticateSupabasePartnerPortalLogin(loginId, password);
}

export function isPartnerPortalSetupError(
  error: unknown,
): error is PartnerPortalSetupError {
  return error instanceof PartnerPortalSetupError;
}

export async function getPartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  if (isPartnerPortalMock) {
    return activePartnerPortalRepository.getSetupContext(token);
  }
  return getSupabasePartnerPortalSetupContext(token);
}

export async function completePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  if (isPartnerPortalMock) {
    return activePartnerPortalRepository.completeInitialSetup(input);
  }
  return completeSupabasePartnerPortalInitialSetup(input);
}

export function getPartnerPortalSetupErrorStatus(
  code: PartnerPortalSetupErrorCode,
) {
  switch (code) {
    case "not_found":
      return 404;
    case "already_completed":
      return 409;
    case "invalid_password":
    case "password_mismatch":
      return 400;
    default:
      return 400;
  }
}

export { getPartnerPortalSetupErrorMessage } from "./partner-portal-errors.ts";
export {
  PartnerPortalLoginError,
  type PartnerPortalLoginErrorCode,
  getPartnerPortalLoginErrorMessage,
  getPartnerPortalLoginErrorStatus,
} from "./partner-portal-errors.ts";
export {
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "./partner-password-errors.ts";
