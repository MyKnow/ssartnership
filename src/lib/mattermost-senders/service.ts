import {
  MattermostApiError,
  MattermostAuthenticatedSession,
  MattermostClient,
} from "@/lib/mattermost/client";
import { getMattermostSenderKeyring } from "./config";
import {
  getMattermostSenderRuntimeHealthFailureCode,
  isMattermostSenderRuntimeFailureCode,
  type MattermostSenderFailurePhase,
} from "./health";
import { mattermostSenderRepository } from "./repository";

export type MattermostSenderSubject = {
  generation: number | null;
  isStaff: boolean;
  sourceYears?: readonly number[] | null;
};

export class MattermostSenderUnavailableError extends Error {
  readonly code: "sender_not_configured" | "configuration_invalid";

  constructor(code: "sender_not_configured" | "configuration_invalid") {
    super(code);
    this.name = "MattermostSenderUnavailableError";
    this.code = code;
  }
}

function uniquePositiveGenerations(values: readonly number[]) {
  return [...new Set(values.filter((value) => Number.isSafeInteger(value) && value > 0))]
    .sort((left, right) => right - left);
}

/**
 * A member never supplies team or channel details. Sender selection comes from
 * the member's local cohort link (or recorded staff source cohorts) only.
 */
export function getMattermostSenderCandidateGenerations(
  subject: MattermostSenderSubject,
) {
  if (!subject.isStaff) {
    return Number.isSafeInteger(subject.generation) && (subject.generation ?? 0) > 0
      ? [subject.generation as number]
      : [];
  }

  return uniquePositiveGenerations(subject.sourceYears ?? []);
}

export async function withActiveMattermostSenderForGeneration<T>(
  generation: number,
  operation: (session: MattermostAuthenticatedSession, sender: {
    id: string;
    generation: number;
    senderMattermostUserId: string;
    senderMattermostUsername: string | null;
  }) => Promise<T>,
) {
  let keyring;
  try {
    keyring = getMattermostSenderKeyring();
  } catch {
    throw new MattermostSenderUnavailableError("configuration_invalid");
  }

  const sender = await mattermostSenderRepository.getActiveSenderForGeneration(
    generation,
    keyring,
  );
  if (!sender) {
    throw new MattermostSenderUnavailableError("sender_not_configured");
  }

  const client = new MattermostClient();
  const attempt: { phase: MattermostSenderFailurePhase } = {
    phase: "authentication",
  };
  try {
    return await client.withAuthenticatedSender(
      sender.credentials,
      (session) => {
        attempt.phase = "operation";
        return operation(session, sender);
      },
    );
  } catch (error) {
    const healthFailureCode = error instanceof MattermostApiError
      ? getMattermostSenderRuntimeHealthFailureCode({
          code: error.code,
          phase: attempt.phase,
        })
      : null;
    if (healthFailureCode) {
      await mattermostSenderRepository.recordHealthFailure({
        senderId: sender.id,
        errorCode: healthFailureCode,
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function withActiveMattermostSenderForSubject<T>(
  subject: MattermostSenderSubject,
  operation: (session: MattermostAuthenticatedSession, sender: {
    id: string;
    generation: number;
    senderMattermostUserId: string;
    senderMattermostUsername: string | null;
  }) => Promise<T>,
) {
  const candidates = getMattermostSenderCandidateGenerations(subject);
  if (candidates.length === 0) {
    throw new MattermostSenderUnavailableError("sender_not_configured");
  }

  let lastUnavailable: unknown = null;
  for (const generation of candidates) {
    try {
      return await withActiveMattermostSenderForGeneration(generation, operation);
    } catch (error) {
      if (
        (error instanceof MattermostSenderUnavailableError && error.code === "sender_not_configured")
        || (error instanceof MattermostApiError && isMattermostSenderRuntimeFailureCode(error.code))
      ) {
        lastUnavailable = error;
        continue;
      }
      throw error;
    }
  }

  if (lastUnavailable) throw lastUnavailable;
  throw new MattermostSenderUnavailableError("sender_not_configured");
}
