import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const appRoot = new URL("../src/app/", import.meta.url);
const loadingRoot = new URL("../src/components/loading/", import.meta.url);

function listLoadingFiles() {
  return readdirSync(appRoot, { recursive: true })
    .map(String)
    .filter((path) => path.endsWith("loading.tsx"))
    .sort();
}

function readApp(path: string) {
  return readFileSync(new URL(path, appRoot), "utf8");
}

test("모든 route loading은 스크린리더용 불러오는 중 안내를 정확히 하나 렌더한다", () => {
  const files = listLoadingFiles();
  assert.ok(files.length >= 50, `loading.tsx 수가 예상보다 적습니다: ${files.length}`);

  for (const file of files) {
    const source = readApp(file);
    const occurrences = source.match(/<RouteLoadingStatus \/>/g) ?? [];
    assert.equal(occurrences.length, 1, `${file}: RouteLoadingStatus는 한 번만 렌더해야 합니다.`);
  }
});

test("공유 스켈레톤은 live region을 만들지 않아 Suspense fallback과 중복 안내가 없다", () => {
  const skeletonFiles = readdirSync(loadingRoot)
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
    .filter((file) => file !== "RouteLoadingStatus.tsx");

  for (const file of skeletonFiles) {
    const source = readFileSync(new URL(file, loadingRoot), "utf8");
    assert.doesNotMatch(source, /role="status"|aria-live=/, `${file}`);
    assert.doesNotMatch(source, /RouteLoadingStatus/, `${file}`);
  }

  const status = readFileSync(new URL("RouteLoadingStatus.tsx", loadingRoot), "utf8");
  assert.match(status, /role="status" className="sr-only"/);
  assert.match(status, /화면을 불러오는 중입니다\./);
});

test("관리자 route loading은 AdminShell 안에서 스켈레톤을 보여 탐색 셸을 유지한다", () => {
  const adminFiles = listLoadingFiles().filter((file) =>
    file.startsWith("admin/(protected)/"),
  );
  assert.ok(adminFiles.length >= 30);

  const skeletons = readFileSync(new URL("AdminPageSkeletons.tsx", loadingRoot), "utf8");
  assert.match(
    skeletons,
    /export function AdminRouteSkeleton[\s\S]*?<AdminShell title=\{title\} backHref=\{backHref\} backLabel=\{backLabel\}>/,
  );

  for (const file of adminFiles) {
    const source = readApp(file);
    if (/SkeletonContent/.test(source)) {
      assert.match(source, /<AdminRouteSkeleton title="[^"]+"/, `${file}: 셸 없는 SkeletonContent를 직접 렌더합니다.`);
    }
  }
});

test("쿠폰함과 혜택 이용 확인은 홈·제휴처 상세 대신 화면 전용 스켈레톤을 쓴다", () => {
  const expectations = [
    ["(site)/coupons/loading.tsx", "CouponWalletPageSkeleton"],
    ["(site)/partners/[id]/benefit-use/loading.tsx", "PartnerBenefitUsePageSkeleton"],
  ] as const;
  const skeletons = readFileSync(new URL("SitePageSkeletons.tsx", loadingRoot), "utf8");

  for (const [file, skeleton] of expectations) {
    const source = readApp(file);
    assert.match(source, new RegExp(`<${skeleton} />`), file);
    assert.doesNotMatch(source, /HomePageSkeleton|PublicPartnerDetailSkeleton/, file);
    assert.match(skeletons, new RegExp(`export function ${skeleton}\\(`));
  }
});
