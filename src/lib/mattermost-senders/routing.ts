export type MattermostSenderTestRecipientKind =
  | "previous_generation_sender"
  | "super_admin_bootstrap";

export type MattermostSenderTestRecipient = {
  kind: MattermostSenderTestRecipientKind;
  userId: string;
};

function normalizeUserId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function getMattermostSenderRoutingTemplate(generation: number) {
  if (!Number.isSafeInteger(generation) || generation < 1 || generation > 99) {
    throw new Error("Mattermost Sender 기수를 확인해 주세요.");
  }

  return {
    teamName: `s${generation}public`,
    channelName: "town-square",
  };
}

export function resolveMattermostSenderTestRecipient(input: {
  generation: number;
  previousGenerationSenderUserId: string | null | undefined;
  superAdminMattermostUserId: string | null | undefined;
}): MattermostSenderTestRecipient | null {
  if (!Number.isSafeInteger(input.generation) || input.generation < 1) {
    return null;
  }

  const previousGenerationSenderUserId = normalizeUserId(
    input.previousGenerationSenderUserId,
  );
  if (previousGenerationSenderUserId) {
    return {
      kind: "previous_generation_sender",
      userId: previousGenerationSenderUserId,
    };
  }

  const superAdminMattermostUserId = normalizeUserId(
    input.superAdminMattermostUserId,
  );
  if (!superAdminMattermostUserId) {
    return null;
  }

  return {
    kind: "super_admin_bootstrap",
    userId: superAdminMattermostUserId,
  };
}
