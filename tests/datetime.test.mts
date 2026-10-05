import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatKoreanDateTimeLocalValue,
  formatKoreanDateTimeToMinute,
  formatKoreanDateTimeToSecond,
  formatKoreanIsoDate,
  formatKoreanLocaleDateTime,
  formatKoreanMediumDateTime,
  formatKoreanMonthDayTime,
  formatOptionalKoreanDateTimeToMinute,
  getKstDateParts,
  getKstDateString,
  KOREA_TIME_ZONE,
  parseKoreanDateTimeLocalValue,
  toIsoFromKoreanDateTimeLocalValue,
} from "@/lib/datetime";
import { toDateTimeLocalInput } from "@/lib/ad-coupon-period";
import { getKstPeriodKey } from "@/lib/ad-coupon-domain";
import { getSeoulDateParts } from "@/lib/ssafy-year";
import { getKstDateString as getPartnerKstDateString } from "@/lib/partner-utils";
import { getKstDateString as getPushKstDateString } from "@/lib/push/ops";

// 2026-10-04T15:30:00Z = KST 2026-10-05 00:30 (UTC 날짜와 KST 날짜가 다른 경계)
const KST_MIDNIGHT_EDGE = "2026-10-04T15:30:00.000Z";
// 2026-10-05T06:05:00Z = KST 2026-10-05 15:05
const KST_AFTERNOON = "2026-10-05T06:05:00.000Z";

function withTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
}

function snapshot() {
  return {
    date: formatKoreanDate(KST_MIDNIGHT_EDGE),
    minute: formatKoreanDateTimeToMinute(KST_AFTERNOON),
    second: formatKoreanDateTimeToSecond(KST_AFTERNOON),
    monthDayTime: formatKoreanMonthDayTime(KST_AFTERNOON),
    monthDayTime24: formatKoreanMonthDayTime(KST_AFTERNOON, { hour12: false }),
    monthDayTimeYear: formatKoreanMonthDayTime(KST_AFTERNOON, { year: true }),
    medium: formatKoreanMediumDateTime(KST_AFTERNOON),
    localeDefault: formatKoreanLocaleDateTime(KST_AFTERNOON),
    localeDefaultMidnight: formatKoreanLocaleDateTime(KST_MIDNIGHT_EDGE),
    shortStyle: formatKoreanDateTime(KST_AFTERNOON, { dateStyle: "short", timeStyle: "short", hour12: true }),
    period: formatKoreanDateTime(KST_AFTERNOON, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    localValue: formatKoreanDateTimeLocalValue(KST_MIDNIGHT_EDGE),
    couponLocalValue: toDateTimeLocalInput(KST_MIDNIGHT_EDGE),
    kstDate: getKstDateString(0, new Date(KST_MIDNIGHT_EDGE)),
    kstParts: getKstDateParts(KST_MIDNIGHT_EDGE),
    isoDate: formatKoreanIsoDate(KST_MIDNIGHT_EDGE),
    seoulParts: getSeoulDateParts(new Date(KST_MIDNIGHT_EDGE)),
    couponDailyKey: getKstPeriodKey(KST_MIDNIGHT_EDGE, "daily"),
  };
}

const EXPECTED = {
  date: "2026. 10. 5.",
  minute: "2026. 10. 5. 15:05",
  second: "2026. 10. 5. 15:05:00",
  monthDayTime: "10월 5일 오후 03:05",
  monthDayTime24: "10월 5일 15:05",
  monthDayTimeYear: "2026년 10월 5일 오후 03:05",
  medium: "2026. 10. 5. 오후 3:05",
  localeDefault: "2026. 10. 5. 오후 3:05:00",
  localeDefaultMidnight: "2026. 10. 5. 오전 12:30:00",
  shortStyle: "26. 10. 5. 오후 3:05",
  period: "10. 05. 오후 03:05",
  localValue: "2026-10-05T00:30",
  couponLocalValue: "2026-10-05T00:30",
  kstDate: "2026-10-05",
  kstParts: { year: 2026, month: 10, day: 5 },
  isoDate: "2026-10-05",
  seoulParts: { year: 2026, month: 10 },
  couponDailyKey: "2026-10-05",
};

test("KST 포맷터는 런타임 TZ가 UTC든 Asia/Seoul이든 같은 표기를 낸다", () => {
  assert.equal(KOREA_TIME_ZONE, "Asia/Seoul");
  const utc = withTimeZone("UTC", snapshot);
  const seoul = withTimeZone("Asia/Seoul", snapshot);
  const losAngeles = withTimeZone("America/Los_Angeles", snapshot);

  assert.deepEqual(utc, EXPECTED);
  assert.deepEqual(seoul, EXPECTED);
  assert.deepEqual(losAngeles, EXPECTED);
});

test("TZ 전환 하네스가 실제로 런타임 시간대를 바꾼다(timeZone 없는 포맷은 달라진다)", () => {
  const unpinned = (timeZone: string) =>
    withTimeZone(timeZone, () =>
      new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
        new Date(KST_AFTERNOON),
      ),
    );
  assert.notEqual(unpinned("UTC"), unpinned("Asia/Seoul"));
});

test("formatKoreanLocaleDateTime은 서울 시간대의 Date#toLocaleString(\"ko-KR\") 표기를 그대로 유지한다", () => {
  for (const value of [KST_AFTERNOON, KST_MIDNIGHT_EDGE, "2026-01-01T03:00:59.000Z"]) {
    const expected = withTimeZone("Asia/Seoul", () => new Date(value).toLocaleString("ko-KR"));
    assert.equal(withTimeZone("UTC", () => formatKoreanLocaleDateTime(value)), expected, value);
  }
});

test("잘못된 날짜와 빈 값은 포맷터마다 정해진 대체값을 쓴다", () => {
  assert.equal(formatKoreanDate("invalid"), "");
  assert.equal(formatKoreanMonthDayTime("invalid"), "");
  assert.equal(formatKoreanMediumDateTime("invalid"), "");
  assert.equal(formatKoreanLocaleDateTime("invalid"), "");
  assert.equal(formatKoreanDateTimeLocalValue("invalid"), "");
  assert.equal(toDateTimeLocalInput(null), "");
  assert.equal(formatOptionalKoreanDateTimeToMinute(null, "-"), "-");
  assert.equal(formatOptionalKoreanDateTimeToMinute(undefined, "없음"), "없음");
  assert.equal(formatOptionalKoreanDateTimeToMinute("", "-"), "-");
  assert.equal(formatOptionalKoreanDateTimeToMinute("not-a-date", "-"), "-");
  assert.equal(formatOptionalKoreanDateTimeToMinute(KST_AFTERNOON, "-"), "2026. 10. 5. 15:05");
  const invalidParts = getKstDateParts("invalid");
  assert.ok(Number.isNaN(invalidParts.year) && Number.isNaN(invalidParts.month) && Number.isNaN(invalidParts.day));
  assert.equal(getKstPeriodKey("invalid", "daily"), "invalid");
  assert.equal(formatKoreanIsoDate("invalid"), "");
});

test("formatKoreanIsoDate는 KST 00:00·23:59:59로 저장한 기간 값을 같은 날짜로 되돌린다", () => {
  // 관리자 플랜 기간은 `${date}T00:00:00+09:00`·`T23:59:59+09:00`으로 저장되고 DB는 UTC 문자열로 돌려준다.
  assert.equal(formatKoreanIsoDate("2026-10-04T15:00:00+00:00"), "2026-10-05");
  assert.equal(formatKoreanIsoDate("2026-10-05T00:00:00+09:00"), "2026-10-05");
  assert.equal(formatKoreanIsoDate("2026-10-31T14:59:59+00:00"), "2026-10-31");
  assert.equal(formatKoreanIsoDate("2026-10-05"), "2026-10-05");
  assert.equal(
    withTimeZone("UTC", () => formatKoreanDateTimeLocalValue("2026-10-04T15:30:00+00:00").replace("T", " ")),
    "2026-10-05 00:30",
  );
});

test("타임스탬프 문자열을 잘라 UTC 날짜·시각을 보여 주던 화면은 KST 공용 헬퍼를 쓴다", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const planManager = read("src/components/admin/AdminCompanyPlanManager.tsx");
  const couponPanel = read("src/components/partner/partner-service-detail-view/PartnerCouponPanel.tsx");
  const senderManager = read("src/components/admin/MattermostSenderManager.tsx");

  assert.doesNotMatch(planManager, /toISOString\(\)\.slice\(0, 10\)/);
  assert.match(planManager, /formatKoreanIsoDate\(value\)/);
  assert.doesNotMatch(couponPanel, /usage(?:Starts|Ends)At\.slice\(/);
  assert.match(couponPanel, /formatKoreanIsoDate\(coupon\.usageStartsAt\)/);
  assert.doesNotMatch(senderManager, /value\.slice\(0, 16\)/);
  assert.match(senderManager, /formatKoreanDateTimeLocalValue\(value\)/);
});

test("getKstDateString은 KST 날짜 경계와 일 단위 이동을 계산하고 기존 경로와 같은 구현을 쓴다", () => {
  const base = new Date("2026-04-14T15:00:00.000Z"); // KST 2026-04-15 00:00
  assert.equal(getKstDateString(0, base), "2026-04-15");
  assert.equal(getKstDateString(-1, base), "2026-04-14");
  assert.equal(getKstDateString(7, base), "2026-04-22");
  assert.equal(getKstDateString(0, new Date("2026-04-14T14:59:59.999Z")), "2026-04-14");
  assert.equal(getKstDateString(0, new Date("2026-12-31T15:00:00.000Z")), "2027-01-01");
  assert.equal(getPushKstDateString, getKstDateString);
  assert.equal(getPartnerKstDateString, getKstDateString);
});

test("datetime-local 값은 KST로 왕복한다", () => {
  const parsed = parseKoreanDateTimeLocalValue("2026-10-05T00:30");
  assert.equal(parsed?.toISOString(), KST_MIDNIGHT_EDGE);
  assert.equal(parseKoreanDateTimeLocalValue("2026-10-05 00:30"), null);
  assert.equal(toIsoFromKoreanDateTimeLocalValue("2026-10-05T15:05"), KST_AFTERNOON);
});

test("timeZone 없이 ko-KR로 날짜를 포맷하던 화면은 공용 KST 포맷터를 쓴다", () => {
  for (const path of [
    "src/components/admin/AdminMemberSignupApprovalQueue.tsx",
    "src/components/admin/AdminMemberSignupApprovalDetail.tsx",
    "src/components/admin/ad-packages/AdminPartnerCouponManager.tsx",
    "src/components/admin/ad-packages/AdminAdPackageManager.tsx",
    "src/components/partner/PartnerAccountInfoView.tsx",
    "src/components/coupons/CouponWalletView.tsx",
    "src/components/certification/AppleWalletPassCard.tsx",
    "src/app/admin/(protected)/event/page.tsx",
    "src/components/admin/AdminEventDetailView.tsx",
    "src/app/admin/(protected)/events/project-showcase/feedback/page.tsx",
    "src/app/admin/(protected)/events/project-showcase/logs/page.tsx",
    "src/components/admin/AdminProfilePhotoReviewQueue.tsx",
    "src/components/admin/AdminMemberManualAddPanel.tsx",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /new Intl\.DateTimeFormat\(/, path);
    assert.match(source, /from "@\/lib\/datetime"/, path);
  }
});

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("날짜 객체를 toLocale*String으로 직접 포맷하지 않고 KST 고정 공용 포맷터를 쓴다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders = listSourceFiles(sourceRoot)
    .map((file) => ({
      relative: decodeURIComponent(file.href.slice(sourceRoot.href.length)),
      source: readFileSync(file, "utf8"),
    }))
    .filter(
      ({ relative, source }) =>
        relative !== "lib/datetime.ts" &&
        (/\.toLocale(?:Date|Time)String\(/u.test(source) ||
          /\bDate\([^()]*\)\.toLocaleString\(/u.test(source)),
    )
    .map(({ relative }) => relative);
  assert.deepEqual(offenders, []);
});

test("Intl.DateTimeFormat은 datetime.ts 안에서만 만들고 화면·도메인은 KST 공용 헬퍼를 쓴다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders = listSourceFiles(sourceRoot)
    .map((file) => ({
      relative: decodeURIComponent(file.href.slice(sourceRoot.href.length)),
      source: readFileSync(file, "utf8"),
    }))
    .filter(({ relative, source }) => relative !== "lib/datetime.ts" && /\bIntl\.DateTimeFormat\(/u.test(source))
    .map(({ relative }) => relative);
  assert.deepEqual(offenders, []);
});
