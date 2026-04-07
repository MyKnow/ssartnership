type ParsedProfile = {
  displayName?: string;
  campus?: string;
  classNumber?: number;
  isStaff?: boolean;
  suggestedYear?: number;
};

const STAFF_YEAR_HINT = 0;

const REGION_MAP: Record<string, string> = {
  서울: "서울",
  광주: "광주",
  구미: "구미",
  부울경: "부울경",
  대전: "대전",
  창업: "창업",
};

const TRAILING_ROLE_REGEX =
  /(대표강사|전임강사|취업컨설턴트|교육프로|운영프로|실습코치|트랙대표|컨설턴트|강사|프로|팀장|팀원)+$/u;
const STAFF_SIGNAL_REGEX =
  /(대표강사|전임강사|강사|교육프로|운영프로|실습코치|취업컨설턴트|컨설턴트|트랙대표|연구팀|사무국|운영자|취업지원센터|프로|Consultant)/u;
const STUDENT_SIGNAL_REGEX = /(팀장|팀원)/u;
const HUMAN_NAME_REGEX = /^[가-힣]{2,5}$/u;

function sanitizeDisplayName(rawDisplayName: string) {
  const withoutMetadata =
    rawDisplayName.replace(/\s*(?:\[[^\]]+\]|\([^)]+\)).*$/, "").trim() ||
    rawDisplayName;
  const withoutRole = withoutMetadata
    .replace(TRAILING_ROLE_REGEX, "")
    .replace(/[_\s-]+$/u, "")
    .trim();
  return withoutRole || withoutMetadata;
}

function extractHumanNameCandidate(value: string) {
  const exactMatch = value.match(/^([가-힣]{2,5})$/u);
  if (exactMatch) {
    return exactMatch[1];
  }

  const leadingMatch = value.match(/^([가-힣]{2,5})(?:[^가-힣]|$)/u);
  return leadingMatch?.[1];
}

function isLikelyStaffProfile(rawDisplayName: string, cleanedDisplayName: string) {
  if (STUDENT_SIGNAL_REGEX.test(rawDisplayName)) {
    return false;
  }

  if (!STAFF_SIGNAL_REGEX.test(rawDisplayName)) {
    return false;
  }

  const nameCandidate = extractHumanNameCandidate(cleanedDisplayName);
  return Boolean(nameCandidate && HUMAN_NAME_REGEX.test(nameCandidate));
}

export function parseSsafyProfile(displayName?: string): ParsedProfile {
  if (!displayName) {
    return {};
  }
  // 14기/15기 닉네임 주요 형식
  // - 이름[지역_반]
  // - 이름[지역_반_팀코드]직책
  // - 이름[지역_반(S1)_팀코드]직책
  // - 이름[서울10반]
  // - 이름(서울_17반)
  const cleanedDisplayName = sanitizeDisplayName(displayName);
  const isStaff = isLikelyStaffProfile(displayName, cleanedDisplayName);
  const normalizedDisplayName =
    (isStaff ? extractHumanNameCandidate(cleanedDisplayName) : undefined) ??
    cleanedDisplayName;
  const bracketClassMatch = displayName.match(
    /(?:\[|\()(?:\d{1,2}기)?([가-힣]+)_?(\d{1,2})반(?:\([^)]*\))?(?:_[^\],\/\)]*)?(?:\]|\))/u,
  );
  const bareClassMatch =
    /[\[\(]/u.test(displayName)
      ? null
      : displayName.match(
          /(?:^|[^가-힣/,])((?:서울|광주|구미|부울경|대전|창업))_?(\d{1,2})반(?![\/,])/u,
        );
  const match = bracketClassMatch ?? bareClassMatch;
  const campusOnlyMatch = displayName.match(
    /(?:\[|\()((?:서울|광주|구미|부울경|대전|창업))(?:\]|\))/u,
  );

  if (!match) {
    return {
      displayName: normalizedDisplayName,
      ...(campusOnlyMatch
        ? {
            campus: REGION_MAP[campusOnlyMatch[1]],
          }
        : {}),
      ...(isStaff
        ? {
            isStaff: true,
            suggestedYear: STAFF_YEAR_HINT,
          }
        : {}),
    };
  }
  const regionRaw = match[1];
  const classNumber = Number(match[2]);
  const campus = REGION_MAP[regionRaw] ?? regionRaw;
  return {
    displayName: normalizedDisplayName,
    campus,
    classNumber: Number.isNaN(classNumber) ? undefined : classNumber,
    ...(isStaff
      ? {
          isStaff: true,
          suggestedYear: STAFF_YEAR_HINT,
        }
      : {}),
  };
}
