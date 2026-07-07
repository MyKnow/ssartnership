import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type NewPartnerNotificationsModule = typeof import("../src/lib/new-partner-notifications.ts");

const modulePromise = import(
  new URL("../src/lib/new-partner-notifications.ts", import.meta.url).href
) as Promise<NewPartnerNotificationsModule>;

describe("new partner campus-scoped notifications", () => {
  it("keeps nationwide partner notifications as all-audience sends", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    const result = buildNewPartnerPushAudienceFromCampusMembers(
      ["seoul", "gumi", "daejeon", "busan-ulsan-gyeongnam", "gwangju"],
      [],
    );

    assert.deepStrictEqual(result?.audience, { scope: "all" });
    assert.equal(result?.targetMemberIds, null);
  });

  it("targets only members in the selected exposure campuses", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    const result = buildNewPartnerPushAudienceFromCampusMembers(
      ["seoul", "daejeon", "seoul", "unknown"],
      [
        { id: "m-seoul", campus: "서울" },
        { id: "m-seoul-full", campus: "서울 캠퍼스" },
        { id: "m-daejeon", campus: "대전" },
        { id: "m-gumi", campus: "구미" },
        { id: "m-empty", campus: null },
      ],
    );

    assert.deepStrictEqual(result?.audience, {
      scope: "member",
      memberId: "m-seoul",
      memberIds: ["m-seoul", "m-seoul-full", "m-daejeon"],
    });
    assert.deepStrictEqual(result?.targetCampusLabels, ["서울", "대전"]);
  });

  it("does not send when no exposure campus can be resolved", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    assert.equal(
      buildNewPartnerPushAudienceFromCampusMembers([], [
        { id: "m-seoul", campus: "서울" },
      ]),
      null,
    );
  });

  it("uses the campus-scoped notification helper in both creation approval paths", () => {
    const createSource = readFileSync(
      "src/app/admin/(protected)/_actions/partner-actions/create.ts",
      "utf8",
    );
    const registrationSource = readFileSync(
      "src/app/admin/(protected)/partner-registrations/actions.ts",
      "utf8",
    );

    assert.match(createSource, /sendCampusScopedNewPartnerNotification/);
    assert.doesNotMatch(createSource, /audience:\s*\{\s*scope:\s*"all"\s*\}/);
    assert.match(registrationSource, /sendCampusScopedNewPartnerNotification/);
    assert.match(registrationSource, /status\s*===\s*"converted"/);
    assert.match(registrationSource, /previousStatus\s*!==\s*"converted"/);
  });
});
