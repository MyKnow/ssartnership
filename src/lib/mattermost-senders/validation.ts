import type { MattermostSenderCredentials } from "./crypto";

const CONTROL_CHARACTER_REGEX = /[\u0000-\u001F\u007F]/;
const MAX_LOGIN_ID_LENGTH = 256;
const MAX_PASSWORD_LENGTH = 512;

export type MattermostSenderCredentialInput = {
  generation: string | number | null | undefined;
  loginId: string | null | undefined;
  password: string | null | undefined;
};

export type MattermostSenderCredentialFieldErrors = Partial<
  Record<"generation" | "loginId" | "password", string>
>;

export type ParsedMattermostSenderCredentialInput = {
  generation: number;
  loginId: string;
  password: string;
};

export function parseMattermostSenderCredentialInput(
  input: MattermostSenderCredentialInput,
):
  | { ok: true; data: ParsedMattermostSenderCredentialInput }
  | { ok: false; fieldErrors: MattermostSenderCredentialFieldErrors } {
  const fieldErrors: MattermostSenderCredentialFieldErrors = {};
  const generationValue = String(input.generation ?? "").trim();
  const generation = Number(generationValue);
  const loginId = input.loginId?.trim() ?? "";
  const password = input.password ?? "";

  if (!Number.isSafeInteger(generation) || generation < 1 || generation > 99) {
    fieldErrors.generation = "1부터 99 사이의 기수를 입력해 주세요.";
  }
  if (
    !loginId
    || loginId.length > MAX_LOGIN_ID_LENGTH
    || CONTROL_CHARACTER_REGEX.test(loginId)
  ) {
    fieldErrors.loginId = "Mattermost 로그인 ID를 확인해 주세요.";
  }
  if (
    !password
    || password.length > MAX_PASSWORD_LENGTH
    || CONTROL_CHARACTER_REGEX.test(password)
  ) {
    fieldErrors.password = "Mattermost 비밀번호를 확인해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      generation,
      loginId,
      password,
    },
  };
}

export function toMattermostSenderCredentials(
  input: ParsedMattermostSenderCredentialInput,
): MattermostSenderCredentials {
  return {
    loginId: input.loginId,
    password: input.password,
  };
}
