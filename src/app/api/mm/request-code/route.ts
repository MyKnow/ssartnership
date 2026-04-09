import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateCode, hashCode } from "@/lib/mm-verification";
import {
  createDirectChannel,
  MattermostApiError,
  getStudentChannelConfig,
  getSenderCredentials,
  findUserInChannelByUsername,
  getUserImage,
  loginWithPassword,
  sendPost,
} from "@/lib/mattermost";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import {
  findMmUserDirectoryStaffEntryByUsername,
  findMmUserDirectoryStudentEntryByUsernameAndYear,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import {
  getConfiguredSignupSsafyYearText,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  getPreferredStaffSourceYear,
  parseSignupSsafyYearValue,
  validateSignupSsafyYear,
} from "@/lib/ssafy-year";
import {
  normalizeMmUsername,
  validateMmUsername,
} from "@/lib/validation";

export const runtime = "nodejs";

const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function getRequestCodeLogProperties(
  year: number | null,
  extra: Record<string, unknown> = {},
) {
  return {
    year,
    ...extra,
  };
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  let year: number | null = null;
  try {
    const payload = (await request.json()) as {
      username?: string;
      year?: string | number;
    };
    const cycleSettings = await getSsafyCycleSettings();

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const yearError = validateSignupSsafyYear(
      payload.year,
      "기수",
      new Date(),
      cycleSettings,
    );
    year = parseSignupSsafyYearValue(payload.year);
    if (!username) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        properties: getRequestCodeLogProperties(year, { reason: "missing_fields" }),
      });
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: getRequestCodeLogProperties(year, {
          reason: "invalid_username",
        }),
      });
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
    if (yearError || year === null) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username || null,
        properties: getRequestCodeLogProperties(year, { reason: "invalid_year" }),
      });
      return NextResponse.json(
        {
          error: "invalid_year",
          message: `회원가입은 현재 선택 가능한 ${getConfiguredSignupSsafyYearText(cycleSettings)}만 선택할 수 있습니다.`,
        },
        { status: 400 },
      );
    }
    const supabase = getSupabaseAdminClient();
    const directoryEntry =
      year === 0
        ? await findMmUserDirectoryStaffEntryByUsername(username)
        : await findMmUserDirectoryStudentEntryByUsernameAndYear(username, year);
    let targetUser:
      | {
          id: string;
          username: string;
          nickname?: string;
          first_name?: string;
          last_name?: string;
          is_bot?: boolean;
        }
      | null = null;
    let targetDisplayName = directoryEntry?.display_name ?? null;
    let targetCampus = directoryEntry?.campus ?? null;
    let resolvedFromDirectory = Boolean(directoryEntry);
    let resolvedYearFromLive: number | null = null;
    let lastInaccessibleError: MattermostApiError | null = null;
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
          const senderCredentials = getSenderCredentials(searchYear);
          const senderLogin = await loginWithPassword(
            senderCredentials.loginId,
            senderCredentials.password,
          );
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

          const profile = parseSsafyProfileFromUser(candidate);
          const isExpectedMatch = year === 0
            ? Boolean(profile.isStaff)
            : !profile.isStaff;
          if (!isExpectedMatch) {
            continue;
          }

          targetUser = candidate;
          targetDisplayName =
            profile.displayName ?? candidate.nickname ?? candidate.username;
          targetCampus = profile.campus ?? null;
          resolvedFromDirectory = false;
          resolvedYearFromLive = searchYear;
          await upsertMmUserDirectorySnapshot({
            mmUserId: candidate.id,
            mmUsername: candidate.username,
            displayName: targetDisplayName,
            campus: targetCampus,
            isStaff: Boolean(profile.isStaff),
            sourceYears: [searchYear],
          });
          break;
        } catch (error) {
          if (error instanceof MattermostApiError) {
            lastInaccessibleError = error;
            inaccessibleLiveSearches += 1;
            attemptedLiveSearches += 1;
            continue;
          }
          throw error;
        }
      }

      if (!targetUser) {
        if (
          lastInaccessibleError &&
          attemptedLiveSearches > 0 &&
          inaccessibleLiveSearches === attemptedLiveSearches
        ) {
          await logAuthSecurity({
            ...context,
            eventName: "member_signup_code_request",
            status: "failure",
            actorType: "guest",
            identifier: username,
            properties: getRequestCodeLogProperties(year, {
              reason: "team_or_channel_inaccessible",
              status: lastInaccessibleError.status,
            }),
          });
          return NextResponse.json(
            {
              error: "team_or_channel_inaccessible",
              message:
                "운영용 MM 계정이 대상 팀/채널을 읽을 수 없습니다. MM_TEAM_NAME 설정과 팀 권한을 확인해 주세요.",
            },
            { status: 403 },
          );
        }

        await logAuthSecurity({
          ...context,
          eventName: "member_signup_code_request",
          status: "failure",
          actorType: "guest",
          identifier: username,
          properties: getRequestCodeLogProperties(year, { reason: "not_found" }),
        });
        return NextResponse.json(
          { error: "not_found", message: "해당 MM 계정을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
    }

    const senderYear =
      year === 0
        ? resolvedYearFromLive ??
          getPreferredStaffSourceYear(directoryEntry?.source_years ?? []) ??
          15
        : year;
    const senderCredentials = getSenderCredentials(senderYear);
    const senderLogin = await loginWithPassword(
      senderCredentials.loginId,
      senderCredentials.password,
    );

    const { data: existing } = await supabase
      .from("mm_verification_codes")
      .select("created_at")
      .eq("mm_user_id", targetUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.created_at) {
      const createdAt = new Date(existing.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        await logAuthSecurity({
          ...context,
          eventName: "member_signup_code_request",
          status: "blocked",
          actorType: "guest",
          identifier: username,
          properties: getRequestCodeLogProperties(year, { reason: "cooldown" }),
        });
        return NextResponse.json({ error: "cooldown" }, { status: 429 });
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
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "member",
        actorId: existingMember.id,
        identifier: username,
        properties: getRequestCodeLogProperties(year, {
          reason: "already_registered",
          mmUserId: targetUser.id,
          mmUsername: targetUser.username,
        }),
      });
      return NextResponse.json({ error: "already_registered" }, { status: 409 });
    }

    const avatarPromise = getUserImage(senderLogin.token, targetUser.id);
    const avatar = await avatarPromise;
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

    return NextResponse.json({ ok: true });
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
    return NextResponse.json(
      { error: "request_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
