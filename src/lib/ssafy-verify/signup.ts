import {
  getPreferredStaffSourceYear,
  SSAFY_STAFF_YEAR,
} from "@/lib/ssafy-year";
import { validatePasswordPolicy } from "@/lib/validation";
import type { SupabaseClient } from "@supabase/supabase-js";

type PasswordRecord = {
  hash: string;
  salt: string;
};

export type SsafySignupSessionData = {
  sub: string;
  mattermostUserId: string;
  mattermostUsername: string;
  displayName: string;
  cohort: number | null;
  campus: string | null;
  isStaff: boolean;
  sourceYears: number[];
  track: string | null;
  trackName: string | null;
  avatarUrl: string | null;
  authTime: number;
  verificationId: string | null;
  scope: string | null;
};

export type SsafySignupCompleteInput = {
  password: string;
  confirmPassword: string;
  servicePolicyId: string;
  privacyPolicyId: string;
  marketingPolicyId: string | null;
  marketingPolicyChecked: boolean;
};

export type SsafySignupCompleteFieldErrors = Partial<
  Record<
    | "password"
    | "confirmPassword"
    | "servicePolicyId"
    | "privacyPolicyId",
    string
  >
>;

export function parseSsafySignupCompleteInput(input: unknown):
  | { ok: true; data: SsafySignupCompleteInput }
  | {
      ok: false;
      errorCode: "INVALID_REQUEST";
      fieldErrors: SsafySignupCompleteFieldErrors;
    } {
  const value =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const data: SsafySignupCompleteInput = {
    password: typeof value.password === "string" ? value.password : "",
    confirmPassword:
      typeof value.confirmPassword === "string" ? value.confirmPassword : "",
    servicePolicyId:
      typeof value.servicePolicyId === "string" ? value.servicePolicyId : "",
    privacyPolicyId:
      typeof value.privacyPolicyId === "string" ? value.privacyPolicyId : "",
    marketingPolicyId:
      typeof value.marketingPolicyId === "string" && value.marketingPolicyId.trim()
        ? value.marketingPolicyId
        : null,
    marketingPolicyChecked: value.marketingPolicyChecked === true,
  };
  const fieldErrors: SsafySignupCompleteFieldErrors = {};
  const passwordError = validatePasswordPolicy(data.password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }
  if (!data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호 확인을 입력해 주세요.";
  } else if (data.password !== data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
  }
  if (!data.servicePolicyId) {
    fieldErrors.servicePolicyId = "서비스 이용약관에 동의해 주세요.";
  }
  if (!data.privacyPolicyId) {
    fieldErrors.privacyPolicyId = "개인정보 처리방침에 동의해 주세요.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, errorCode: "INVALID_REQUEST", fieldErrors }
    : { ok: true, data };
}

function resolveSignupGeneration(session: SsafySignupSessionData) {
  if (session.isStaff) {
    return {
      generation: SSAFY_STAFF_YEAR,
      staffSourceGeneration:
        getPreferredStaffSourceYear(session.sourceYears) ??
        (session.cohort !== null && session.cohort > SSAFY_STAFF_YEAR
          ? session.cohort
          : null),
    };
  }

  return {
    generation:
      session.cohort ?? session.sourceYears.find((generation) => generation > 0) ?? 0,
    staffSourceGeneration: null,
  };
}

export function buildSsafySignupMemberInsertPayload(input: {
  session: SsafySignupSessionData;
  passwordRecord: PasswordRecord;
  agreedAt: string;
}) {
  const { generation, staffSourceGeneration } = resolveSignupGeneration(input.session);

  return {
    display_name: input.session.displayName,
    generation,
    staff_source_generation: staffSourceGeneration,
    campus: input.session.campus,
    password_hash: input.passwordRecord.hash,
    password_salt: input.passwordRecord.salt,
    must_change_password: false,
    created_at: input.agreedAt,
    updated_at: input.agreedAt,
  };
}

function uniqueSortedGenerations(values: Iterable<number>) {
  return Array.from(new Set(values))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 99)
    .sort((left, right) => left - right);
}

export async function persistSsafySignupMemberDomainRecords(
  supabase: SupabaseClient,
  input: {
    memberId: string;
    session: SsafySignupSessionData;
    persistedAt: string;
  },
) {
  const { generation, staffSourceGeneration } = resolveSignupGeneration(input.session);
  const authTimeIso = new Date(input.session.authTime * 1000).toISOString();
  const sourceGenerations = uniqueSortedGenerations([
    ...input.session.sourceYears,
    generation,
    ...(staffSourceGeneration === null ? [] : [staffSourceGeneration]),
  ]);
  const { data: directory, error: directoryError } = await supabase
    .from("mm_user_directory")
    .upsert(
      {
        mm_user_id: input.session.mattermostUserId,
        mm_username: input.session.mattermostUsername,
        display_name: input.session.displayName,
        campus: input.session.campus,
        display_name_snapshot: input.session.displayName,
        campus_snapshot: input.session.campus,
        is_staff: input.session.isStaff,
        source_years: sourceGenerations,
        source_generations: sourceGenerations,
        is_active: true,
        synced_at: input.persistedAt,
        last_seen_at: input.persistedAt,
        updated_at: input.persistedAt,
      },
      { onConflict: "mm_user_id" },
    )
    .select("id")
    .single();

  if (directoryError || !directory?.id) {
    throw new Error("MM 계정 디렉토리를 저장하지 못했습니다.");
  }

  const { error: verificationError } = await supabase
    .from("member_ssafy_verifications")
    .upsert(
      {
        member_id: input.memberId,
        ssafy_sub: input.session.sub,
        verified_at: authTimeIso,
        auth_time: authTimeIso,
        verification_id: input.session.verificationId,
        track: input.session.track,
        track_name: input.session.trackName,
        last_scope: input.session.scope,
        updated_at: input.persistedAt,
      },
      { onConflict: "member_id" },
    );
  if (verificationError) {
    throw new Error("SSAFY 인증 정보를 저장하지 못했습니다.");
  }

  const { error: memberError } = await supabase
    .from("members")
    .update({
      mattermost_account_id: directory.id,
      generation,
      staff_source_generation: staffSourceGeneration,
      updated_at: input.persistedAt,
    })
    .eq("id", input.memberId);
  if (memberError) {
    throw new Error("회원 계정 연결을 저장하지 못했습니다.");
  }
}
