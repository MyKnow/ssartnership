export const MATTERMOST_LOGIN_DISABLED_REASONS = [
  "generation_completed",
  "member_departed",
  "provider_not_found",
] as const;

export type MattermostLoginDisabledReason =
  (typeof MATTERMOST_LOGIN_DISABLED_REASONS)[number];

export function isMattermostLoginDisabledReason(
  value: unknown,
): value is MattermostLoginDisabledReason {
  return typeof value === "string"
    && MATTERMOST_LOGIN_DISABLED_REASONS.includes(
      value as MattermostLoginDisabledReason,
    );
}
