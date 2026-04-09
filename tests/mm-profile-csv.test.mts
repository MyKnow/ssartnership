import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { delimiter } from "node:path";
import test from "node:test";

const DEFAULT_CSV_PATHS = [
  "/Users/myknow/Library/Mobile Documents/com~apple~CloudDocs/SSAFY/지역대표/MM/member_list/14기/14기_공지_전용/2._소통/all/20260407_094807.csv",
  "/Users/myknow/Library/Mobile Documents/com~apple~CloudDocs/SSAFY/지역대표/MM/member_list/15기/15기_공지_전용/2._소통/filtered/20260407_094736.csv",
] as const;

const csvPaths = (
  process.env.MM_PROFILE_TEST_CSVS
    ? process.env.MM_PROFILE_TEST_CSVS.split(delimiter)
    : [...DEFAULT_CSV_PATHS]
).map((value) => value.trim()).filter(Boolean);

const availableCsvPaths = csvPaths.filter((filePath) => existsSync(filePath));
const skipReason =
  availableCsvPaths.length === 0
    ? `CSV fixture not found. Set MM_PROFILE_TEST_CSVS or place the files at: ${csvPaths.join(", ")}`
    : false;

const CAMPUS_NAMES = ["서울", "광주", "구미", "부울경", "대전", "창업"] as const;

const profileModulePromise = import(
  new URL("../src/lib/mm-profile.ts", import.meta.url).href
);

async function parseProfile(value: string) {
  const { parseSsafyProfile } = await profileModulePromise;
  return parseSsafyProfile(value);
}

async function parseProfileFromUser(
  user: Partial<Record<"nickname" | "first_name" | "last_name" | "username", string>>,
) {
  const { parseSsafyProfileFromUser } = await profileModulePromise;
  return parseSsafyProfileFromUser(user);
}

function assertProfileFields(
  actual: unknown,
  expected: Record<string, unknown>,
) {
  const profile = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual(profile[key], value, key);
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headerRow = [], ...bodyRows] = rows;
  return bodyRows
    .filter((cells) => cells.some((value) => value.trim().length > 0))
    .map((cells) =>
      Object.fromEntries(
        headerRow.map((header, index) => [header, cells[index] ?? ""]),
      ) as Record<string, string>,
    );
}

function getMatchedNames(paths: string[]) {
  return paths.flatMap((filePath) => {
    const content = readFileSync(filePath, "utf8").replace(/^\uFEFF/u, "");
    return parseCsv(content)
      .map((row) => row.matched_name_raw?.trim() ?? "")
      .filter(Boolean);
  });
}

const matchedNames = availableCsvPaths.length > 0
  ? getMatchedNames(availableCsvPaths)
  : [];

const exactExamples = [
  {
    raw: "강하준[서울(S1)_S109]팀원",
    expected: {
      displayName: "강하준",
      campus: "서울",
    },
  },
  {
    raw: "윤서하[창업_F201]팀원",
    expected: {
      displayName: "윤서하",
      campus: "창업",
    },
  },
  {
    raw: "한도윤강사(서울)",
    expected: {
      displayName: "한도윤",
      campus: "서울",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "서지안(서울)",
    expected: {
      displayName: "서지안",
      campus: "서울",
    },
  },
  {
    raw: "박시온강사[서울]",
    expected: {
      displayName: "박시온",
      campus: "서울",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "이도현[부울경_E102]팀원",
    expected: {
      displayName: "이도현",
      campus: "부울경",
    },
  },
  {
    raw: "최하린[구미_S209]팀원",
    expected: {
      displayName: "최하린",
      campus: "구미",
    },
  },
  {
    raw: "김서율[서울]",
    expected: {
      displayName: "김서율",
      campus: "서울",
    },
  },
  {
    raw: "정유찬[구미(S2)_S204]팀원",
    expected: {
      displayName: "정유찬",
      campus: "구미",
    },
  },
  {
    raw: "오가온[서울_AI]실습코치",
    expected: {
      displayName: "오가온",
      campus: "서울",
      isStaff: true,
      suggestedYear: 0,
    },
  },
] as const;

const candidatePriorityExamples = [
  {
    user: {
      nickname: "장나현(교육프로)",
      first_name: "하준",
      last_name: "김",
      username: "jang-na-hyun",
    },
    expectedDisplayName: "장나현",
  },
  {
    user: {
      first_name: "민수",
      last_name: "김",
      username: "kim-minsu",
    },
    expectedDisplayName: "김민수",
  },
  {
    user: {
      username: "서지안",
    },
    expectedDisplayName: "서지안",
  },
] as const;

const staffExamples = [
  {
    raw: "윤도하강사(서울)",
    expected: {
      displayName: "윤도하",
      campus: "서울",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "서주원(교육프로)",
    expected: {
      displayName: "서주원",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "박시윤프로[취업지원센터]",
    expected: {
      displayName: "박시윤",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "정하린트랙대표(파이썬)",
    expected: {
      displayName: "정하린",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "김도윤[서울]교육프로",
    expected: {
      displayName: "김도윤",
      campus: "서울",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "최서윤_14기전자연계_교육프로",
    expected: {
      displayName: "최서윤",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "AI조교1",
    expected: {
      displayName: "AI조교1",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "SuperApp운영자2",
    expected: {
      displayName: "SuperApp운영자2",
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "SSAFY사무국",
    expected: {
      displayName: "SSAFY사무국",
      isStaff: true,
      suggestedYear: 0,
    },
  },
] as const;

const exclusionExamples = [
  {
    raw: "박준호팀원",
    expectedReason: "student_signal_without_affiliation",
  },
  {
    raw: "김민수[ABC]팀원",
    expectedReason: "student_signal_without_affiliation",
  },
  {
    raw: "최도윤[서울/대전]팀원",
    expectedReason: "campus_ambiguous",
  },
  {
    raw: "박성래",
    expectedReason: "display_only",
  },
] as const;

const nonHumanOrUncertainStaffExamples = [
  "playbooks",
  "[시스템운영]",
  "황준식",
] as const;

test(
  "CSV fixtures are available",
  { skip: skipReason },
  () => {
    assert.ok(availableCsvPaths.length > 0);
  },
);

test(
  "MM user candidate priority follows nickname, last_name+first_name, first_name+last_name, and username",
  { skip: skipReason },
  async () => {
    for (const example of candidatePriorityExamples) {
      const parsed = await parseProfileFromUser(example.user);
      assert.equal(parsed.displayName, example.expectedDisplayName);
    }
  },
);

test(
  "synthetic representative examples are parsed as expected",
  { skip: skipReason },
  async () => {
    for (const example of exactExamples) {
      const parsed = await parseProfile(example.raw);
      assertProfileFields(parsed, example.expected);
      assert.equal(parsed.parseModeCandidateMatch, true, example.raw);
      assert.equal(parsed.parsedExclusionReason, undefined, example.raw);
    }
  },
);

test(
  "synthetic ambiguous campus patterns do not force a single-campus parse",
  { skip: skipReason },
  async () => {
    for (const raw of [
      "민하준프로[ABC]",
      "강수린[대전/서울]실습코치",
      "윤예찬[창업/서울]실습코치",
      "서하윤[광주,구미]교육프로",
    ] as const) {
      const parsed = await parseProfile(raw);
      assert.equal(parsed.campus, undefined, raw);
    }
  },
);

test(
  "synthetic staff patterns produce an operations-year hint",
  { skip: skipReason },
  async () => {
    for (const example of staffExamples) {
      const parsed = await parseProfile(example.raw);
      assertProfileFields(parsed, example.expected);
      assert.equal(parsed.parseModeCandidateMatch, true, example.raw);
      assert.equal(parsed.parsedExclusionReason, undefined, example.raw);
    }
  },
);

test(
  "documented exclusion reasons are surfaced",
  { skip: skipReason },
  async () => {
    for (const example of exclusionExamples) {
      const parsed = await parseProfile(example.raw);
      assert.equal(parsed.parsedExclusionReason, example.expectedReason, example.raw);
      assert.equal(parsed.parseModeCandidateMatch, false, example.raw);
    }
  },
);

test(
  "non-human or markerless names are not auto-promoted to staff",
  { skip: skipReason },
  async () => {
    for (const raw of nonHumanOrUncertainStaffExamples) {
      const parsed = await parseProfile(raw);
      assert.equal(parsed.isStaff, undefined, raw);
      assert.equal(parsed.suggestedYear, undefined, raw);
    }
  },
);

test(
  "single-campus rows from the CSV always parse to campus and cleaned display name",
  { skip: skipReason },
  async () => {
    const failures: string[] = [];

    for (const raw of matchedNames) {
      const campusMatches = CAMPUS_NAMES.filter((campus) => raw.includes(campus));
      if (campusMatches.length !== 1) {
        continue;
      }

      const parsed = await parseProfile(raw);
      const expectedCampus = campusMatches[0];

      if (parsed.campus !== expectedCampus) {
        failures.push(`${raw} -> campus ${parsed.campus ?? "-"} !== ${expectedCampus}`);
      }
      if (!parsed.displayName || /[\[\]()]/u.test(parsed.displayName)) {
        failures.push(`${raw} -> invalid displayName ${parsed.displayName ?? "-"}`);
      }
    }

    assert.equal(
      failures.length,
      0,
      `mm-profile CSV parse failures (${failures.length})\n${failures
        .slice(0, 30)
        .join("\n")}`,
    );
  },
);
