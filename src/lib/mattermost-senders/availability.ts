import { mattermostSenderRepository } from "./repository";
import type { MattermostSenderMetadata } from "./types";

function positiveGenerations(values: readonly number[]) {
  return values.filter(
    (generation) => Number.isSafeInteger(generation) && generation > 0 && generation <= 99,
  );
}

function uniqueSortedGenerations(values: readonly number[]) {
  return [...new Set(positiveGenerations(values))].sort((left, right) => left - right);
}

function isRuntimeBlocked(sender: MattermostSenderMetadata, now = Date.now()) {
  if (!sender.healthBlockedUntil) return false;
  return new Date(sender.healthBlockedUntil).getTime() > now;
}

export type MattermostSenderSignupAvailability = {
  configuredSenderGenerations: number[];
  activeSenderGenerations: number[];
};

export async function getMattermostSenderSignupAvailability(): Promise<MattermostSenderSignupAvailability> {
  try {
    const metadata = await mattermostSenderRepository.listMetadata();
    return {
      configuredSenderGenerations: uniqueSortedGenerations(
        metadata
          .filter((sender) => sender.status === "active" || sender.status === "pending")
          .map((sender) => sender.generation),
      ),
      activeSenderGenerations: uniqueSortedGenerations(
        metadata
          .filter((sender) => sender.status === "active" && !isRuntimeBlocked(sender))
          .map((sender) => sender.generation),
      ),
    };
  } catch {
    // Public auth pages fail closed when the registry is unavailable.
    return {
      configuredSenderGenerations: [],
      activeSenderGenerations: [],
    };
  }
}

export async function getActiveMattermostSenderGenerations() {
  return (await getMattermostSenderSignupAvailability()).activeSenderGenerations;
}
