import { parseSsafyProfileFromUser } from "../mm-profile.ts";
import {
  getConfiguredSelectableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { getSenderCredentials, getStudentChannelConfig } from "./config.ts";
import { loginWithPassword } from "./auth.ts";
import { findUserInChannelByUsername } from "./channels.ts";
import type { SelectableStudentMatch } from "./types.ts";

export async function resolveSelectableMemberByUsername(
  username: string,
): Promise<SelectableStudentMatch | null> {
  const safeUsername = username.replace(/^@/, "").trim().toLowerCase();
  const cycleSettings = await getSsafyCycleSettings();
  const studentYears = getConfiguredSelectableSsafyYears(cycleSettings).sort(
    (a, b) => b - a,
  );
  const searchPlans = [
    { years: studentYears, expectStaff: false },
    { years: [15, 14], expectStaff: true },
  ] as const;
  let lastError: unknown = null;

  for (const plan of searchPlans) {
    for (const year of plan.years) {
      try {
        const senderCredentials = getSenderCredentials(year);
        const senderLogin = await loginWithPassword(
          senderCredentials.loginId,
          senderCredentials.password,
        );
        const channelConfig = getStudentChannelConfig(year);
        const user = await findUserInChannelByUsername(
          senderLogin.token,
          safeUsername,
          channelConfig,
        );
        if (!user) {
          continue;
        }

        const profile = parseSsafyProfileFromUser(user);
        if (plan.expectStaff !== Boolean(profile.isStaff)) {
          continue;
        }

        return {
          year,
          senderToken: senderLogin.token,
          user,
          channelConfig,
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("MM 사용자 조회 실패");
  }

  return null;
}

export async function resolveSelectableStudentByUsername(
  username: string,
): Promise<SelectableStudentMatch | null> {
  return resolveSelectableMemberByUsername(username);
}
