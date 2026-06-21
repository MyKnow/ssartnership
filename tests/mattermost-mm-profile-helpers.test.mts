import assert from "node:assert/strict";
import test from "node:test";

type MmProfileParserModule = typeof import("../src/lib/mm-profile/parser.ts");

const mmProfileParserPromise = import(
  new URL("../src/lib/mm-profile/parser.ts", import.meta.url).href,
) as Promise<MmProfileParserModule>;

test("mm profile parser extracts campus and staff hints from display names", async () => {
  const { parseSsafyProfile, parseSsafyProfileFromUser } = await mmProfileParserPromise;

  assert.deepStrictEqual(parseSsafyProfile("김싸피[서울]팀원"), {
    displayName: "김싸피",
    parsedName: "김싸피",
    parsedCampusRaw: "서울",
    campus: "서울",
    parsedCampusNormalized: "서울",
    parsedRegionNormalized: "서울",
    roleTitle: "팀원",
    parsedRoleTitle: "팀원",
    parseModeCandidateMatch: true,
  });

  assert.deepStrictEqual(
    parseSsafyProfileFromUser({
      nickname: "[광주]운영프로",
      first_name: "",
      last_name: "",
      username: "staff-user",
    }).isStaff,
    true,
  );
});
