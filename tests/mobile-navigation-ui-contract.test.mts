import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mobileNavSourceUrl = new URL(
  "../src/components/MobileNav.tsx",
  import.meta.url,
);
const mobileNavGuestGateSourceUrl = new URL(
  "../src/components/MobileNavGuestGate.tsx",
  import.meta.url,
);
const siteHeaderSourceUrl = new URL(
  "../src/components/SiteHeader.tsx",
  import.meta.url,
);
const siteNavigationSourceUrl = new URL(
  "../src/lib/site-navigation.ts",
  import.meta.url,
);
const siteLayoutSourceUrl = new URL(
  "../src/app/(site)/layout.tsx",
  import.meta.url,
);
const footerSourceUrl = new URL(
  "../src/components/Footer.tsx",
  import.meta.url,
);
const globalsSourceUrl = new URL("../src/app/globals.css", import.meta.url);
const certificationActionsSourceUrl = new URL(
  "../src/components/certification/CertificationFooterActions.tsx",
  import.meta.url,
);
const partnerDetailActionBarSourceUrl = new URL(
  "../src/app/(site)/partners/[id]/_page/PartnerDetailMobileActionBar.tsx",
  import.meta.url,
);

test("모바일 공용 탐색은 검색 섬과 홈·쿠폰함·내 정보 묶음을 제공한다", async () => {
  const source = await readFile(mobileNavSourceUrl, "utf8");

  assert.match(source, /aria-label="모바일 주요 탐색"/);
  assert.match(source, /aria-label="혜택 검색"/);
  assert.match(source, /label: "홈"/);
  assert.match(source, /label: "쿠폰함"/);
  assert.match(source, /label: "내 정보"/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(source, /grid-cols-3/);
  assert.ok(
    source.indexOf("grid min-w-0 flex-1 grid-cols-3") <
      source.indexOf('aria-label="혜택 검색"'),
    "홈·쿠폰함·내 정보 묶음 다음에 우측 검색 섬이 렌더링되어야 합니다.",
  );
});

test("모바일 하단 탐색이 보이면 테마는 헤더로 옮기고 Footer 알림 중복을 숨긴다", async () => {
  const [headerSource, footerSource, globalsSource] = await Promise.all([
    readFile(siteHeaderSourceUrl, "utf8"),
    readFile(footerSourceUrl, "utf8"),
    readFile(globalsSourceUrl, "utf8"),
  ]);

  assert.match(headerSource, /data-site-header-theme-toggle/);
  assert.match(footerSource, /data-site-footer-theme-mode/);
  assert.match(footerSource, /data-site-footer-notifications/);
  assert.match(
    globalsSource,
    /body:has\(\[data-site-mobile-navigation\]\) \[data-site-header-theme-toggle\] \{\s*display: flex;/,
  );
  assert.match(
    globalsSource,
    /body:has\(\[data-site-mobile-navigation\]\) \[data-site-footer-theme-mode\],[\s\S]*body:has\(\[data-site-mobile-navigation\]\) \[data-site-footer-notifications\] \{\s*display: none;/,
  );
});

test("비로그인 회원 목적지는 로그인 후 복귀 경로를 보존한다", async () => {
  const [source, guestGateSource] = await Promise.all([
    readFile(mobileNavSourceUrl, "utf8"),
    readFile(mobileNavGuestGateSourceUrl, "utf8"),
  ]);

  assert.match(source, /returnTo=\$\{encodeURIComponent\(href\)\}/);
  assert.match(source, /setGuestDestination\(guestOnlyDestination\)/);
  assert.match(source, /aria-haspopup=/);
  assert.match(source, /aria-expanded=/);
  assert.match(source, /<MobileNavGuestGate/);
  assert.match(guestGateSource, /<Modal/);
  assert.match(guestGateSource, /쿠폰함은 로그인 후 이용할 수 있어요/);
  assert.match(guestGateSource, /내 정보를 확인하려면 로그인해 주세요/);
  assert.match(
    guestGateSource,
    /panelClassName="mx-2 max-w-md px-5 py-6 sm:mx-0 sm:p-6"/,
  );
  assert.match(guestGateSource, /titleClassName="text-ko-title"/);
  assert.match(
    guestGateSource,
    /`\/auth\/login\?returnTo=\$\{encodeURIComponent\(config\.returnTo\)\}`/,
  );
  assert.match(
    guestGateSource,
    /`\/auth\/signup\?returnTo=\$\{encodeURIComponent\(config\.returnTo\)\}`/,
  );
  assert.match(source, /isFocusedSiteFlow\(pathname\)/);
  assert.match(source, /isPartnerDetailPath\(pathname\)/);
});

test("설정은 공용 헤더에서 진입하고 내 정보 탐색 상태를 공유한다", async () => {
  const [headerSource, mobileNavSource, navigationSource] = await Promise.all([
    readFile(siteHeaderSourceUrl, "utf8"),
    readFile(mobileNavSourceUrl, "utf8"),
    readFile(siteNavigationSourceUrl, "utf8"),
  ]);

  assert.match(headerSource, /Cog6ToothIcon/);
  assert.match(headerSource, /ariaLabel="설정"/);
  assert.match(headerSource, /buildSettingsHref\(pathname\)/);
  assert.match(headerSource, /!isFocusedSiteFlow\(pathname\)/);
  assert.match(mobileNavSource, /isMyInfoPath\(pathname\)/);
  assert.match(navigationSource, /pathname\.startsWith\("\/settings"\)/);
  assert.match(
    navigationSource,
    /pathname\.startsWith\("\/certification\/email"\)/,
  );
  assert.match(
    navigationSource,
    /pathname\.startsWith\("\/certification\/photo"\)/,
  );
});

test("모바일 하단 탐색은 페이지 스켈레톤 전환에도 유지되는 공용 레이아웃에 속한다", async () => {
  const [headerSource, layoutSource] = await Promise.all([
    readFile(siteHeaderSourceUrl, "utf8"),
    readFile(siteLayoutSourceUrl, "utf8"),
  ]);

  assert.doesNotMatch(headerSource, /MobileNav/);
  assert.match(
    layoutSource,
    /<MobileNav signedInUserId=\{session\?\.userId\} \/>[\s\S]*<div className="flex-1">\{children\}<\/div>/,
  );
  assert.match(
    headerSource,
    /<div\s+data-site-header-theme-toggle\s+className="hidden md:flex"\s*>\s*<ThemeToggle \/>/,
  );
  assert.match(headerSource, /ariaLabel="알림"/);
});

test("glass 탐색은 safe area와 하단 피드백 영역을 보호한다", async () => {
  const [source, footerSource, layoutSource, actionBarSource] =
    await Promise.all([
      readFile(globalsSourceUrl, "utf8"),
      readFile(footerSourceUrl, "utf8"),
      readFile(siteLayoutSourceUrl, "utf8"),
      readFile(partnerDetailActionBarSourceUrl, "utf8"),
    ]);

  assert.match(source, /--navigation-glass:/);
  assert.match(source, /backdrop-filter: blur\(24px\) saturate\(180%\)/);
  assert.match(source, /\[data-toast-viewport\]/);
  assert.match(
    source,
    /body:has\(\[data-partner-detail-mobile-action-bar\]\) \[data-toast-viewport\] \{\s*bottom: calc\(env\(safe-area-inset-bottom\) \+ 6rem\);/,
  );
  assert.match(
    source,
    /body:has\(\[data-partner-detail-desktop-action-fab\]\) \[data-toast-viewport\] \{\s*bottom: 6rem;/,
  );
  assert.match(actionBarSource, /bottom-0/);
  assert.match(actionBarSource, /pb-safe-bottom-2/);
  assert.match(
    source,
    /\[data-site-footer-navigation-reserve\] \{\s*padding-bottom: calc\(env\(safe-area-inset-bottom\) \+ 7\.75rem\)/,
  );
  assert.match(
    footerSource,
    /data-site-footer-navigation-reserve=\{\s*reserveMobileNavigationSpace \? "" : undefined\s*\}/,
  );
  assert.match(footerSource, /bg-surface-overlay\/90/);
  assert.match(layoutSource, /<Footer reserveMobileNavigationSpace \/>/);
});

test("내 정보 계정 관리는 메뉴에서 이동한 모바일 로그아웃 경로를 유지한다", async () => {
  const source = await readFile(certificationActionsSourceUrl, "utf8");

  assert.match(source, /className="md:hidden"/);
  assert.match(source, /로그아웃하시겠습니까/);
  assert.match(source, /fetch\("\/api\/mm\/logout", \{ method: "POST" \}\)/);
});
