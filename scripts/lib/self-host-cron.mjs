const CRON_PATH_PATTERN = /^\/api\/cron\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_LOCAL_HOSTS = new Set(["localhost", "[::1]", "app"]);

export const SELF_HOST_CRON_TIMEOUT_MS = 10_000;

export class SelfHostCronError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** @returns {never} */
function fail(code) {
  throw new SelfHostCronError(code);
}

function isValidCronNumber(value, min, max) {
  if (!/^\d+$/.test(value)) return false;

  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max;
}

function isValidCronField(field, min, max) {
  const maximumStep = max - min + 1;

  return field.split(",").every((segment) => {
    const [range, step, ...extra] = segment.split("/");
    if (!range || extra.length > 0 || (segment.includes("/") && !step)) {
      return false;
    }

    if (step && (!isValidCronNumber(step, 1, maximumStep))) return false;

    if (range === "*") return true;

    const match = range.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return false;

    const [, start, end] = match;
    return (
      isValidCronNumber(start, min, max) &&
      (!end || (isValidCronNumber(end, min, max) && Number(start) <= Number(end)))
    );
  });
}

export function isSaneCronSchedule(schedule) {
  if (typeof schedule !== "string" || !schedule || schedule.trim() !== schedule) {
    return false;
  }

  const fields = schedule.split(/\s+/);
  if (fields.length !== 5) return false;

  return [
    isValidCronField(fields[0], 0, 59),
    isValidCronField(fields[1], 0, 23),
    isValidCronField(fields[2], 1, 31),
    isValidCronField(fields[3], 1, 12),
    isValidCronField(fields[4], 0, 7),
  ].every(Boolean);
}

export function parseCronSchedules(vercelConfig) {
  if (!vercelConfig || typeof vercelConfig !== "object" || !Array.isArray(vercelConfig.crons)) {
    fail("CRON_SCHEDULE_CONFIG_INVALID");
  }

  const entries = vercelConfig.crons.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.path !== "string" ||
      !CRON_PATH_PATTERN.test(entry.path) ||
      !isSaneCronSchedule(entry.schedule)
    ) {
      fail("CRON_SCHEDULE_CONFIG_INVALID");
    }

    return Object.freeze({ path: entry.path, schedule: entry.schedule });
  });

  if (entries.length === 0 || new Set(entries.map((entry) => entry.path)).size !== entries.length) {
    fail("CRON_SCHEDULE_CONFIG_INVALID");
  }

  return Object.freeze(entries);
}

export function loadCronSchedules(configSource) {
  if (typeof configSource !== "string") fail("CRON_SCHEDULE_CONFIG_INVALID");

  try {
    return parseCronSchedules(JSON.parse(configSource));
  } catch (error) {
    if (error instanceof SelfHostCronError) throw error;
    fail("CRON_SCHEDULE_CONFIG_INVALID");
  }
}

export function parseTrustedCronBaseUrl(baseUrl) {
  if (
    typeof baseUrl !== "string" ||
    !baseUrl ||
    baseUrl.trim() !== baseUrl ||
    baseUrl.length > 2_048 ||
    /[\\\\%?#\s]/.test(baseUrl)
  ) {
    fail("CRON_BASE_URL_UNTRUSTED");
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    fail("CRON_BASE_URL_UNTRUSTED");
  }

  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    (parsed.protocol === "http:" && !isLocalHttpHostname(parsed.hostname))
  ) {
    fail("CRON_BASE_URL_UNTRUSTED");
  }

  return parsed;
}

function isLocalHttpHostname(hostname) {
  if (HTTP_LOCAL_HOSTS.has(hostname)) return true;

  const octets = hostname.split(".");
  return (
    octets.length === 4 &&
    octets.every((octet) => /^\d+$/.test(octet) && Number(octet) <= 255) &&
    Number(octets[0]) === 127
  );
}

export function formatCronScheduleList(entries) {
  return entries.map((entry) => `${entry.path}\t${entry.schedule} UTC`);
}

function getKnownCronEntry(entries, path) {
  if (typeof path !== "string") fail("CRON_PATH_UNKNOWN");

  const entry = entries.find((candidate) => candidate.path === path);
  if (!entry) fail("CRON_PATH_UNKNOWN");

  return entry;
}

function requireCronSecret(secret) {
  if (
    typeof secret !== "string" ||
    !secret.trim() ||
    secret.includes("\r") ||
    secret.includes("\n")
  ) {
    fail("CRON_SECRET_MISSING");
  }

  return secret;
}

export async function invokeSelfHostCron({
  entries,
  path,
  baseUrl,
  secret,
  fetchImpl = globalThis.fetch,
  timeoutMs = SELF_HOST_CRON_TIMEOUT_MS,
}) {
  const entry = getKnownCronEntry(entries, path);

  if (typeof baseUrl !== "string" || !baseUrl) fail("CRON_BASE_URL_MISSING");
  const trustedBaseUrl = parseTrustedCronBaseUrl(baseUrl);
  const cronSecret = requireCronSecret(secret);

  if (
    typeof fetchImpl !== "function" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > SELF_HOST_CRON_TIMEOUT_MS
  ) {
    fail("CRON_INVOCATION_UNAVAILABLE");
  }

  const endpoint = new URL(entry.path, trustedBaseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { authorization: `Bearer ${cronSecret}` },
      redirect: "error",
      signal: controller.signal,
    });

    if (!response || response.ok !== true) {
      fail("CRON_RESPONSE_REJECTED");
    }

    return Object.freeze({ path: entry.path, schedule: entry.schedule });
  } catch (error) {
    if (error instanceof SelfHostCronError) throw error;
    if (controller.signal.aborted) fail("CRON_INVOCATION_TIMEOUT");
    fail("CRON_INVOCATION_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export function getSafeCronErrorCode(error) {
  return error instanceof SelfHostCronError ? error.code : "CRON_INVOCATION_FAILED";
}
