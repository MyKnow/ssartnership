import { logAuthSecurity } from "@/lib/activity-logs";
import {
  findMmUserDirectoryStaffEntryByUsername,
  findMmUserDirectoryStudentEntryByUsernameAndYear,
} from "@/lib/mm-directory";
import { generateCode, hashCode } from "@/lib/mm-verification";
import {
  createDirectChannel,
  findUserInChannelByUsername,
  getStudentChannelConfig,
  getUserImage,
  sendPost,
} from "@/lib/mattermost";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getConfiguredSignupSsafyYearText,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  getPreferredStaffSourceYear,
  parseSignupSsafyYearValue,
  validateSignupSsafyYear,
} from "@/lib/ssafy-year";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { getRequestLogContext } from "@/lib/activity-logs";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
  delayMemberAuthFailure,
  recordMemberAuthFailure,
  recordMemberAuthSuccess,
} from "./throttle";
import { parseRequestCodeBody } from "./parsers";
import { isMattermostApiError, loginAsSsafySender, upsertDirectorySnapshotFromMmUser } from "./mattermost";
import { mmErrorResponse, mmOkResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export const REQUEST_CODE_RUNTIME = "nodejs";

const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

type RequestCodeTargetUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
};

function getRequestCodeLogProperties(
  year: number | null,
  extra: Record<string, unknown> = {},
) {
  return {
    year,
    ...extra,
  };
}

async function failRequestCode({
  context,
  throttleContext,
  year,
  error,
  status,
  reason,
  identifier,
  actorType = "guest",
  actorId,
  recordFailure = true,
  blockedDelay = false,
  message,
  extra = {},
}: {
  context: MmRouteContext;
  throttleContext: MemberAuthThrottleContext;
  year: number | null;
  error: string;
  status: number;
  reason: string;
  identifier?: string | null;
  actorType?: "guest" | "member";
  actorId?: string;
  recordFailure?: boolean;
  blockedDelay?: boolean;
  message?: string;
  extra?: Record<string, unknown>;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "member_signup_code_request",
    status: blockedDelay ? "blocked" : "failure",
    actorType,
    actorId,
    identifier: identifier ?? null,
    properties: getRequestCodeLogProperties(year, { reason, ...extra }),
  });

  if (recordFailure) {
    await recordMemberAuthFailure("request-code", throttleContext, blockedDelay);
  } else {
    await delayMemberAuthFailure("request-code", blockedDelay);
  }

  return mmErrorResponse(error, status, message);
}

async function resolveSignupTarget(
  username: string,
  year: number,
) {
  const directoryEntry =
    year === 0
      ? await findMmUserDirectoryStaffEntryByUsername(username)
      : await findMmUserDirectoryStudentEntryByUsernameAndYear(username, year);

  let targetUser: RequestCodeTargetUser | null = null;
  let targetDisplayName = directoryEntry?.display_name ?? null;
  let targetCampus = directoryEntry?.campus ?? null;
  let resolvedFromDirectory = Boolean(directoryEntry);
  let resolvedYearFromLive: number | null = null;
  let lastInaccessibleStatus: number | null = null;
  let attemptedLiveSearches = 0;
  let inaccessibleLiveSearches = 0;

  if (directoryEntry) {
    targetUser = {
      id: directoryEntry.mm_user_id,
      username: directoryEntry.mm_username,
      nickname: directoryEntry.display_name,
    };
  } else {
    const searchYears = year === 0 ? [15, 14] : [year];

    for (const searchYear of searchYears) {
      try {
        const senderLogin = await loginAsSsafySender(searchYear);
        attemptedLiveSearches += 1;
        const channelConfig = getStudentChannelConfig(searchYear);
        const candidate = await findUserInChannelByUsername(
          senderLogin.token,
          username,
          channelConfig,
        );
        if (!candidate) {
          continue;
        }

        const summary = await upsertDirectorySnapshotFromMmUser(candidate, [searchYear]);
        const isExpectedMatch = year === 0 ? summary.isStaff : !summary.isStaff;
        if (!isExpectedMatch) {
          continue;
        }

        targetUser = candidate;
        targetDisplayName = summary.displayName;
        targetCampus = summary.campus;
        resolvedFromDirectory = false;
        resolvedYearFromLive = searchYear;
        break;
      } catch (error) {
        if (isMattermostApiError(error)) {
          lastInaccessibleStatus = error.status;
          inaccessibleLiveSearches += 1;
          attemptedLiveSearches += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return {
    directoryEntry,
    targetUser,
    targetDisplayName,
    targetCampus,
    resolvedFromDirectory,
    resolvedYearFromLive,
    lastInaccessibleStatus,
    attemptedLiveSearches,
    inaccessibleLiveSearches,
  };
}

export async function handleRequestCodePost(request: Request) {
  const context = getRequestLogContext(request);
  let year: number | null = null;

  try {
    const payload = await parseRequestCodeBody(request);
    const cycleSettings = await getSsafyCycleSettings();
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const yearError = validateSignupSsafyYear(
      payload.year,
      "기수",
      new Date(),
      cycleSettings,
    );
    year = parseSignupSsafyYearValue(payload.year);
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    if (!username) {
      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    if (validateMmUsername(username)) {
      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    if (yearError || year === null) {
      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "invalid_year",
        status: 400,
        reason: "invalid_year",
        identifier: username,
        message: `회원가입은 현재 선택 가능한 ${getConfiguredSignupSsafyYearText(cycleSettings)}만 선택할 수 있습니다.`,
      });
    }

    const blockedState = await getMemberAuthBlockedState(
      "request-code",
      throttleContext,
    );
    if (blockedState) {
      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "blocked",
        status: 429,
        reason: "rate_limit",
        identifier: username,
        recordFailure: false,
        blockedDelay: true,
        extra: {
          scope: getMemberAuthBlockedScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
    }

    const supabase = getSupabaseAdminClient();
    const {
      directoryEntry,
      targetUser,
      targetDisplayName,
      targetCampus,
      resolvedFromDirectory,
      resolvedYearFromLive,
      lastInaccessibleStatus,
      attemptedLiveSearches,
      inaccessibleLiveSearches,
    } = await resolveSignupTarget(username, year);

    if (!targetUser) {
      if (
        lastInaccessibleStatus &&
        attemptedLiveSearches > 0 &&
        inaccessibleLiveSearches === attemptedLiveSearches
      ) {
        return failRequestCode({
          context,
          throttleContext,
          year,
          error: "request_failed",
          status: 400,
          reason: "team_or_channel_inaccessible",
          identifier: username,
          extra: {
            status: lastInaccessibleStatus,
          },
        });
      }

      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "request_failed",
        status: 400,
        reason: "not_found",
        identifier: username,
      });
    }

    const senderYear =
      year === 0
        ? resolvedYearFromLive ??
          getPreferredStaffSourceYear(directoryEntry?.source_years ?? []) ??
          15
        : year;
    const senderLogin = await loginAsSsafySender(senderYear);

    const { data: existing } = await supabase
      .from("mm_verification_codes")
      .select("created_at")
      .eq("mm_user_id", targetUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.created_at) {
      const createdAt = new Date(existing.created_at);
      const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        return failRequestCode({
          context,
          throttleContext,
          year,
          error: "cooldown",
          status: 429,
          reason: "cooldown",
          identifier: username,
        });
      }
    }

    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", targetUser.id);
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_user_id", targetUser.id);

    const { data: existingMember } = await supabase
      .from("members")
      .select(
        "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
      )
      .eq("mm_user_id", targetUser.id)
      .maybeSingle();

    if (existingMember?.id) {
      return failRequestCode({
        context,
        throttleContext,
        year,
        error: "request_failed",
        status: 400,
        reason: "already_registered",
        identifier: username,
        actorType: "member",
        actorId: existingMember.id,
        extra: {
          mmUserId: targetUser.id,
          mmUsername: targetUser.username,
        },
      });
    }

    const avatar = await getUserImage(senderLogin.token, targetUser.id);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await supabase.from("mm_verification_codes").insert({
      code_hash: hashCode(code),
      expires_at: expiresAt.toISOString(),
      mm_user_id: targetUser.id,
      mm_username: targetUser.username,
      display_name:
        targetDisplayName ?? targetUser.nickname ?? targetUser.username,
      year,
      campus: targetCampus,
      avatar_content_type: avatar?.contentType ?? null,
      avatar_base64: avatar?.base64 ?? null,
    });

    const dmChannel = await createDirectChannel(
      senderLogin.token,
      senderLogin.user.id,
      targetUser.id,
    );
    await sendPost(
      senderLogin.token,
      dmChannel.id,
      [
        "SSARTNERSHIP 인증코드입니다.",
        "",
        "인증코드",
        "```plaintext",
        code,
        "```",
        `유효시간: ${CODE_TTL_MINUTES}분`,
      ].join("\n"),
    );

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_code_request",
      status: "success",
      actorType: "guest",
      identifier: username,
      properties: getRequestCodeLogProperties(year, {
        mmUserId: targetUser.id,
        mmUsername: targetUser.username,
        campus: targetCampus,
        resolvedFromDirectory,
        resolvedYearFromLive,
      }),
    });
    await recordMemberAuthSuccess("request-code", throttleContext);

    return mmOkResponse();
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_code_request",
      status: "failure",
      actorType: "guest",
      properties: getRequestCodeLogProperties(year, {
        reason: "exception",
        message: (error as Error).message,
      }),
    });
    await delayMemberAuthFailure("request-code", true);

    return mmErrorResponse(
      "request_failed",
      503,
      "인증코드 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
