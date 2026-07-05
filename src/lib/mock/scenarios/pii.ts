import type { MockScenario, MockScenarioPiiLeak } from "./types.ts";

const emailPattern = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

function collectLeaksFromValue({
  scenarioId,
  path,
  value,
}: {
  scenarioId: string;
  path: string;
  value: unknown;
}): MockScenarioPiiLeak[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectLeaksFromValue({
        scenarioId,
        path: `${path}[${index}]`,
        value: item,
      }),
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      collectLeaksFromValue({
        scenarioId,
        path: path ? `${path}.${key}` : key,
        value: nestedValue,
      }),
    );
  }

  if (typeof value !== "string") {
    return [];
  }

  const leaks: MockScenarioPiiLeak[] = [];
  for (const match of value.matchAll(emailPattern)) {
    const domain = match[1]?.toLowerCase() ?? "";
    if (!domain.endsWith(".example")) {
      leaks.push({
        scenarioId,
        path,
        value: match[0],
        reason: "Mock scenario email must use the reserved .example domain.",
      });
    }
  }

  return leaks;
}

export function findMockScenarioPiiLeaks(
  scenarios: readonly MockScenario[],
): MockScenarioPiiLeak[] {
  return scenarios.flatMap((scenario) =>
    collectLeaksFromValue({
      scenarioId: scenario.id,
      path: "scenario",
      value: scenario,
    }),
  );
}
