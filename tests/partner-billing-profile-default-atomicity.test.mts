import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "mock";

type BillingProfilesModule = typeof import("../src/lib/partner-billing-profiles.ts");

const billingProfilesModulePromise = import(
  new URL("../src/lib/partner-billing-profiles.ts", import.meta.url).href,
) as Promise<BillingProfilesModule>;
const migrationPromise = readFile(
  new URL(
    "../supabase/migrations/20260831043301_set_partner_billing_profile_default_atomically.sql",
    import.meta.url,
  ),
  "utf8",
);
const schemaPromise = readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const sourcePromise = readFile(
  new URL("../src/lib/partner-billing-profiles.ts", import.meta.url),
  "utf8",
);

function resetMockBillingProfiles() {
  const scope = globalThis as typeof globalThis & {
    __mockPartnerBillingProfiles?: unknown;
  };
  delete scope.__mockPartnerBillingProfiles;
}

function getFunctionSql(sql: string, functionName: string) {
  const start = sql.indexOf(
    `create or replace function public.${functionName}(`,
  );
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `${functionName} must terminate`);
  return sql.slice(start, end + 4);
}

test("기본 청구 프로필 RPC는 실패 시 롤백되고 계정 단위 동시 전환을 직렬화한다", async () => {
  const [migration, schema, source] = await Promise.all([
    migrationPromise,
    schemaPromise,
    sourcePromise,
  ]);
  const sql = getFunctionSql(
    migration,
    "set_partner_billing_profile_default",
  );
  const accountLock = sql.indexOf("from public.partner_accounts");
  const targetLock = sql.indexOf("from public.partner_billing_profiles");
  const clearPreviousDefault = sql.indexOf("set is_default = false");
  const setNextDefault = sql.indexOf("set is_default = true");

  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = pg_catalog, public/i);
  assert.ok(accountLock >= 0, "account row lock must exist");
  assert.ok(targetLock > accountLock, "target lookup must follow the account lock");
  assert.ok(
    clearPreviousDefault > targetLock,
    "the target must be validated before clearing the current default",
  );
  assert.ok(
    setNextDefault > clearPreviousDefault,
    "the replacement must happen in the same RPC after clearing the previous default",
  );
  assert.match(sql.slice(accountLock, targetLock), /for update;/i);
  assert.match(sql.slice(targetLock, clearPreviousDefault), /for update;/i);
  assert.match(
    sql.slice(setNextDefault),
    /if not found then[\s\S]*partner_billing_profile_default_state_conflict/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.set_partner_billing_profile_default\(uuid, uuid, uuid\) to service_role;/i,
  );
  assert.ok(schema.includes(migration.trim()));

  const functionStart = source.indexOf(
    "export async function setDefaultPartnerBillingProfile",
  );
  const functionEnd = source.indexOf(
    "export async function archivePartnerBillingProfile",
    functionStart,
  );
  const serviceFunction = source.slice(functionStart, functionEnd);
  assert.match(
    serviceFunction,
    /\.rpc\(\s*"set_partner_billing_profile_default"/i,
  );
  assert.doesNotMatch(
    serviceFunction,
    /\.from\("partner_billing_profiles"\)[\s\S]*\.update/,
  );
  assert.match(
    serviceFunction,
    /기존 파트너사 정보는 기본값으로 지정할 수 없습니다\. 새 프로필로 저장해 주세요\./,
  );
});

test("청구 프로필 생성도 기본값 해제와 삽입을 같은 계정 잠금 안에서 처리한다", async () => {
  const [migration, source] = await Promise.all([
    migrationPromise,
    sourcePromise,
  ]);
  const sql = getFunctionSql(
    migration,
    "create_partner_billing_profile_atomically",
  );
  const accountLock = sql.indexOf("from public.partner_accounts");
  const clearPreviousDefault = sql.indexOf("set is_default = false");
  const insertProfile = sql.indexOf(
    "insert into public.partner_billing_profiles",
  );

  assert.match(sql, /returns jsonb/i);
  assert.match(sql, /security definer/i);
  assert.match(sql.slice(accountLock, clearPreviousDefault), /for update;/i);
  assert.ok(
    clearPreviousDefault > accountLock && insertProfile > clearPreviousDefault,
    "account lock, old default reset, and insert must stay in one RPC",
  );
  assert.match(
    migration,
    /grant execute on function public\.create_partner_billing_profile_atomically\([\s\S]*?\) to service_role;/i,
  );

  const functionStart = source.indexOf(
    "export async function createPartnerBillingProfile",
  );
  const functionEnd = source.indexOf(
    "async function getAccessibleProfile",
    functionStart,
  );
  const serviceFunction = source.slice(functionStart, functionEnd);
  assert.match(
    serviceFunction,
    /\.rpc\(\s*"create_partner_billing_profile_atomically"/i,
  );
  assert.doesNotMatch(
    serviceFunction,
    /unsetOtherDefaultProfiles|\.from\("partner_billing_profiles"\)[\s\S]*\.insert/,
  );
});

test("mock 기본 프로필 전환도 실패 전 상태를 보존하고 동시 요청 후 하나만 남긴다", async () => {
  resetMockBillingProfiles();
  const {
    createPartnerBillingProfile,
    getPartnerBillingProfiles,
    setDefaultPartnerBillingProfile,
  } = await billingProfilesModulePromise;
  const accountId = "mock-partner-account-cafe-ssafy";
  const companyId = "mock-partner-company-cafe-ssafy";
  const createProfile = (
    label: string,
    email: string,
    isDefault = false,
  ) =>
    createPartnerBillingProfile({
      accountId,
      companyId,
      form: {
        label,
        payerName: "카페싸피",
        businessRegistrationNumber: "2208162517",
        businessName: "카페싸피",
        representativeName: "김도연",
        businessAddress: "서울 강남구 테헤란로 212",
        businessType: "음식점업",
        businessItem: "커피",
        taxInvoiceEmail: email,
        isDefault,
      },
    });
  const first = await createProfile("본점", "tax-main@example.com");
  const second = await createProfile("별관", "tax-annex@example.com");

  await setDefaultPartnerBillingProfile({
    accountId,
    companyId,
    profileId: first.id,
  });
  await assert.rejects(
    setDefaultPartnerBillingProfile({
      accountId,
      companyId,
      profileId: "missing-profile",
    }),
    /프로필을 찾을 수 없습니다\./,
  );
  let profiles = await getPartnerBillingProfiles({ accountId, companyId });
  assert.deepEqual(
    profiles.filter((profile) => profile.isDefault).map((profile) => profile.id),
    [first.id],
  );

  await Promise.all([
    setDefaultPartnerBillingProfile({
      accountId,
      companyId,
      profileId: first.id,
    }),
    setDefaultPartnerBillingProfile({
      accountId,
      companyId,
      profileId: second.id,
    }),
  ]);

  profiles = await getPartnerBillingProfiles({ accountId, companyId });
  const defaults = profiles.filter((profile) => profile.isDefault);
  assert.equal(defaults.length, 1);
  assert.ok(defaults[0]?.id === first.id || defaults[0]?.id === second.id);

  await Promise.all([
    createProfile("동시 기본 1", "tax-concurrent-1@example.com", true),
    createProfile("동시 기본 2", "tax-concurrent-2@example.com", true),
  ]);
  profiles = await getPartnerBillingProfiles({ accountId, companyId });
  assert.equal(profiles.filter((profile) => profile.isDefault).length, 1);
});
