import { createHmacDigest } from "@/lib/hmac.js";
import {
  buildMemberIdentifierReservations,
  type MemberIdentifierReservationInput,
} from "@/lib/member-domain";
import { findMmUserDirectoryEntryByUserId } from "@/lib/mm-directory";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export function getMemberIdentifierReservationSecret() {
  const secret =
    process.env.MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET
    ?? process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("회원 식별자 예약용 HMAC 비밀값이 필요합니다.");
  }
  return secret;
}

export function buildReservedMemberIdentifierHashes(
  input: MemberIdentifierReservationInput,
) {
  return buildMemberIdentifierReservations(
    input,
    getMemberIdentifierReservationSecret(),
  );
}

export async function hasReservedMemberIdentifier(
  input: MemberIdentifierReservationInput,
) {
  const reservations = buildReservedMemberIdentifierHashes(input);
  if (reservations.length === 0) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_identifier_reservations")
    .select("identifier_kind,identifier_hash")
    .in(
      "identifier_hash",
      reservations.map((reservation) => reservation.identifierHash),
    );
  if (error) {
    throw new Error("회원 식별자 예약 상태를 확인하지 못했습니다.");
  }

  const reservationKeys = new Set(
    reservations.map(
      (reservation) => `${reservation.identifierKind}:${reservation.identifierHash}`,
    ),
  );
  return (data ?? []).some((row) =>
    reservationKeys.has(`${row.identifier_kind}:${row.identifier_hash}`),
  );
}

/**
 * An active member is not stored in the reservation ledger. Check both data
 * sources so a successful Mattermost code verification can stop before the
 * password/policy completion screen for every existing account type.
 */
export async function hasExistingMattermostMember(input: {
  mmUserId: string;
  mmUsername: string;
}) {
  const [isReserved, directory] = await Promise.all([
    hasReservedMemberIdentifier(input),
    findMmUserDirectoryEntryByUserId(input.mmUserId),
  ]);
  if (isReserved || !directory?.id) {
    return isReserved;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("mattermost_account_id", directory.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error("기존 Mattermost 회원 상태를 확인하지 못했습니다.");
  }
  return Boolean(data?.id);
}

export function hashMemberIdentifierForAudit(value: string) {
  return createHmacDigest(
    `audit:${value.trim().toLowerCase()}`,
    getMemberIdentifierReservationSecret(),
    "hex",
  );
}
