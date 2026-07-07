export const SSAFY_VERIFY_PROFILE_SCOPES = [
  "ssafy.verify",
  "ssafy.affiliation",
  "ssafy.track",
  "ssafy.name",
  "ssafy.profile_image",
  "ssafy.role",
  "ssafy.mattermost_id",
] as const;

export const SSAFY_VERIFY_REAUTH_SCOPES = [
  "ssafy.verify",
  "ssafy.mattermost_id",
] as const;

export const SSAFY_VERIFY_SCOPES = SSAFY_VERIFY_PROFILE_SCOPES;
