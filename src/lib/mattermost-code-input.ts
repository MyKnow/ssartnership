import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export type MattermostVerificationRequest = {
  username: string;
  generation: number;
};

export function parseMattermostVerificationRequest(input: unknown):
  | { ok: true; data: MattermostVerificationRequest }
  | { ok: false; fieldErrors: Partial<Record<"username" | "generation", string>> } {
  const value = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const username = normalizeMmUsername(
    typeof value.username === "string" ? value.username : "",
  );
  const generation = Number(String(value.generation ?? "").trim());
  const fieldErrors: Partial<Record<"username" | "generation", string>> = {};
  if (validateMmUsername(username)) {
    fieldErrors.username = "Mattermost ID 형식을 확인해 주세요.";
  }
  if (!Number.isSafeInteger(generation) || generation < 0 || generation > 99) {
    fieldErrors.generation = "기수는 0부터 99 사이로 입력해 주세요. 운영진은 0을 입력합니다.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, data: { username, generation } };
}
