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
  const [mattermostResult, verificationResult] = await Promise.all([
    source.mattermost_account_id
      ? supabase
          .from("mm_user_directory")
          .select("mm_user_id,mm_username")
          .eq("id", source.mattermost_account_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("member_ssafy_verifications")
      .select("ssafy_sub")
      .eq("member_id", memberId)
      .maybeSingle(),
  ]);
  if (mattermostResult.error || verificationResult.error) {
    return null;
  }

  const secret = getMemberIdentifierReservationSecret();
  return buildMemberIdentifierReservations(
    {
      emailNormalized: source.email_normalized,
      mmUserId: mattermostResult.data?.mm_user_id ?? null,
      mmUsername: mattermostResult.data?.mm_username ?? null,
      ssafySub: verificationResult.data?.ssafy_sub ?? null,
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

export async function anonymizeDeletedMember(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const [{ data: images, error: imageError }, { data: graduateProfile, error: profileError }] =
    await Promise.all([
      supabase
        .from("member_profile_images")
        .select("storage_path")
        .eq("member_id", memberId)
        .is("deleted_at", null),
      supabase
        .from("graduate_profiles")
        .select("verification_request_id")
        .eq("member_id", memberId)
        .maybeSingle(),
    ]);
  if (imageError) {
    throw new Error("익명화할 프로필 사진을 불러오지 못했습니다.");
  }
  if (profileError) {
    throw new Error("익명화할 수료생 인증 정보를 불러오지 못했습니다.");
  }

  const paths = (images ?? [])
    .map((image) => (image as { storage_path?: string | null }).storage_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error } = await supabase.storage
      .from(MEMBER_PROFILE_IMAGES_BUCKET)
      .remove(paths);
    if (error) {
      throw new Error("익명화할 프로필 사진을 삭제하지 못했습니다.");
    }
  }

  const verificationRequestId = (graduateProfile as {
    verification_request_id?: string | null;
  } | null)?.verification_request_id;
  if (verificationRequestId) {
    const { data: request, error: requestError } = await supabase
      .from("graduate_verification_requests")
      .select("certificate_storage_path")
      .eq("id", verificationRequestId)
      .maybeSingle();
    if (requestError) {
      throw new Error("익명화할 교육이수증 정보를 불러오지 못했습니다.");
    }
    const certificatePath = (request as {
      certificate_storage_path?: string | null;
    } | null)?.certificate_storage_path;
    if (certificatePath) {
      const { error } = await supabase.storage
        .from(GRADUATE_CERTIFICATES_BUCKET)
        .remove([certificatePath]);
      if (error) {
        throw new Error("익명화할 교육이수증을 삭제하지 못했습니다.");
      }
    }
  }

  const { data, error } = await supabase.rpc("anonymize_deleted_member", {
    p_member_id: memberId,
  });
  if (error) {
    throw new Error("회원 익명화를 처리하지 못했습니다.");
  }
  return data === true;
}

export { hashMemberIdentifierForAudit };
