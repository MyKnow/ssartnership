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

const SINGLE_CLASS_PROFILE_REGEX =
  /(?:\[|\()(서울|광주|구미|부울경|대전|창업)_?(\d{1,2})반(?:\([^)]*\))?(?:_[^,\/\]\)]*)?(?:\]|\))/u;

const profileModulePromise = import(
  new URL("../src/lib/mm-profile.ts", import.meta.url).href
);

async function parseProfile(value: string) {
  const { parseSsafyProfile } = await profileModulePromise;
  return parseSsafyProfile(value);
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
    raw: "강하준[서울_5반(S1)_S109]팀원",
    expected: {
      displayName: "강하준",
      campus: "서울",
      classNumber: 5,
    },
  },
  {
    raw: "윤서하[창업_2반_F201]팀원",
    expected: {
      displayName: "윤서하",
      campus: "창업",
      classNumber: 2,
    },
  },
  {
    raw: "한도윤강사(서울13반)",
    expected: {
      displayName: "한도윤",
      campus: "서울",
      classNumber: 13,
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "서지안(서울_17반)",
    expected: {
      displayName: "서지안",
      campus: "서울",
      classNumber: 17,
    },
  },
  {
    raw: "박시온강사[서울_2반]",
    expected: {
      displayName: "박시온",
      campus: "서울",
      classNumber: 2,
      isStaff: true,
      suggestedYear: 0,
    },
  },
  {
    raw: "이도현[부울경_1반_E102]팀원",
    expected: {
      displayName: "이도현",
      campus: "부울경",
      classNumber: 1,
    },
  },
  {
    raw: "최하린[구미_2반_S209]팀원",
    expected: {
      displayName: "최하린",
      campus: "구미",
      classNumber: 2,
    },
  },
  {
    raw: "김서율[서울2반]",
    expected: {
      displayName: "김서율",
      campus: "서울",
      classNumber: 2,
    },
  },
  {
    raw: "정유찬[구미_2반(S2)_S204]팀원",
    expected: {
      displayName: "정유찬",
      campus: "구미",
      classNumber: 2,
    },
  },
  {
    raw: "오가온[서울_2반_AI]실습코치",
    expected: {
      displayName: "오가온",
      campus: "서울",
      classNumber: 2,
      isStaff: true,
      suggestedYear: 0,
    },
  },
] as const;

const ambiguousExamples = [
  "민하준프로[취업]",
  "강수린[대전_PJT]실습코치",
  "윤예찬[창업_1반/서울_1반]실습코치",
  "서하윤[광주3반,4반]교육프로",
] as const;

const staffExamples = [
  {
    raw: "윤도하강사(서울13반)",
    expected: {
      displayName: "윤도하",
      campus: "서울",
      classNumber: 13,
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
] as const;

const nonHumanOrUncertainStaffExamples = [
  "playbooks",
  "[시스템운영]",
  "AI조교1",
  "SuperApp운영자2",
  "SSAFY사무국",
  "박성래",
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
  "synthetic representative examples are parsed as expected",
  { skip: skipReason },
  async () => {
    for (const example of exactExamples) {
      assert.deepStrictEqual(await parseProfile(example.raw), example.expected);
    }
  },
);

test(
  "synthetic ambiguous or non-student patterns do not force a single-class parse",
  { skip: skipReason },
  async () => {
    for (const raw of ambiguousExamples) {
      const parsed = await parseProfile(raw);
      assert.equal(parsed.campus, undefined, raw);
      assert.equal(parsed.classNumber, undefined, raw);
    }
  },
);

test(
  "synthetic staff patterns produce an operations-year hint",
  { skip: skipReason },
  async () => {
    for (const example of staffExamples) {
      assert.deepStrictEqual(await parseProfile(example.raw), example.expected);
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
  "single-class campus rows from the CSV always parse to campus, class, and cleaned display name",
  { skip: skipReason },
  async () => {
    const failures: string[] = [];

    for (const raw of matchedNames) {
      const expected = raw.match(SINGLE_CLASS_PROFILE_REGEX);
      if (!expected) {
        continue;
      }

      const parsed = await parseProfile(raw);
      const expectedCampus = expected[1];
      const expectedClassNumber = Number(expected[2]);

      if (parsed.campus !== expectedCampus) {
        failures.push(`${raw} -> campus ${parsed.campus ?? "-"} !== ${expectedCampus}`);
      }
      if (parsed.classNumber !== expectedClassNumber) {
        failures.push(
          `${raw} -> class ${String(parsed.classNumber)} !== ${String(expectedClassNumber)}`,
        );
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
