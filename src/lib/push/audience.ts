import { formatSsafyYearLabel } from "../ssafy-year.ts";
import { getMmUserDirectoryEntriesByAccountIds } from "../mm-directory/identities.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { parseMemberYearValue } from "../validation.ts";
import { wrapPushDbError } from "./config.ts";
import { PushError } from "./types.ts";
import type { PushAudience, ResolvedPushAudience } from "./types.ts";

export function getDefaultPushAudience(): PushAudience {
  return { scope: "all" };
}

export function parsePushAudience(input: unknown): PushAudience {
  if (!input || typeof input !== "object") {
    return getDefaultPushAudience();
  }

  const scope = String((input as { scope?: unknown }).scope ?? "all").trim();

  if (scope === "all") {
    return { scope: "all" };
  }

  if (scope === "year") {
    const year = parseMemberYearValue(
      (input as { year?: string | number | null }).year,
    );
    if (year === null) {
      throw new PushError("invalid_request", "기수를 선택해 주세요.");
    }
    return { scope: "year", year };
  }

  if (scope === "campus") {
    const campus = String((input as { campus?: unknown }).campus ?? "").trim();
    if (!campus) {
      throw new PushError("invalid_request", "캠퍼스를 선택해 주세요.");
    }
    return { scope: "campus", campus };
  }

  if (scope === "member") {
    const rawMemberIds = (input as { memberIds?: unknown }).memberIds;
    const memberIds = Array.isArray(rawMemberIds)
      ? rawMemberIds
          .map((value) => String(value ?? "").trim())
          .filter((value): value is string => Boolean(value))
      : [];
    const memberIdValue = (input as { memberId?: unknown }).memberId;
    const memberId =
      typeof memberIdValue === "string" ? memberIdValue.trim() : String(memberIdValue ?? "").trim();
    const selectedMemberIds =
      memberIds.length > 0 ? Array.from(new Set(memberIds)) : memberId ? [memberId] : [];
    if (selectedMemberIds.length === 0) {
      throw new PushError("invalid_request", "개인 발송 대상을 선택해 주세요.");
    }
    return { scope: "member", memberId: selectedMemberIds[0], memberIds: selectedMemberIds };
  }

  throw new PushError("invalid_request", "알림 발송 대상을 확인해 주세요.");
}

export async function resolvePushAudience(
  audience: PushAudience,
): Promise<ResolvedPushAudience> {
  const supabase = getSupabaseAdminClient();

  if (audience.scope === "all") {
    return {
      scope: "all",
      label: "전체",
      year: null,
      campus: null,
      memberId: null,
      memberIds: null,
    };
  }

  if (audience.scope === "year") {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("generation", audience.year);

    if (error) {
      throw wrapPushDbError(error, "발송 대상을 불러오지 못했습니다.");
    }

    return {
      scope: "year",
      label: formatSsafyYearLabel(audience.year),
      year: audience.year,
      campus: null,
      memberId: null,
      memberIds: (data ?? []).map((item) => item.id),
    };
  }

  if (audience.scope === "campus") {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("campus", audience.campus);

    if (error) {
      throw wrapPushDbError(error, "발송 대상을 불러오지 못했습니다.");
    }

    return {
      scope: "campus",
      label: `${audience.campus} 캠퍼스`,
      year: null,
      campus: audience.campus,
      memberId: null,
      memberIds: (data ?? []).map((item) => item.id),
    };
  }

  const memberIds = Array.isArray(audience.memberIds)
    ? audience.memberIds.filter((value): value is string => typeof value === "string" && Boolean(value))
    : [];
  const fallbackMemberId =
    typeof audience.memberId === "string" ? audience.memberId.trim() : String(audience.memberId ?? "").trim();
  const targetIds =
    memberIds.length > 0 ? Array.from(new Set(memberIds)) : fallbackMemberId ? [fallbackMemberId] : [];
  const { data, error } = await supabase
    .from("members")
    .select("id,display_name,mattermost_account_id")
    .in("id", targetIds);

  if (error) {
    throw wrapPushDbError(error, "발송 대상을 불러오지 못했습니다.");
  }
  if (!data || data.length === 0) {
    throw new PushError("not_found", "개인 발송 대상을 찾을 수 없습니다.");
  }

  const directoryByAccountId = await getMmUserDirectoryEntriesByAccountIds(
    data
      .map((member) => member.mattermost_account_id)
      .filter((accountId): accountId is string => Boolean(accountId)),
  );
  const sortedMembers = data
    .map((member) => {
      const directory = member.mattermost_account_id
        ? directoryByAccountId.get(member.mattermost_account_id)
        : null;
      return {
        ...member,
        mattermostUsername: directory?.mm_username ?? null,
      };
    })
    .sort((left, right) =>
      (left.display_name ?? left.mattermostUsername ?? "회원").localeCompare(
        right.display_name ?? right.mattermostUsername ?? "회원",
        "ko-KR",
      ),
    );
  const first = sortedMembers[0];
  const memberName = first.display_name?.trim() || first.mattermostUsername || "회원";
  const memberLabel = first.mattermostUsername
    ? `${memberName} (@${first.mattermostUsername})`
    : memberName;
  return {
    scope: "member",
    label:
      sortedMembers.length === 1
        ? memberLabel
        : `${memberLabel} 외 ${sortedMembers.length - 1}명`,
    year: null,
    campus: null,
    memberId: first.id,
    memberIds: sortedMembers.map((item) => item.id),
  };
}
