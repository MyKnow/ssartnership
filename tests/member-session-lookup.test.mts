import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lookupMemberSession } from "../src/lib/member-session-lookup.ts";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("a signed-in member never triggers the unavailability probe", async () => {
  let probed = 0;
  const result = await lookupMemberSession(
    "[scope] lookup failed",
    async () => ({ userId: "member-1" }),
    async () => {
      probed += 1;
      return true;
    },
  );
  assert.deepEqual(result, { ok: true, session: { userId: "member-1" } });
  assert.equal(probed, 0);
});

test("an empty session is signed out unless the member lookup is unavailable", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });

  assert.deepEqual(
    await lookupMemberSession("[scope] lookup failed", async () => null, async () => false),
    { ok: true, session: null },
  );
  assert.equal(lines.length, 0);

  assert.deepEqual(
    await lookupMemberSession("[scope] lookup failed", async () => null, async () => true),
    { ok: false },
  );
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, "[scope] lookup failed");
  assert.deepEqual(entry.properties, { reasonCode: "member_lookup_unavailable" });
});

test("a thrown session or probe failure is unavailable, not signed out", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });

  assert.deepEqual(
    await lookupMemberSession(
      "[scope] lookup failed",
      async () => { throw Object.assign(new Error("policy read failed"), { code: "PGRST000" }); },
      async () => false,
    ),
    { ok: false },
  );
  assert.deepEqual(
    await lookupMemberSession(
      "[scope] lookup failed",
      async () => null,
      async () => { throw new Error("cookies unavailable"); },
    ),
    { ok: false },
  );
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).error.code, "PGRST000");
});

test("review routes answer 503 when the member row cannot be read, not 401", () => {
  const shared = read("src/app/api/partners/[id]/reviews/_shared.ts");
  assert.match(
    shared,
    /lookupMemberSession\(\s*"\[partner-review\] member session lookup failed",\s*getReviewMemberSession,\s*isUserSessionLookupUnavailable,\s*\)/u,
  );

  const userAuth = read("src/lib/user-auth.ts");
  const probeStart = userAuth.indexOf("export async function isUserSessionLookupUnavailable");
  assert.ok(probeStart > 0, "user-auth must expose the member lookup probe");
  // getUserSession reuses the signed-session member snapshot (see
  // user-session-request-cache.test.mts), so the probe stays above it.
  assert.ok(probeStart < userAuth.indexOf("export const getUserSession = cache"));
  const probe = userAuth.slice(probeStart, userAuth.indexOf("export async function setUserSession"));
  assert.match(probe, /if \(isMockMemberAuthEnabled\(\)\) \{\s*return false;/u);
  assert.match(probe, /getRawSignedUserSession\(\)/u);
  assert.match(probe, /const \{ error \} = await getSupabaseAdminClient\(\)\s*\.from\("members"\)/u);
  assert.match(probe, /return Boolean\(error\);/u);
});
