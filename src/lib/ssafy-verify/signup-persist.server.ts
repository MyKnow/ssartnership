import "server-only";

import { syncMemberProfileImage } from "@/lib/member-profile-images";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSignupGeneration,
  type SsafySignupSessionData,
} from "./signup";

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

  return syncMemberProfileImage({
    memberId: input.memberId,
    imageSource: "mattermost",
    avatarBase64: null,
    avatarContentType: null,
    avatarUrl: input.session.avatarUrl,
  });
}
