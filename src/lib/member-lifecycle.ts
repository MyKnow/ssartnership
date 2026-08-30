import {
  buildMemberIdentifierReservations,
  type MemberIdentifierReservation,
} from "@/lib/member-domain";
import {
  getMemberIdentifierReservationSecret,
  hashMemberIdentifierForAudit,
} from "@/lib/member-identifier-reservations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const MEMBER_PROFILE_IMAGES_BUCKET = "member-profile-images";
const GRADUATE_CERTIFICATES_BUCKET = "graduate-certificates";
const ANONYMIZATION_BATCH_SIZE = 100;

type MemberReservationSource = {
  id: string;
  email_normalized: string | null;
  mattermost_account_id: string | null;
};

type MemberAnonymizationStoragePlan = {
  profileImagePaths: string[];
  certificatePaths: string[];
};

type MemberAnonymizationStoragePlanRpcRow = {
  profile_image_paths?: string[] | null;
  certificate_paths?: string[] | null;
};

type MemberAnonymizationStateRow = {
  deleted_at: string | null;
  anonymized_at: string | null;
};

function toRpcReservations(reservations: MemberIdentifierReservation[]) {
  return reservations.map((reservation) => ({
    identifier_kind: reservation.identifierKind,
    identifier_hash: reservation.identifierHash,
  }));
}

export async function buildMemberIdentifierReservationsForMember(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id,email_normalized,mattermost_account_id")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  if (memberError || !member?.id) {
    return null;
  }

  const source = member as MemberReservationSource;
  const mattermostResult = source.mattermost_account_id
    ? await supabase
        .from("mm_user_directory")
        .select("mm_user_id,mm_username")
        .eq("id", source.mattermost_account_id)
        .maybeSingle()
    : { data: null, error: null };
  if (mattermostResult.error) {
    return null;
  }

  const secret = getMemberIdentifierReservationSecret();
  return buildMemberIdentifierReservations(
    {
      emailNormalized: source.email_normalized,
      mmUserId: mattermostResult.data?.mm_user_id ?? null,
      mmUsername: mattermostResult.data?.mm_username ?? null,
    },
    secret,
  );
}

export async function softDeleteMember(memberId: string) {
  const reservations = await buildMemberIdentifierReservationsForMember(memberId);
  if (!reservations) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("soft_delete_member", {
    p_member_id: memberId,
    p_identifier_reservations: toRpcReservations(reservations),
  });
  if (error) {
    throw new Error("회원 탈퇴를 처리하지 못했습니다.");
  }
  return data === true;
}

export async function listMembersEligibleForAnonymization(limit = ANONYMIZATION_BATCH_SIZE) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .not("deleted_at", "is", null)
    .is("anonymized_at", null)
    .lte("deleted_at", cutoff)
    .order("deleted_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, ANONYMIZATION_BATCH_SIZE)));
  if (error) {
    throw new Error("익명화 대상을 불러오지 못했습니다.");
  }
  return (data ?? []) as Array<{ id: string }>;
}

async function readMemberAnonymizationStoragePlan(
  memberId: string,
): Promise<MemberAnonymizationStoragePlan | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "get_deleted_member_anonymization_storage_plan",
    { p_member_id: memberId },
  );
  if (error) {
    throw new Error("익명화할 비공개 파일 정보를 불러오지 못했습니다.");
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | MemberAnonymizationStoragePlanRpcRow
    | null;
  if (!row) {
    return null;
  }

  const normalizePaths = (paths: string[] | null | undefined) => [
    ...new Set(
      (paths ?? [])
        .map((path) => path.trim())
        .filter((path) => path.length > 0),
    ),
  ];
  const profileImagePaths = normalizePaths(row.profile_image_paths);
  const certificatePaths = normalizePaths(row.certificate_paths);

  return { profileImagePaths, certificatePaths };
}

export async function anonymizeDeletedMember(memberId: string) {
  // Storage mutations cannot join the database transaction. Recheck the
  // 30-day gate before deleting every referenced private object, retain the
  // database paths until removal succeeds, then let the RPC atomically purge
  // relational data. A failed removal leaves the plan retryable; a failed RPC
  // is surfaced instead of reporting a partially completed anonymization.
  const storagePlan = await readMemberAnonymizationStoragePlan(memberId);
  if (!storagePlan) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const paths = storagePlan.profileImagePaths;
  if (paths.length > 0) {
    const { error } = await supabase.storage
      .from(MEMBER_PROFILE_IMAGES_BUCKET)
      .remove(paths);
    if (error) {
      throw new Error("익명화할 프로필 사진을 삭제하지 못했습니다.");
    }
  }

  if (storagePlan.certificatePaths.length > 0) {
    const { error } = await supabase.storage
      .from(GRADUATE_CERTIFICATES_BUCKET)
      .remove(storagePlan.certificatePaths);
    if (error) {
      throw new Error("익명화할 교육이수증을 삭제하지 못했습니다.");
    }
  }

  const { data, error } = await supabase.rpc("anonymize_deleted_member", {
    p_member_id: memberId,
  });
  if (error) {
    throw new Error("회원 익명화를 처리하지 못했습니다.");
  }
  if (data !== true) {
    const { data: currentMember, error: stateError } = await supabase
      .from("members")
      .select("deleted_at,anonymized_at")
      .eq("id", memberId)
      .maybeSingle();
    if (stateError) {
      throw new Error("회원 익명화 상태를 확인하지 못했습니다.");
    }
    if ((currentMember as MemberAnonymizationStateRow | null)?.anonymized_at) {
      return false;
    }
    throw new Error("회원 익명화 상태가 변경되었습니다.");
  }
  return true;
}

export { hashMemberIdentifierForAudit };
