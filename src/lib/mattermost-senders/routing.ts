export type MattermostSenderTestRecipientKind =
  | "self"
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
  senderMattermostUserId: string | null | undefined;
}): MattermostSenderTestRecipient | null {
  const senderMattermostUserId = normalizeUserId(input.senderMattermostUserId);
  if (!senderMattermostUserId) return null;

  return {
    kind: "self",
    userId: senderMattermostUserId,
  };
}
