export type MattermostSenderAction = "create" | "read" | "update" | "delete";

type MattermostSenderPermissionAccount = {
  permissionId: string;
  permissions: {
    mattermost_senders?: Partial<Record<MattermostSenderAction, boolean>>;
  };
};

/**
 * Sender credential metadata is intentionally stricter than the regular
 * permission matrix. The super-admin template is a second, non-delegable gate.
 */
export function canManageMattermostSenders(
  account: MattermostSenderPermissionAccount | null | undefined,
  action: MattermostSenderAction,
) {
  return (
    account?.permissionId === "super_admin"
    && account.permissions.mattermost_senders?.[action] === true
  );
}
