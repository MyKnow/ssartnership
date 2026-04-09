export type CertificationScheme = {
  roleBadgeClassName: string;
  yearChipClassName: string;
  cardClassName: string;
  glowClassName: string;
  panelClassName: string;
  accentClassName: string;
  subduedTextClassName: string;
  mutedTextClassName: string;
};

const STUDENT_14_SCHEME: CertificationScheme = {
  roleBadgeClassName:
    "bg-emerald-400 text-slate-950 shadow-[0_0_0_1px_rgba(167,243,208,0.2)]",
  yearChipClassName:
    "bg-emerald-400/15 text-emerald-50 ring-1 ring-emerald-300/25",
  cardClassName:
    "border-emerald-400/25 bg-[linear-gradient(135deg,#07120d_0%,#0a1a15_42%,#111827_100%)] shadow-[0_28px_90px_rgba(16,185,129,0.22)]",
  glowClassName:
    "bg-[radial-gradient(circle,rgba(74,222,128,0.28)_0%,rgba(74,222,128,0.12)_22%,transparent_58%)]",
  panelClassName: "border-white/10 bg-white/5",
  accentClassName: "bg-emerald-400",
  subduedTextClassName: "text-emerald-50/80",
  mutedTextClassName: "text-emerald-100/60",
};

const STUDENT_15_SCHEME: CertificationScheme = {
  roleBadgeClassName:
    "bg-violet-400 text-slate-950 shadow-[0_0_0_1px_rgba(221,214,254,0.2)]",
  yearChipClassName:
    "bg-violet-400/15 text-violet-50 ring-1 ring-violet-300/25",
  cardClassName:
    "border-violet-400/25 bg-[linear-gradient(135deg,#110c1f_0%,#1a1430_42%,#111827_100%)] shadow-[0_28px_90px_rgba(139,92,246,0.22)]",
  glowClassName:
    "bg-[radial-gradient(circle,rgba(196,181,253,0.28)_0%,rgba(196,181,253,0.12)_22%,transparent_58%)]",
  panelClassName: "border-white/10 bg-white/5",
  accentClassName: "bg-violet-400",
  subduedTextClassName: "text-violet-50/80",
  mutedTextClassName: "text-violet-100/60",
};

const STAFF_SCHEME: CertificationScheme = {
  roleBadgeClassName:
    "bg-black text-white ring-1 ring-white/10",
  yearChipClassName:
    "bg-white/10 text-white/85 ring-1 ring-white/10 dark:bg-white/10 dark:text-white/90",
  cardClassName:
    "border-white/15 bg-[linear-gradient(135deg,#0b1220_0%,#111827_46%,#1f2937_100%)] shadow-[0_28px_90px_rgba(15,23,42,0.35)]",
  glowClassName:
    "bg-[radial-gradient(circle,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.1)_20%,transparent_56%)]",
  panelClassName: "border-white/10 bg-white/5",
  accentClassName: "bg-white",
  subduedTextClassName: "text-white/80",
  mutedTextClassName: "text-white/60",
};

export function getCertificationRoleLabel(year: number | null | undefined) {
  return year === 0 ? "운영진" : "교육생";
}

export function getCertificationScheme(year: number | null | undefined) {
  if (year === 0) {
    return STAFF_SCHEME;
  }

  if (year === 14) {
    return STUDENT_14_SCHEME;
  }

  return STUDENT_15_SCHEME;
}
