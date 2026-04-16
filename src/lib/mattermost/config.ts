import type { StudentChannelConfig } from "@/lib/mattermost/types";

function getEnvValue(key: string) {
  return (process.env as Record<string, string | undefined>)[key]?.trim() ?? "";
}

export function getBaseUrl() {
  const base = process.env.MM_BASE_URL;
  if (!base) {
    throw new Error("MM_BASE_URL 환경 변수가 필요합니다.");
  }
  return base.replace(/\/$/, "");
}

export function getStudentChannelConfig(year?: number): StudentChannelConfig {
  const suffix = year ? `_${year}` : "";
  const teamName =
    getEnvValue(`MM_TEAM_NAME${suffix}`) || getEnvValue("MM_TEAM_NAME") || "s15public";
  const channelName =
    getEnvValue(`MM_STUDENT_CHANNEL${suffix}`) ||
    getEnvValue("MM_STUDENT_CHANNEL") ||
    "off-topic";

  return {
    teamName,
    channelName,
  };
}

export function getSenderCredentials(year?: number) {
  const suffix = year ? `_${year}` : "";
  const yearLoginId = getEnvValue(`MM_SENDER_LOGIN_ID${suffix}`);
  const yearPassword = getEnvValue(`MM_SENDER_PASSWORD${suffix}`);
  const loginId = yearLoginId || getEnvValue("MM_SENDER_LOGIN_ID");
  const password = yearPassword || getEnvValue("MM_SENDER_PASSWORD");

  if ((yearLoginId || yearPassword) && (!yearLoginId || !yearPassword)) {
    throw new Error(
      `MM_SENDER_LOGIN_ID${suffix}/MM_SENDER_PASSWORD${suffix} 환경 변수가 함께 필요합니다.`,
    );
  }

  if (!loginId || !password) {
    throw new Error("MM_SENDER_LOGIN_ID/MM_SENDER_PASSWORD 환경 변수가 필요합니다.");
  }

  return { loginId, password };
}
