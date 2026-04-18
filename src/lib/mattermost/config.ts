import type { StudentChannelConfig } from "@/lib/mattermost/types";

function getEnvValue(key: string) {
  return (process.env as Record<string, string | undefined>)[key]?.trim() ?? "";
}

function getYearSuffix(year?: number) {
  return year ? `_${year}` : "";
}

export function getBaseUrl() {
  const base = process.env.MM_BASE_URL;
  if (!base) {
    throw new Error("MM_BASE_URL 환경 변수가 필요합니다.");
  }
  return base.replace(/\/$/, "");
}

export function getStudentChannelConfig(year?: number): StudentChannelConfig {
  const suffix = getYearSuffix(year);
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

export function hasSenderCredentials(
  year?: number,
  options?: { allowDefaultFallback?: boolean },
) {
  const suffix = getYearSuffix(year);
  const yearLoginId = getEnvValue(`MM_SENDER_LOGIN_ID${suffix}`);
  const yearPassword = getEnvValue(`MM_SENDER_PASSWORD${suffix}`);

  if (yearLoginId || yearPassword) {
    return Boolean(yearLoginId && yearPassword);
  }

  if (options?.allowDefaultFallback === false) {
    return false;
  }

  return Boolean(
    getEnvValue("MM_SENDER_LOGIN_ID") && getEnvValue("MM_SENDER_PASSWORD"),
  );
}

export function listConfiguredSenderYears() {
  const years = new Set<number>();

  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) {
      continue;
    }
    const match = key.match(/^MM_SENDER_LOGIN_ID_(\d+)$/);
    if (!match) {
      continue;
    }
    const year = Number(match[1]);
    if (Number.isFinite(year) && hasSenderCredentials(year, { allowDefaultFallback: false })) {
      years.add(year);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

export function getSenderCredentials(
  year?: number,
  options?: { allowDefaultFallback?: boolean },
) {
  const suffix = getYearSuffix(year);
  const yearLoginId = getEnvValue(`MM_SENDER_LOGIN_ID${suffix}`);
  const yearPassword = getEnvValue(`MM_SENDER_PASSWORD${suffix}`);
  const allowDefaultFallback = options?.allowDefaultFallback !== false;
  const loginId =
    yearLoginId || (allowDefaultFallback ? getEnvValue("MM_SENDER_LOGIN_ID") : "");
  const password =
    yearPassword || (allowDefaultFallback ? getEnvValue("MM_SENDER_PASSWORD") : "");

  if ((yearLoginId || yearPassword) && (!yearLoginId || !yearPassword)) {
    throw new Error(
      `MM_SENDER_LOGIN_ID${suffix}/MM_SENDER_PASSWORD${suffix} 환경 변수가 함께 필요합니다.`,
    );
  }

  if (!loginId || !password) {
    if (year && !allowDefaultFallback) {
      throw new Error(
        `MM_SENDER_LOGIN_ID_${year}/MM_SENDER_PASSWORD_${year} 환경 변수가 필요합니다.`,
      );
    }
    throw new Error("MM_SENDER_LOGIN_ID/MM_SENDER_PASSWORD 환경 변수가 필요합니다.");
  }

  return { loginId, password };
}
