import {
  getChannelByName,
  getSenderCredentials,
  getStudentChannelConfig,
  getTeamByName,
  getUserById,
  listChannelMembers,
  loginWithPassword,
} from "@/lib/mattermost";
import {
  getConfiguredSelectableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import type { MmUserDirectorySyncResult, MmUserDirectorySnapshot } from "./shared";
import { buildSnapshotFromUser, mergeDirectorySnapshot } from "./shared";

async function listAllChannelMemberIds(token: string, channelId: string) {
  const memberIds: string[] = [];
  let page = 0;
  const perPage = 200;

  for (;;) {
    const members = await listChannelMembers(token, channelId, page, perPage);
    if (members.length === 0) {
      break;
    }
    memberIds.push(
      ...members
        .map((member) => member.user_id ?? member.userId ?? null)
        .filter((value): value is string => Boolean(value)),
    );
    if (members.length < perPage) {
      break;
    }
    page += 1;
  }

  return memberIds;
}

type SelectableYearSnapshotBatch = {
  sourceYear: number;
  checked: number;
  snapshots: Map<string, MmUserDirectorySnapshot>;
  failures: MmUserDirectorySyncResult["failures"];
};

async function getSelectableYearUserSnapshots(
  sourceYear: number,
): Promise<SelectableYearSnapshotBatch> {
  const snapshots = new Map<string, MmUserDirectorySnapshot>();
  const failures: MmUserDirectorySyncResult["failures"] = [];
  let checked = 0;

  try {
    const credentials = getSenderCredentials(sourceYear);
    const senderLogin = await loginWithPassword(
      credentials.loginId,
      credentials.password,
    );
    const channelConfig = getStudentChannelConfig(sourceYear);
    const team = await getTeamByName(senderLogin.token, channelConfig.teamName);
    const channel = await getChannelByName(
      senderLogin.token,
      team.id,
      channelConfig.channelName,
    );
    const memberIds = await listAllChannelMemberIds(senderLogin.token, channel.id);
    checked += memberIds.length;

    const users = await Promise.all(
      memberIds.map(async (userId) => {
        try {
          return await getUserById(senderLogin.token, userId);
        } catch (error) {
          failures.push({
            sourceYear,
            userId,
            reason: error instanceof Error ? error.message : "MM 사용자 조회 실패",
          });
          return null;
        }
      }),
    );

    for (const user of users) {
      if (!user || user.is_bot) {
        continue;
      }

      const snapshot = buildSnapshotFromUser(user, sourceYear);
      const existing = snapshots.get(snapshot.mmUserId);
      snapshots.set(
        snapshot.mmUserId,
        mergeDirectorySnapshot(existing, snapshot),
      );
    }
  } catch (error) {
    failures.push({
      sourceYear,
      reason: error instanceof Error ? error.message : "MM 디렉토리 동기화 실패",
    });
  }

  return {
    sourceYear,
    checked,
    snapshots,
    failures,
  };
}

export function mergeSelectableYearSnapshotBatches(
  batches: SelectableYearSnapshotBatch[],
) {
  const snapshots = new Map<string, MmUserDirectorySnapshot>();
  const failures: MmUserDirectorySyncResult["failures"] = [];
  let checked = 0;

  for (const batch of batches) {
    checked += batch.checked;
    failures.push(...batch.failures);
    for (const snapshot of batch.snapshots.values()) {
      const existing = snapshots.get(snapshot.mmUserId);
      snapshots.set(
        snapshot.mmUserId,
        mergeDirectorySnapshot(existing, snapshot),
      );
    }
  }

  return {
    checked,
    snapshots,
    failures,
  };
}

export async function getAllSelectableUserSnapshots() {
  const cycleSettings = await getSsafyCycleSettings();
  const configuredSelectableYears = getConfiguredSelectableSsafyYears(
    cycleSettings,
  );
  const years = Array.from(
    new Set([...configuredSelectableYears, 15, 14]),
  ).sort((a, b) => b - a);

  const batches = await Promise.all(
    years.map((sourceYear) => getSelectableYearUserSnapshots(sourceYear)),
  );

  return mergeSelectableYearSnapshotBatches(batches);
}
