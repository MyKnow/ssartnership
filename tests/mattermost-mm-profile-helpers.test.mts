import assert from "node:assert/strict";
import test from "node:test";

type MattermostConfigModule = typeof import("../src/lib/mattermost/config.ts");
type MmProfileParserModule = typeof import("../src/lib/mm-profile/parser.ts");

const mattermostConfigPromise = import(
  new URL("../src/lib/mattermost/config.ts", import.meta.url).href,
) as Promise<MattermostConfigModule>;

const mmProfileParserPromise = import(
  new URL("../src/lib/mm-profile/parser.ts", import.meta.url).href,
) as Promise<MmProfileParserModule>;

test("mattermost config falls back to default student channel settings", async () => {
  const { getStudentChannelConfig } = await mattermostConfigPromise;

  assert.deepStrictEqual(getStudentChannelConfig(), {
    teamName: "s15public",
    channelName: "off-topic",
  });
});

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
