import {
  getConfiguredSelectableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import type { SelectableStudentMatch } from "@/lib/mattermost/types";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import {
  createSsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import {
  extractSsafyVerifyMemberProfiles,
  toMmUserDirectorySnapshot,
  toSsafyVerifyMattermostUser,
} from "@/lib/ssafy-verify/profile";

export async function resolveSelectableMemberByUsername(
  username: string,
): Promise<SelectableStudentMatch | null> {
  const safeUsername = username.replace(/^@/, "").trim().toLowerCase();
  const cycleSettings = await getSsafyCycleSettings();
  const studentYears = getConfiguredSelectableSsafyYears(cycleSettings).sort(
    (a, b) => b - a,
  );
  const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
    trace: createSsafyVerifyApiTraceLogger({
      actorType: "system",
      identifier: safeUsername,
      properties: {
        flow: "selectable_member_directory_lookup",
        username: safeUsername,
      },
    }),
  });
  const searchPlans = [
    { years: studentYears, expectStaff: false },
    { years: [15, 14], expectStaff: true },
  ] as const;
  let lastError: unknown = null;

  for (const plan of searchPlans) {
    for (const year of plan.years) {
      try {
        const payload = await client.findMattermostUsers({
          username: safeUsername,
          cohort: year,
        });
        const profile = extractSsafyVerifyMemberProfiles(payload).find(
          (item) => item.isStaff === plan.expectStaff,
        );
        if (!profile) {
          continue;
        }

        return {
          year,
          user: toSsafyVerifyMattermostUser(profile),
          directorySnapshot: toMmUserDirectorySnapshot(profile, [year]),
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("SSAFY Verify 사용자 조회 실패");
  }

  return null;
}
