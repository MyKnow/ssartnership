import { logAuthSecurity } from "@/lib/activity-logs";
import {
  getConfiguredSignupSsafyYearText,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  parseSignupSsafyYearValue,
  validateSignupSsafyYear,
} from "@/lib/ssafy-year";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { getRequestLogContext } from "@/lib/activity-logs";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
  recordMemberAuthSuccess,
} from "./throttle";
import { parseRequestCodeBody } from "./parsers";
import { loginAsSsafySender } from "./mattermost";
import { mmOkResponse } from "./responses";
import { clearExistingRequestCodeState, deliverRequestCode, findExistingRegisteredMember, getRequestCodeCooldownState } from "./request-code-delivery";
import {
  failRequestCode,
  failRequestCodeException,
  getRequestCodeLogProperties,
} from "./request-code-failure";
import {
  resolveRequestCodeSenderYear,
  resolveSignupTarget,
} from "./request-code-identity";

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

    const senderYear = resolveRequestCodeSenderYear({
      year,
      resolvedYearFromLive,
      directorySourceYears: directoryEntry?.source_years ?? [],
    });
    const senderLogin = await loginAsSsafySender(senderYear);

    const cooldownState = await getRequestCodeCooldownState(targetUser.id);
    if (cooldownState.inCooldown) {
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

    await clearExistingRequestCodeState(targetUser.id);

    const existingMember = await findExistingRegisteredMember(targetUser.id);
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

    await deliverRequestCode({
      senderToken: senderLogin.token,
      senderUserId: senderLogin.user.id,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      targetNickname: targetUser.nickname,
      targetDisplayName,
      targetCampus,
      year,
    });

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
    return failRequestCodeException({
      context,
      year,
      error,
    });
  }
}
