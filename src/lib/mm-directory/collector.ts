import { getMattermostDisplayName } from "@/lib/mm-member-sync/snapshot";
import { MattermostApiError, type MattermostAuthenticatedSession } from "@/lib/mattermost/client";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import { getMattermostSenderRoutingTemplate } from "@/lib/mattermost-senders/routing";
import {
  MattermostSenderUnavailableError,
  withActiveMattermostSenderForGeneration,
} from "@/lib/mattermost-senders/service";
import type { MmUserDirectorySyncResult, MmUserDirectorySnapshot } from "./shared";
import { mergeDirectorySnapshot } from "./shared";

const CHANNEL_MEMBERS_PAGE_SIZE = 200;
const USER_LOOKUP_CONCURRENCY = 8;

type SelectableYearSnapshotBatch = {
  sourceYear: number;
  checked: number;
  snapshots: Map<string, MmUserDirectorySnapshot>;
  failures: MmUserDirectorySyncResult["failures"];
};

function createSnapshotBatch(sourceYear = 0): SelectableYearSnapshotBatch {
  return {
    sourceYear,
    checked: 0,
    snapshots: new Map<string, MmUserDirectorySnapshot>(),
    failures: [],
  };
}

function toSafeFailureReason(error: unknown) {
  if (error instanceof MattermostSenderUnavailableError) {
    return error.code;
  }
  if (error instanceof MattermostApiError) {
    return error.code;
  }
  return "unavailable";
}

function chunk<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function collectChannelMemberIds(
  session: MattermostAuthenticatedSession,
  channelId: string,
) {
  const ids = new Set<string>();
  for (let page = 0; ; page += 1) {
    const nextPage = await session.listChannelMemberUserIds(
      channelId,
      page,
      CHANNEL_MEMBERS_PAGE_SIZE,
    );
    for (const id of nextPage) {
      ids.add(id);
    }
    if (nextPage.length < CHANNEL_MEMBERS_PAGE_SIZE) {
      return [...ids];
    }
  }
}

async function collectGenerationSnapshots(sourceYear: number): Promise<SelectableYearSnapshotBatch> {
  const batch = createSnapshotBatch(sourceYear);
  try {
    await withActiveMattermostSenderForGeneration(sourceYear, async (session) => {
      const template = getMattermostSenderRoutingTemplate(sourceYear);
      const team = await session.getTeamByName(template.teamName);
      const channel = await session.getChannelByName(team.id, template.channelName);
      const memberIds = await collectChannelMemberIds(session, channel.id);
      batch.checked = memberIds.length;

      for (const ids of chunk(memberIds, USER_LOOKUP_CONCURRENCY)) {
        const settled = await Promise.allSettled(ids.map((id) => session.getUserById(id)));
        settled.forEach((item, index) => {
          const userId = ids[index] ?? null;
          if (item.status === "rejected") {
            batch.failures.push({
              sourceYear,
              userId,
              reason: toSafeFailureReason(item.reason),
            });
            return;
          }
          const user = item.value;
          const snapshot: MmUserDirectorySnapshot = {
            mmUserId: user.id,
            mmUsername: user.username,
            displayName: getMattermostDisplayName(user),
            // Direct Mattermost never overwrites legacy SSAFY claims.
            campus: null,
            isStaff: false,
            sourceYears: [sourceYear],
          };
          const existing = batch.snapshots.get(snapshot.mmUserId);
          batch.snapshots.set(
            snapshot.mmUserId,
            mergeDirectorySnapshot(existing, snapshot),
          );
        });
      }
    });
  } catch (error) {
    batch.failures.push({
      sourceYear,
      reason: toSafeFailureReason(error),
    });
  }
  return batch;
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
  let activeGenerations: number[];
  try {
    const metadata = await mattermostSenderRepository.listMetadata();
    activeGenerations = metadata
      .filter((sender) => sender.status === "active")
      .map((sender) => sender.generation)
      .sort((left, right) => right - left);
  } catch {
    return mergeSelectableYearSnapshotBatches([
      {
        ...createSnapshotBatch(),
        failures: [{ sourceYear: 0, reason: "sender_registry_unavailable" }],
      },
    ]);
  }

  const batches = await Promise.all(activeGenerations.map(collectGenerationSnapshots));
  return mergeSelectableYearSnapshotBatches(
    batches.length > 0 ? batches : [createSnapshotBatch()],
  );
}
