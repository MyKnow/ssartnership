import { cache } from "react";
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
import { activePartnerPortalRepository } from "./partner-auth/repository.ts";

export { listPartnerPortalDemoSetups } from "./partner-auth/repository.ts";

export async function requestPartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  return activePartnerPortalRepository.requestPasswordReset(email);
}

export async function changePartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  return activePartnerPortalRepository.changePassword(input);
}

export async function authenticatePartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  return activePartnerPortalRepository.authenticateLogin(loginId, password);
}

export function isPartnerPortalSetupError(
  error: unknown,
): error is PartnerPortalSetupError {
  return error instanceof PartnerPortalSetupError;
}

const getCachedPartnerPortalSetupContext = cache(async (token: string) =>
  activePartnerPortalRepository.getSetupContext(token),
);

export async function getPartnerPortalSetupContext(
  token: string,
): Promise<PartnerPortalSetupContext | null> {
  return getCachedPartnerPortalSetupContext(token);
}

export async function completePartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  return activePartnerPortalRepository.completeInitialSetup(input);
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
