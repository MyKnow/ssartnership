import {
  DEFAULT_STUDENT_CARD_THEME,
  findCohortCardTheme,
  getReadableTextColor,
  getReadableTextColorForGradient,
  hexToRgba,
  type CohortCardTheme,
} from "@/lib/cohort-card-themes";
import { getSsafyMemberLifecycle } from "@/lib/ssafy-year";

export type CertificationScheme = {
  roleBadgeClassName: string;
  yearChipClassName: string;
  campusBadgeClassName: string;
  cardClassName: string;
  frameRingClassName: string;
  glowClassName: string;
  panelClassName: string;
  accentClassName: string;
  avatarFrameClassName: string;
  subduedTextClassName: string;
  mutedTextClassName: string;
  textClassName: string;
  qrButtonClassName: string;
  style?: Record<string, string>;
};

const THEMED_STUDENT_SCHEME_CLASSNAMES = {
  roleBadgeClassName:
    "!border-transparent !bg-[var(--cert-accent)] !text-[color:var(--cert-badge-text)] shadow-[0_0_0_1px_var(--cert-accent-ring)]",
  yearChipClassName:
    "border-[color:var(--cert-chip-border)] bg-[var(--cert-chip-bg)] text-[color:var(--cert-chip-text)] ring-1 ring-[color:var(--cert-chip-border)]",
  campusBadgeClassName:
    "border-[color:var(--cert-chip-border)] bg-[var(--cert-chip-bg)] text-[color:var(--cert-chip-text)] ring-1 ring-[color:var(--cert-chip-border)]",
  cardClassName:
    "border-[color:var(--cert-border)] bg-[linear-gradient(135deg,var(--cert-bg-from)_0%,var(--cert-bg-via)_44%,var(--cert-bg-to)_100%)] shadow-[0_3.75cqw_12cqw_var(--cert-shadow)]",
  frameRingClassName: "ring-[color:var(--cert-ring)]",
  glowClassName:
    "bg-[radial-gradient(circle,var(--cert-glow-strong)_0%,var(--cert-glow-soft)_22%,transparent_58%)]",
  panelClassName:
    "border-[color:var(--cert-panel-border)] bg-[var(--cert-panel-bg)]",
  accentClassName: "bg-[var(--cert-accent)]",
  avatarFrameClassName:
    "border-[color:var(--cert-avatar-border)] ring-[color:var(--cert-avatar-ring)]",
  subduedTextClassName: "text-[color:var(--cert-subdued)]",
  mutedTextClassName: "text-[color:var(--cert-muted)]",
  textClassName: "text-[color:var(--cert-text)]",
  qrButtonClassName:
    "!border-[color:var(--cert-qr-border)] !bg-[var(--cert-qr-bg)] !text-[color:var(--cert-qr-text)] hover:!border-[color:var(--cert-qr-border-hover)] hover:!bg-[var(--cert-qr-bg-hover)]",
} satisfies Omit<CertificationScheme, "style">;

const STAFF_SCHEME: CertificationScheme = {
  roleBadgeClassName:
    "!border-white/25 !bg-white/90 !text-slate-950 ring-1 ring-white/35",
  yearChipClassName:
    "bg-white/10 text-white/85 ring-1 ring-white/10 dark:bg-white/10 dark:text-white/90",
  campusBadgeClassName:
    "bg-white/10 text-white/90 ring-1 ring-white/10",
  cardClassName:
    "border-white/18 bg-[linear-gradient(135deg,#0b1220_0%,#111827_46%,#1f2937_100%)] shadow-[0_3.75cqw_12cqw_rgba(15,23,42,0.35)]",
  frameRingClassName: "ring-white/8",
  glowClassName:
    "bg-[radial-gradient(circle,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.1)_20%,transparent_56%)]",
  panelClassName: "border-white/14 bg-white/5",
  accentClassName: "bg-white",
  avatarFrameClassName: "border-white/16 ring-white/10",
  subduedTextClassName: "text-white/80",
  mutedTextClassName: "text-white/60",
  textClassName: "text-white",
  qrButtonClassName:
    "!border-white/15 !bg-white/10 !text-white hover:!border-white/25 hover:!bg-white/15",
};

const GRADUATE_SCHEME: CertificationScheme = {
  roleBadgeClassName:
    "!border-slate-900/10 !bg-slate-900 !text-white shadow-[0_0_0_1px_rgba(15,23,42,0.16)] dark:!border-white/20 dark:!bg-white/90 dark:!text-slate-950",
  yearChipClassName:
    "bg-white/85 text-slate-800 ring-1 ring-slate-400/45 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-500/55",
  campusBadgeClassName:
    "bg-white/85 text-slate-800 ring-1 ring-slate-400/40 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-500/50",
  cardClassName:
    "border-slate-300/55 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_46%,#e2e8f0_100%)] shadow-[0_3.75cqw_12cqw_rgba(100,116,139,0.18)] dark:border-slate-500/45 dark:bg-[linear-gradient(135deg,#0f172a_0%,#111827_46%,#1f2937_100%)] dark:shadow-[0_3.75cqw_12cqw_rgba(15,23,42,0.35)]",
  frameRingClassName: "ring-slate-300/30 dark:ring-slate-500/16",
  glowClassName:
    "bg-[radial-gradient(circle,rgba(148,163,184,0.2)_0%,rgba(148,163,184,0.08)_22%,transparent_58%)]",
  panelClassName: "border-slate-300/45 bg-white/82 dark:border-slate-500/18 dark:bg-white/5",
  accentClassName: "bg-slate-600 dark:bg-slate-300",
  avatarFrameClassName: "border-slate-300/45 ring-slate-300/25 dark:border-slate-500/18 dark:ring-slate-500/14",
  subduedTextClassName: "text-slate-700 dark:text-slate-100/80",
  mutedTextClassName: "text-slate-600 dark:text-slate-100/60",
  textClassName: "text-slate-950 dark:text-white",
  qrButtonClassName:
    "!border-slate-300/70 !bg-white/90 !text-slate-800 hover:!border-slate-400/80 hover:!bg-white dark:!border-white/15 dark:!bg-white/10 dark:!text-white dark:hover:!border-white/25 dark:hover:!bg-white/15",
};

function buildStudentThemeStyle(theme: CohortCardTheme) {
  const textColor = getReadableTextColorForGradient([
    theme.backgroundFrom,
    theme.backgroundVia,
    theme.backgroundTo,
  ]);
  const isDarkText = textColor !== "#ffffff";
  const accentText = getReadableTextColor(theme.accentColor);

  return {
    "--cert-bg-from": theme.backgroundFrom,
    "--cert-bg-via": theme.backgroundVia,
    "--cert-bg-to": theme.backgroundTo,
    "--cert-accent": theme.accentColor,
    "--cert-text": textColor,
    "--cert-badge-text": accentText,
    "--cert-subdued": isDarkText ? "rgba(15, 23, 42, 0.78)" : "rgba(255, 255, 255, 0.82)",
    "--cert-muted": isDarkText ? "rgba(51, 65, 85, 0.72)" : "rgba(255, 255, 255, 0.64)",
    "--cert-chip-text": isDarkText ? "#0f172a" : "rgba(255, 255, 255, 0.92)",
    "--cert-chip-bg": isDarkText ? "rgba(255, 255, 255, 0.74)" : "rgba(255, 255, 255, 0.12)",
    "--cert-chip-border": isDarkText ? "rgba(100, 116, 139, 0.34)" : "rgba(255, 255, 255, 0.22)",
    "--cert-panel-bg": isDarkText ? "rgba(255, 255, 255, 0.82)" : "rgba(255, 255, 255, 0.08)",
    "--cert-panel-border": isDarkText ? "rgba(100, 116, 139, 0.28)" : "rgba(255, 255, 255, 0.16)",
    "--cert-border": hexToRgba(theme.accentColor, 0.34),
    "--cert-ring": hexToRgba(theme.accentColor, 0.18),
    "--cert-shadow": hexToRgba(theme.accentColor, 0.22),
    "--cert-accent-ring": hexToRgba(theme.accentColor, 0.2),
    "--cert-glow-strong": hexToRgba(theme.accentColor, 0.28),
    "--cert-glow-soft": hexToRgba(theme.accentColor, 0.12),
    "--cert-avatar-border": hexToRgba(theme.accentColor, 0.24),
    "--cert-avatar-ring": hexToRgba(theme.accentColor, 0.16),
    "--cert-qr-text": isDarkText ? "#0f172a" : "#ffffff",
    "--cert-qr-bg": isDarkText ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.1)",
    "--cert-qr-bg-hover": isDarkText ? "rgba(255, 255, 255, 0.94)" : "rgba(255, 255, 255, 0.15)",
    "--cert-qr-border": isDarkText ? "rgba(100, 116, 139, 0.35)" : "rgba(255, 255, 255, 0.15)",
    "--cert-qr-border-hover": isDarkText ? "rgba(100, 116, 139, 0.5)" : "rgba(255, 255, 255, 0.25)",
  };
}

export function buildStudentCertificationScheme(
  theme: CohortCardTheme = DEFAULT_STUDENT_CARD_THEME,
): CertificationScheme {
  return {
    ...THEMED_STUDENT_SCHEME_CLASSNAMES,
    style: buildStudentThemeStyle(theme),
  };
}

export function getCertificationRoleLabel(
  year: number | null | undefined,
  options: { graduateVerifiedAt?: string | null } = {},
) {
  if (options.graduateVerifiedAt) {
    return "수료생";
  }
  if (typeof year !== "number") {
    return "교육생";
  }
  const lifecycle = getSsafyMemberLifecycle(year);
  if (lifecycle.kind === "staff") {
    return "운영진";
  }
  if (lifecycle.kind === "graduate") {
    return "수료생";
  }
  return "교육생";
}

export function getCertificationScheme(
  year: number | null | undefined,
  cohortThemes?: readonly CohortCardTheme[] | null,
  options: { graduateVerifiedAt?: string | null } = {},
) {
  if (year === 0) {
    return STAFF_SCHEME;
  }

  if (
    options.graduateVerifiedAt ||
    (typeof year === "number" && getSsafyMemberLifecycle(year).kind === "graduate")
  ) {
    return GRADUATE_SCHEME;
  }

  if (typeof year === "number") {
    return buildStudentCertificationScheme(
      findCohortCardTheme(cohortThemes, year) ?? {
        ...DEFAULT_STUDENT_CARD_THEME,
        cohortYear: year,
        displayName: `${year}기`,
      },
    );
  }

  return buildStudentCertificationScheme(DEFAULT_STUDENT_CARD_THEME);
}
