import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

type MemberAudienceSnapshotModule =
  typeof import("../src/lib/member-audience-snapshot.ts");
type MockMemberModule = typeof import("../src/lib/mock/member.ts");

const memberAudienceSnapshotModulePromise = import(
  new URL("../src/lib/member-audience-snapshot.ts", import.meta.url).href,
) as Promise<MemberAudienceSnapshotModule>;
const mockMemberModulePromise = import(
  new URL("../src/lib/mock/member.ts", import.meta.url).href,
) as Promise<MockMemberModule>;

test("partner viewer context reads only the lean audience snapshot", () => {
  const source = readRepoFile("src/lib/partner-view-context.ts");

  assert.match(source, /getMemberAudienceSnapshot/);
  assert.doesNotMatch(source, /getMemberCanonicalProfile/);
});

test("member audience snapshot keeps only generation and graduate verification fields", () => {
  const source = readRepoFile("src/lib/member-audience-snapshot.ts");

  assert.match(source, /\.from\("members"\)/);
  assert.match(source, /\.select\("id,generation"\)/);
  assert.match(source, /\.from\("graduate_profiles"\)/);
  assert.match(source, /\.select\("verified_at"\)/);
  assert.doesNotMatch(
    source,
    /display_name|campus|mattermost_account_id|getMemberProfilePhotoState|mm_user_directory/,
  );
});

test("member audience snapshot preserves mock generation and graduate verification state", async () => {
  const originalDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

  try {
    process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

    const [{ getMemberAudienceSnapshot }, { MOCK_MEMBER_ID }] = await Promise.all([
      memberAudienceSnapshotModulePromise,
      mockMemberModulePromise,
    ]);

    assert.deepEqual(await getMemberAudienceSnapshot(MOCK_MEMBER_ID), {
      generation: 15,
      graduateVerifiedAt: null,
    });
    assert.equal(await getMemberAudienceSnapshot("missing-member"), null);
  } finally {
    if (originalDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = originalDataSource;
    }
  }
});

test("benefit-use derives viewer audience from the certification member view it already loads", () => {
  const source = readRepoFile("src/app/(site)/partners/[id]/benefit-use/page.tsx");
  const certificationMemberView = readRepoFile(
    "src/lib/certification-member-view.server.ts",
  );

  assert.match(source, /resolvePartnerAudienceFromMemberYear/);
  assert.match(source, /getCertificationMemberView\(session\.userId\)/);
  assert.match(certificationMemberView, /getMemberCanonicalProfile\(memberId\)/);
  assert.match(source, /const viewerAudience = resolvePartnerAudienceFromMemberYear\(/);
  assert.match(
    source,
    /partnerRepository\.getPartnerById\(partnerId,\s*\{[\s\S]*viewerAudience[\s\S]*\}\)/,
  );
  assert.doesNotMatch(source, /getPartnerViewerContext/);
  assert.equal(
    (source.match(/getCertificationMemberView\(session\.userId\)/g) ?? []).length,
    1,
  );
});
