import type { RoleKind } from "@/lib/mm-profile/types";

export const STAFF_YEAR_HINT = 0;

export const CAMPUS_NAMES = ["서울", "광주", "구미", "부울경", "대전", "창업"] as const;

export const ROLE_PRIORITY: Array<{
  token: string;
  kind: RoleKind;
  normalized?: string;
}> = [
  { token: "팀원", kind: "student", normalized: "팀원" },
  { token: "팀장", kind: "student", normalized: "팀장" },
  { token: "대표강사", kind: "staff", normalized: "강사" },
  { token: "전임강사", kind: "staff", normalized: "강사" },
  { token: "교육프로", kind: "staff", normalized: "프로" },
  { token: "운영프로", kind: "staff", normalized: "프로" },
  { token: "취업컨설턴트", kind: "staff", normalized: "컨설턴트" },
  { token: "실습코치", kind: "staff", normalized: "실습코치" },
  { token: "트랙대표", kind: "staff", normalized: "트랙대표" },
  { token: "취업지원센터", kind: "staff", normalized: "취업지원센터" },
  { token: "운영자", kind: "staff", normalized: "운영자" },
  { token: "조교", kind: "staff", normalized: "조교" },
  { token: "연구팀", kind: "staff", normalized: "연구팀" },
  { token: "사무국", kind: "staff", normalized: "사무국" },
  { token: "Consultant", kind: "staff", normalized: "컨설턴트" },
  { token: "컨설턴트", kind: "staff", normalized: "컨설턴트" },
  { token: "강사", kind: "staff", normalized: "강사" },
  { token: "프로", kind: "staff", normalized: "프로" },
];

export const STUDENT_ROLE_TOKENS = ROLE_PRIORITY.filter(
  (item) => item.kind === "student",
).map((item) => item.token);

export const HUMAN_NAME_REGEX = /^[가-힣]{2,4}$/u;
export const DECORATIVE_EDGE_REGEX =
  /^[^\w가-힣\[\]\(\)]+|[^\w가-힣\[\]\(\)]+$/gu;
export const AFFILIATION_SEGMENT_REGEX = /[\[(]([^\[\]]+)[\])]/gu;
export const TRAILING_NUMERIC_ALIAS_REGEX = /\d+$/u;
