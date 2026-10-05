import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  GRADUATE_CERTIFICATE_RETENTION_DAYS,
  GRADUATE_FILE_RETENTION_NOTICE,
} from "@/lib/graduate-verification";

const root = new URL("..", import.meta.url);
const POLICY_MIGRATION = "20261005111738_publish_privacy_policy_v4.sql";

async function readProjectFile(path: string) {
  return readFile(new URL(path, root), "utf8");
}

async function readPolicy() {
  const migration = await readProjectFile(`supabase/migrations/${POLICY_MIGRATION}`);
  const match = /\$\$([\s\S]*?)\$\$/u.exec(migration);
  assert.ok(match, "policy content is dollar-quoted");
  return { migration, content: match[1] };
}

function sectionOf(content: string, heading: string) {
  const start = content.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing section ${heading}`);
  const next = content.indexOf("\n## ", start + 3);
  return content.slice(start, next === -1 ? undefined : next);
}

test("처리방침 v4는 privacy 문서 하나만 활성화하고 재적용해도 같은 행을 갱신한다", async () => {
  const { migration } = await readPolicy();

  assert.match(migration, /update public\.policy_documents\s+set is_active = false[\s\S]*?where kind = 'privacy'\s+and is_active = true;/u);
  assert.match(migration, /values \(\s*'privacy',\s*4,/u);
  assert.match(migration, /on conflict \(kind, version\) do update set/u);
  assert.doesNotMatch(migration, /'service'|'marketing'/u, "only the privacy policy changes version");
});

test("처리방침 본문은 PolicyDocumentView가 그리는 블록 형식만 쓴다", async () => {
  const { content } = await readPolicy();
  const blocks = content.split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean);

  const headings: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const body = lines[0].startsWith("## ") ? lines.slice(1) : lines;
    if (lines[0].startsWith("## ")) headings.push(lines[0]);
    const listLines = body.filter((line) => line.startsWith("- "));
    assert.ok(
      listLines.length === 0 || listLines.length === body.length,
      `a block mixes paragraphs and list items: ${lines[0]}`,
    );
    for (const line of body) {
      assert.doesNotMatch(line, /^(?:#|\* |\d+\. |\|)/u, `unsupported markdown line: ${line}`);
    }
    assert.doesNotMatch(block, /\*\*|\[[^\]]+\]\(/u, "no inline markdown the renderer would print literally");
  }

  assert.deepEqual(
    headings.map((heading) => Number(/^## (\d+)\./u.exec(heading)?.[1])),
    [1, 2, 3, 4, 5, 6, 7, 8],
    "sections are numbered in order",
  );
});

test("처리방침은 자체 호스팅과 실제 외부 전송처를 고지하고 폐기한 클라우드를 언급하지 않는다", async () => {
  const { content } = await readPolicy();
  const transfer = sectionOf(content, "4. 처리 환경과 외부 전송");

  assert.doesNotMatch(content, /Supabase|Vercel/iu);
  assert.match(transfer, /자체 호스팅/u);
  // The production mail provider follows the email delivery module (Resend first, SMTP rollback).
  const emailDelivery = await readProjectFile("src/lib/email-delivery.ts");
  assert.match(emailDelivery, /api\.resend\.com/u);
  assert.match(transfer, /Resend, Inc\.\(미국\)/u);
  assert.match(transfer, /SMTP 메일 서비스/u);
  // Apple Wallet updates go through APNs.
  const walletPush = await readProjectFile("src/lib/wallet/apple/push.ts");
  assert.match(walletPush, /api\.push\.apple\.com/u);
  assert.match(transfer, /Apple Push Notification service/u);
  assert.match(transfer, /웹 푸시 서비스/u);
  assert.match(transfer, /SSAFY Mattermost/u);
  const businessStatus = await readProjectFile("src/lib/nts-business-status.ts");
  assert.match(businessStatus, /api\.odcloud\.kr/u);
  assert.match(transfer, /국세청 사업자등록 상태 조회/u);
  assert.match(transfer, /제3자에게 제공하지 않습니다/u);
});

test("수집 항목은 이메일·수료생 인증·Wallet·쇼케이스·쿠폰·동의 IP/UA·제휴 담당자를 포함한다", async () => {
  const { content } = await readPolicy();
  const items = sectionOf(content, "2. 수집 항목");

  for (const expected of [
    "이메일 주소",
    "교육이수증(PDF)",
    "본인 사진",
    "Apple Wallet 회원 카드",
    "학번 7자리",
    "쿠폰 발급·사용 기록",
    "동의할 때의 IP 주소와 user-agent",
    "제휴처 담당자 정보",
    "사업자등록번호",
    "웹 푸시 구독 정보",
  ]) {
    assert.ok(items.includes(expected), `수집 항목에 ${expected}이(가) 없다`);
  }
});

test("보유 기간은 데이터 수명주기 결정표와 같은 값을 고지한다", async () => {
  const { content } = await readPolicy();
  const retention = sectionOf(content, "3. 보유 및 이용 기간");
  const lifecycle = await readProjectFile("docs/security/data-lifecycle.md");

  const pairs: Array<[RegExp, RegExp]> = [
    [/30일 뒤 이름·이메일·연락 수단·사진 등 식별 정보를 익명화/u, /30일 뒤 익명화/u],
    [/교육이수증: 검토가 끝난 날부터 30일 뒤 삭제/u, /수료생 교육이수증 파일 \| 검토 완료 후 30일/u],
    [/제출하지 않은 업로드 파일은 24시간 뒤 삭제/u, /사용하지 않은 파일 \| 24시간/u],
    [/제품 이용 기록\(IP 주소·user-agent 포함\), 보안·감사 기록, 푸시 발송 기록: 생성일부터 1년/u, /`event_logs`[^\n]*\| 생성 후 1년/u],
    [/제휴 혜택 사용 기록: 생성일부터 1년/u, /`partner_benefit_usages`\) \| 생성 후 1년/u],
    [/시도 제한 기록: 30일/u, /rate-limit 시도 기록 7종[^\n]*\| 시도 창 시작 후 30일/u],
    [/발송 결과: 180일/u, /생성 후 180일/u],
    [/이미지 업로드 처리 기록: 만료 후 30일/u, /`expired` 행은 만료 후 30일/u],
    [/식별자 기록: 400일/u, /식별자 원장[^\n]*\| 400일/u],
    [/행사 정산 후 30일/u, /정산 기록 후 30일/u],
    [/익명화할 때 IP 주소와 user-agent를 삭제/u, /익명화 때 IP·user-agent만 지우고/u],
    [/백업 사본이 만료될 때까지 최대 30일/u, /외부 사본 \| 기본 30일/u],
  ];
  for (const [policyText, lifecycleText] of pairs) {
    assert.match(retention, policyText);
    assert.match(lifecycle, lifecycleText);
  }
});

test("열람 요청 절차와 처리 기한, 문의처를 고지한다", async () => {
  const { content } = await readPolicy();
  const rights = sectionOf(content, "5. 이용자의 권리와 열람 요청 절차");

  assert.match(rights, /요청을 받은 날부터 10일 이내/u);
  assert.match(rights, /본인 확인 후 처리합니다/u);
  assert.match(rights, /회원 탈퇴를 직접 할 수 있습니다/u);
  assert.match(sectionOf(content, "7. 개인정보 보호책임자와 문의처"), /- 이메일: /u);
});

test("schema.sql 스냅샷은 처리방침 v4 migration 원문을 담는다", async () => {
  const [schema, migration] = await Promise.all([
    readProjectFile("supabase/schema.sql"),
    readProjectFile(`supabase/migrations/${POLICY_MIGRATION}`),
  ]);
  const header = `-- Snapshot of ${POLICY_MIGRATION}\n`;
  const start = schema.indexOf(header);
  assert.notEqual(start, -1);
  const next = schema.indexOf("\n-- Snapshot of ", start + header.length);
  assert.equal(schema.slice(start + header.length, next === -1 ? undefined : next).trim(), migration.trim());
});

test("수료생 제출 동의 문구는 교육이수증 삭제 기한을 SQL·처리방침과 같은 값으로 알린다", async () => {
  const [{ content }, approval, view] = await Promise.all([
    readPolicy(),
    readProjectFile("supabase/migrations/20260902150504_fix_graduate_approval_member_schema.sql"),
    readProjectFile("src/components/graduate-verification/GraduateVerificationApplicationView.tsx"),
  ]);

  assert.match(
    approval,
    new RegExp(`certificate_delete_after = now\\(\\) \\+ interval '${GRADUATE_CERTIFICATE_RETENTION_DAYS} days'`, "u"),
  );
  assert.match(GRADUATE_FILE_RETENTION_NOTICE, new RegExp(`${GRADUATE_CERTIFICATE_RETENTION_DAYS}일 뒤 삭제`, "u"));
  assert.match(content, new RegExp(`교육이수증: 검토가 끝난 날부터 ${GRADUATE_CERTIFICATE_RETENTION_DAYS}일 뒤 삭제`, "u"));
  assert.match(view, /\{GRADUATE_FILE_RETENTION_NOTICE\}/u);
});
