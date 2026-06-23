import type { MmUserDirectorySyncResult, MmUserDirectorySnapshot } from "./shared";
import { mergeDirectorySnapshot } from "./shared";
import {
  getSsafyVerifyServerApiConfig,
} from "@/lib/ssafy-verify/config";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import { createSsafyVerifyServerApiClient } from "@/lib/ssafy-verify/server-api";
import {
  extractSsafyVerifyMemberProfiles,
  getSsafyVerifyProfileEventsNextCursor,
  toMmUserDirectorySnapshot,
} from "@/lib/ssafy-verify/profile";

type SelectableYearSnapshotBatch = {
  sourceYear: number;
  checked: number;
  snapshots: Map<string, MmUserDirectorySnapshot>;
  failures: MmUserDirectorySyncResult["failures"];
};

function createSnapshotBatch(): SelectableYearSnapshotBatch {
  return {
    sourceYear: 0,
    checked: 0,
    snapshots: new Map<string, MmUserDirectorySnapshot>(),
    failures: [],
  };
}

async function getVerifyProfileEventSnapshots(): Promise<SelectableYearSnapshotBatch> {
  const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
    trace: createSsafyVerifyApiTraceLogger({
      actorType: "system",
      properties: {
        flow: "profile_events_directory_sync",
      },
    }),
  });
  const snapshots = new Map<string, MmUserDirectorySnapshot>();
  const failures: MmUserDirectorySyncResult["failures"] = [];
  let checked = 0;
  let cursor: string | null = null;
  const seenCursors = new Set<string>();

  for (;;) {
    try {
      const payload = await client.getProfileEvents({
        cursor,
        limit: 100,
      });
      const profiles = extractSsafyVerifyMemberProfiles(payload);
      checked += profiles.length;

      for (const profile of profiles) {
        const snapshot = toMmUserDirectorySnapshot(profile);
        const existing = snapshots.get(snapshot.mmUserId);
        snapshots.set(
          snapshot.mmUserId,
          mergeDirectorySnapshot(existing, snapshot),
        );
      }

      const nextCursor = getSsafyVerifyProfileEventsNextCursor(payload);
      if (!nextCursor || seenCursors.has(nextCursor)) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    } catch (error) {
      failures.push({
        sourceYear: 0,
        reason: error instanceof Error ? error.message : "SSAFY Verify 프로필 이벤트 동기화 실패",
      });
      break;
    }
  }

  return {
    sourceYear: 0,
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
  const batch = await getVerifyProfileEventSnapshots();
  const batches = batch.checked === 0 && batch.failures.length === 0
    ? [createSnapshotBatch()]
    : [batch];

  return mergeSelectableYearSnapshotBatches(batches);
}
