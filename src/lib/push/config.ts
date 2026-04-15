import { PushError } from "./types.ts";

export function wrapPushDbError(
  error: { message?: string | null } | null | undefined,
  message = "Push 데이터를 처리하지 못했습니다.",
) {
  return new PushError("db_error", error?.message?.trim() || message);
}

export function getPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new PushError(
      "config_missing",
      "Web Push를 사용하려면 NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT가 필요합니다.",
    );
  }

  return { publicKey, privateKey, subject };
}

export function isMissingPushTableError(error: {
  code?: string | null;
  message?: string | null;
}) {
  return (
    error.code === "42P01" ||
    error.message?.includes('relation "push_') ||
    error.message?.includes("Could not find the table")
  );
}

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getPushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}
