import { OperationalNotificationPersistenceUncertainError } from "./persistence";
import {
  claimOperationalNotificationDedupe,
  releaseOperationalNotificationDedupe,
} from "./repository.supabase";
import type { OperationalNotificationDedupeInput } from "./types";
export { claimOperationalNotificationDedupe, releaseOperationalNotificationDedupe };
export type { OperationalNotificationDedupeInput };

export async function createDedupedOperationalNotification<T>(input: {
  dedupe: OperationalNotificationDedupeInput;
  create: () => Promise<T>;
  claim?: typeof claimOperationalNotificationDedupe;
  release?: typeof releaseOperationalNotificationDedupe;
}): Promise<T | null> {
  const claim = input.claim ?? claimOperationalNotificationDedupe;
  const release = input.release ?? releaseOperationalNotificationDedupe;
  const claimed = await claim(input.dedupe);
  if (!claimed) {
    return null;
  }

  try {
    return await input.create();
  } catch (creationError) {
    if (
      creationError instanceof OperationalNotificationPersistenceUncertainError
    ) {
      throw creationError;
    }
    try {
      await release(input.dedupe);
    } catch (releaseError) {
      throw new Error(
        "알림 생성에 실패했고 중복 방지 예약을 해제하지 못했습니다.",
        { cause: new AggregateError([creationError, releaseError]) },
      );
    }
    throw creationError;
  }
}
