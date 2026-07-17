import { mattermostSenderRepository } from "./repository";

export async function getActiveMattermostSenderGenerations() {
  try {
    const metadata = await mattermostSenderRepository.listMetadata();
    return [...new Set(
      metadata
        .filter((sender) => sender.status === "active")
        .map((sender) => sender.generation)
        .filter((generation) => Number.isSafeInteger(generation) && generation > 0),
    )].sort((left, right) => left - right);
  } catch {
    // Public auth pages fail closed when the registry is unavailable.
    return [];
  }
}
