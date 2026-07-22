import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getContrastRatio,
  getReadableTextColorForGradient,
  listCohortCardThemes,
  parseCohortCardThemeDeletePayload,
  parseCohortCardThemePayload,
  type CohortCardTheme,
} from "../src/lib/cohort-card-themes.ts";
import {
  getCertificationRoleLabel,
  getCertificationScheme,
} from "../src/lib/certification-scheme.ts";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

const year16Theme: CohortCardTheme = {
  cohortYear: 16,
  displayName: "16기",
  backgroundFrom: "#062a3a",
  backgroundVia: "#0f3b66",
  backgroundTo: "#111827",
  accentColor: "#38bdf8",
  createdAt: null,
  updatedAt: null,
};

test("mock cohort card themes mirror the database seeds", async () => {
  const previousDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

  try {
    const themes = await listCohortCardThemes();

    assert.deepEqual(
      themes.map(({ cohortYear, backgroundFrom, backgroundVia, backgroundTo, accentColor }) => ({
        cohortYear,
        backgroundFrom,
        backgroundVia,
        backgroundTo,
        accentColor,
      })),
      [
        {
          cohortYear: 14,
          backgroundFrom: "#07120d",
          backgroundVia: "#0a1a15",
          backgroundTo: "#111827",
          accentColor: "#34d399",
        },
        {
          cohortYear: 15,
          backgroundFrom: "#110c1f",
          backgroundVia: "#1a1430",
          backgroundTo: "#111827",
          accentColor: "#a78bfa",
        },
        {
          cohortYear: 16,
          backgroundFrom: "#062a3a",
          backgroundVia: "#0f3b66",
          backgroundTo: "#111827",
          accentColor: "#38bdf8",
        },
      ],
    );
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = previousDataSource;
    }
  }
});

test("cohort card theme payload normalizes and validates admin color input", () => {
  const payload = parseCohortCardThemePayload(
    buildFormData({
      cohortYear: "16",
      displayName: " 16기 신규 ",
      backgroundFrom: " #062A3A ",
      backgroundVia: "#0F3B66",
      backgroundTo: "#111827",
      accentColor: "#38BDF8",
    }),
  );

  assert.deepEqual(payload, {
    cohortYear: 16,
    displayName: "16기 신규",
    backgroundFrom: "#062a3a",
    backgroundVia: "#0f3b66",
    backgroundTo: "#111827",
    accentColor: "#38bdf8",
  });
});

test("cohort card theme payload rejects unsafe colors and invalid years", () => {
  assert.throws(
    () =>
      parseCohortCardThemePayload(
        buildFormData({
          cohortYear: "16",
          backgroundFrom: "red",
          backgroundVia: "#0f3b66",
          backgroundTo: "#111827",
          accentColor: "#38bdf8",
        }),
      ),
    /cohort_theme_invalid_color/,
  );

  assert.throws(
    () => parseCohortCardThemeDeletePayload(buildFormData({ cohortYear: "0" })),
    /cohort_theme_invalid_year/,
  );

  assert.throws(
    () => parseCohortCardThemeDeletePayload(buildFormData({ cohortYear: "16abc" })),
    /cohort_theme_invalid_year/,
  );
});

test("student certification scheme uses db theme variables instead of per-cohort classes", () => {
  const scheme = getCertificationScheme(16, [year16Theme]);

  assert.equal(scheme.style?.["--cert-bg-from"], "#062a3a");
  assert.equal(scheme.style?.["--cert-accent"], "#38bdf8");
  assert.equal(scheme.style?.["--cert-qr-text"], "#ffffff");
  assert.match(scheme.cardClassName, /var\(--cert-bg-from\)/);
  assert.match(scheme.roleBadgeClassName, /!bg-\[var\(--cert-accent\)\]/);
  assert.match(scheme.qrButtonClassName, /var\(--cert-qr-text\)/);
  assert.ok(getContrastRatio("#062a3a", scheme.style?.["--cert-text"] ?? "#000000") >= 4.5);
});

test("graduate certification scheme keeps readable dark text on the light card", () => {
  const scheme = getCertificationScheme(14, [year16Theme]);

  assert.match(scheme.textClassName, /text-slate-950/);
  assert.match(scheme.roleBadgeClassName, /!bg-slate-900/);
  assert.match(scheme.roleBadgeClassName, /!text-white/);
  assert.match(scheme.subduedTextClassName, /text-slate-700/);
  assert.match(scheme.qrButtonClassName, /!text-slate-800/);
});

test("승인된 수료생은 현재 기수와 무관하게 수료생 카드 역할을 우선한다", () => {
  const scheme = getCertificationScheme(16, [year16Theme], {
    graduateVerifiedAt: "2026-07-12T00:00:00.000Z",
  });

  assert.equal(
    getCertificationRoleLabel(16, {
      graduateVerifiedAt: "2026-07-12T00:00:00.000Z",
    }),
    "수료생",
  );
  assert.match(scheme.roleBadgeClassName, /!bg-slate-900/);
});

test("staff certification scheme keeps the role chip readable on the dark card", () => {
  const scheme = getCertificationScheme(0, [year16Theme]);

  assert.match(scheme.roleBadgeClassName, /!bg-white\/90/);
  assert.match(scheme.roleBadgeClassName, /!text-slate-950/);
});

test("gradient text helper chooses the more readable foreground", () => {
  assert.equal(
    getReadableTextColorForGradient(["#f8fafc", "#eef2ff", "#e2e8f0"]),
    "#0f172a",
  );
  assert.equal(
    getReadableTextColorForGradient(["#062a3a", "#0f3b66", "#111827"]),
    "#ffffff",
  );
});
