import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  buildPwaInstallGuideHref,
  detectPwaInstallPlatform,
  parsePwaInstallPlatform,
} from "@/lib/pwa-install";

const guideViewSource = readFileSync(
  new URL("../src/components/pwa/PwaInstallGuideView.tsx", import.meta.url),
  "utf8",
);

test("Android 브라우저는 Android 설치 안내로 분기한다", () => {
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    }),
    "android",
  );
});

test("iPhone과 일반 iPad 사용자 에이전트는 iOS 설치 안내로 분기한다", () => {
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }),
    "ios",
  );
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      platform: "iPad",
      maxTouchPoints: 5,
    }),
    "ios",
  );
});

test("데스크톱 사용자 에이전트를 쓰는 iPadOS도 터치 입력으로 판별한다", () => {
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    "ios",
  );
});

test("터치가 없는 macOS와 다른 데스크톱은 기타 안내로 분기한다", () => {
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
      platform: "MacIntel",
      maxTouchPoints: 0,
    }),
    "other",
  );
  assert.equal(
    detectPwaInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36",
      platform: "Win32",
      maxTouchPoints: 0,
    }),
    "other",
  );
});

test("User-Agent Client Hints의 플랫폼도 우선 판별에 사용한다", () => {
  assert.equal(
    detectPwaInstallPlatform({
      userAgent: "Mozilla/5.0",
      userAgentDataPlatform: "Android",
    }),
    "android",
  );
  assert.equal(
    detectPwaInstallPlatform({
      userAgent: "Mozilla/5.0",
      userAgentDataPlatform: "iOS",
    }),
    "ios",
  );
});

test("설치 안내 주소와 외부 쿼리 값을 허용된 플랫폼으로 정규화한다", () => {
  assert.equal(
    buildPwaInstallGuideHref("android"),
    "/install?platform=android",
  );
  assert.equal(buildPwaInstallGuideHref("ios"), "/install?platform=ios");
  assert.equal(parsePwaInstallPlatform("android"), "android");
  assert.equal(parsePwaInstallPlatform(["ios", "android"]), "ios");
  assert.equal(parsePwaInstallPlatform("javascript:alert(1)"), "other");
  assert.equal(parsePwaInstallPlatform(undefined), "other");
});

test("모바일 설치 안내는 현재 화면에서 바로 누를 조작과 실제 시뮬레이터 화면을 제공한다", () => {
  assert.doesNotMatch(
    guideViewSource,
    /(?:Chrome|Safari)에서 싸트너십을 여세요/,
  );
  assert.match(guideViewSource, /Safari 하단의 더보기를 누르세요/);
  assert.match(guideViewSource, /오른쪽 위 더보기 메뉴를 누르세요/);
  assert.match(guideViewSource, /공유 시트에서 더 보기를 누르세요/);
  assert.match(guideViewSource, /홈 화면에 추가를 선택하세요/);
  assert.match(guideViewSource, /이름을 확인하고 추가를 누르세요/);
  assert.match(
    guideViewSource,
    /기기가 다르게 감지됐다면 직접 선택해 주세요\./,
  );
  assert.doesNotMatch(
    guideViewSource,
    /앱스토어를 거치지 않고 홈 화면에 추가해 더 빠르게 이용할 수 있습니다\./,
  );
  assert.doesNotMatch(guideViewSource, /실제 화면/);
  assert.doesNotMatch(guideViewSource, /<figcaption/);

  for (const imageName of [
    "android-chrome-toolbar.png",
    "android-chrome-menu.png",
    "ios-safari-toolbar.png",
    "ios-safari-menu.png",
    "ios-safari-share-sheet.png",
    "ios-safari-share-actions.png",
    "ios-safari-add-confirmation.png",
  ]) {
    assert.equal(
      existsSync(
        new URL(`../src/assets/install-guides/${imageName}`, import.meta.url),
      ),
      true,
      `${imageName} 시뮬레이터 화면 자료가 있어야 한다`,
    );
    assert.match(guideViewSource, new RegExp(imageName.replace(".", "\\.")));
  }
});
