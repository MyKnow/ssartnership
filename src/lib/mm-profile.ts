type ParsedProfile = {
  displayName?: string;
  region?: string;
  campus?: string;
  classNumber?: number;
};

const REGION_MAP: Record<string, string> = {
  서울: "서울",
  광주: "광주",
  구미: "구미",
  부울경: "부울경",
  대전: "대전",
};

export function parseSsafyProfile(displayName?: string): ParsedProfile {
  if (!displayName) {
    return {};
  }
  const cleanedDisplayName =
    displayName.replace(/\[[^\]]+\]/g, "").trim() || displayName;
  const match = displayName.match(/\[([가-힣]+)_?(\d{1,2})반\]/);
  if (!match) {
    return { displayName: cleanedDisplayName };
  }
  const regionRaw = match[1];
  const classNumber = Number(match[2]);
  const region = REGION_MAP[regionRaw] ?? regionRaw;
  const campus = region === "서울" ? "서울" : region;
  return {
    displayName: cleanedDisplayName,
    region,
    campus,
    classNumber: Number.isNaN(classNumber) ? undefined : classNumber,
  };
}
