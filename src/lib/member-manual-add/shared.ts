import { normalizeMmUsername } from "@/lib/validation";

export type ManualMemberAddYear = 0 | 14 | 15;

export type ManualMemberAddInput = {
  raw: string;
  username: string;
};

export type ManualMemberAddItemStatus = "success" | "failed";

export type ManualMemberAddItem = {
  raw: string;
  username: string;
  requestedYear: ManualMemberAddYear;
  resolvedYear: number | null;
  memberId: string | null;
  mmUserId: string | null;
  mmUsername: string | null;
  displayName: string | null;
  campus: string | null;
  staffSourceYear: number | null;
  action: "created" | "updated" | null;
  status: ManualMemberAddItemStatus;
  reason: string | null;
};

export type ManualMemberAddBatchResult = {
  requestedYear: ManualMemberAddYear;
  total: number;
  success: number;
  failed: number;
  items: ManualMemberAddItem[];
};

export type ManualMemberAddFormState = ManualMemberAddBatchResult & {
  status: "idle" | "success" | "partial" | "error";
  message: string | null;
};

export type ManualMemberAddErrorCode = "db_error" | "lookup_failed" | "invalid_state";

export class ManualMemberAddError extends Error {
  code: ManualMemberAddErrorCode;

  constructor(code: ManualMemberAddErrorCode, message: string) {
    super(message);
    this.name = "ManualMemberAddError";
    this.code = code;
  }
}

export const MANUAL_MEMBER_ADD_INITIAL_STATE: ManualMemberAddFormState = {
  status: "idle",
  message: null,
  requestedYear: 15,
  total: 0,
  success: 0,
  failed: 0,
  items: [],
};

export const MANUAL_MEMBER_ADD_YEAR_FALLBACKS: ManualMemberAddYear[] = [15, 14];

export type SenderSession = {
  token: string;
  userId: string;
};

export function wrapManualMemberAddDbError(
  error: { message?: string | null } | null | undefined,
  message = "회원 추가를 처리하지 못했습니다.",
) {
  return new ManualMemberAddError("db_error", error?.message?.trim() || message);
}

export function parseManualMemberAddInputList(value: string): ManualMemberAddInput[] {
  const seen = new Set<string>();
  const inputs: ManualMemberAddInput[] = [];

  for (const rawToken of value.split(/[\n,]/)) {
    const raw = rawToken.trim();
    if (!raw) {
      continue;
    }
    const username = normalizeMmUsername(raw);
    if (seen.has(username)) {
      continue;
    }
    seen.add(username);
    inputs.push({ raw, username });
  }

  return inputs;
}
