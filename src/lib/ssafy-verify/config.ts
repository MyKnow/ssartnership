export const SSAFY_VERIFY_ISSUER = "https://verify.myknow.xyz";
export const SSAFY_VERIFY_SDK_URL = `${SSAFY_VERIFY_ISSUER}/sdk/ssafy-verify.js`;
export const SSAFY_VERIFY_EXPECTED_ACR =
  "urn:ssafy:verify:assurance:mattermost-team-dm:v1";

export type SsafyVerifyServerConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  clientSecret: string | null;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

export function getSsafyVerifyServerConfig(): SsafyVerifyServerConfig {
  return {
    issuer: readRequiredEnv("SSAFY_VERIFY_ISSUER"),
    clientId: readRequiredEnv("SSAFY_VERIFY_CLIENT_ID"),
    redirectUri: readRequiredEnv("SSAFY_VERIFY_REDIRECT_URI"),
    clientSecret: process.env.SSAFY_VERIFY_CLIENT_SECRET?.trim() || null,
  };
}
