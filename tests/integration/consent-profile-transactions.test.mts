import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPostgres } from "../support/isolated-postgres.mts";

const db = isolatedPostgres("ssartnership-consent-profile");
const member = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const policy = "70000000-0000-4000-8000-000000000001";
const nextPolicy = "70000000-0000-4000-8000-000000000002";
const oldImage = "80000000-0000-4000-8000-000000000001";
const target = "80000000-0000-4000-8000-000000000002";
const another = "80000000-0000-4000-8000-000000000003";
const patch = (marketing = "null", evidence = "null,null", mm = "null") =>
  `select * from patch_member_notification_preferences_atomic('${member}',null,null,null,null,null,${mm},${marketing},'fixture-ip','fixture-agent',${evidence})`;
const activate = (image = target, actor = member) => `select activate_member_profile_image_atomic('${actor}','${image}')`;
const admin = () => `select approve_member_profile_image_replacement('${another}','${other}')`;
const reject = () => `select reject_member_profile_image_replacement('${another}','${other}','fixture rejection')`;
const evidence = `'${policy}',1`;

before(async () => {
  await db.start();
  db.sql(await readFile(new URL("../fixtures/consent-profile-transactions.sql", import.meta.url), "utf8"));
  db.sql(await readFile(new URL("../../supabase/migrations/20260713205041_harden_member_profile_image_transition_search_path.sql", import.meta.url), "utf8"));
  db.sql("create trigger image_transition before update on member_profile_images for each row execute function public.enforce_member_profile_image_status_transition()");
  const legacyProfile = await readFile(new URL("../../supabase/migrations/20260713204059_contract_member_domain_legacy_columns.sql", import.meta.url), "utf8");
  db.sql("create or replace function public.reject_member_profile_image_replacement(" + legacyProfile.split("create or replace function public.reject_member_profile_image_replacement(")[1].split("create or replace function public.reject_member_active_profile_photo(")[0]);
  const sqlPath = process.env.TEST_INTEGRITY_SQL_PATH;
  if (!sqlPath) {
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    const files = (await readdir(dir)).sort().reverse();
    for (const file of files) {
      const sql = await readFile(new URL(file, dir), "utf8");
      if (sql.includes("create or replace function public.patch_member_notification_preferences_atomic(")) {
        // Load only this work unit from the coordinated migration if it has other RPCs.
        db.sql(sql.split("-- END CONSENT PROFILE TRANSACTIONS")[0]);
        return;
      }
    }
    throw new Error("No consent/profile migration found");
  }
  db.sql(await readFile(sqlPath, "utf8"));
});
after(() => db.stop());
beforeEach(() => {
  db.sql(`truncate member_policy_consents,push_preferences,push_subscriptions,policy_documents,member_profile_images,admin_profiles,members;
    insert into members(id) values('${member}'),('${other}');
    insert into policy_documents values('${policy}','marketing',1,true),('${nextPolicy}','marketing',2,false);
    insert into admin_profiles values('90000000-0000-4000-8000-000000000001','${other}',true);
    insert into member_profile_images(id,member_id,source,status,storage_path) values
      ('${oldImage}','${member}','mattermost','approved','old.webp'),
      ('${target}','${member}','mattermost','pending','target.webp'),
      ('${another}','${member}','manual_admin','pending','admin.webp');`);
});
const consentSnapshot = () => db.sql("select row_to_json(c) from member_policy_consents c");
const photoSnapshot = () => db.sql("select json_agg(i order by id) from member_profile_images i");

// These execute real PostgreSQL, not a textual/source approximation.
test("explicit current policy opt-in, retry, unrelated patch and withdrawal preserve evidence", () => {
  db.sql(patch("true", evidence)); const before = consentSnapshot();
  db.sql(patch("true", evidence)); assert.equal(consentSnapshot(), before);
  db.sql(patch("null", "null,null", "false")); assert.equal(consentSnapshot(), before);
  db.sql(patch("false")); assert.equal(consentSnapshot(), before);
  db.sql(patch("null", "null,null", "true"));
  assert.equal(db.sql(`select marketing_enabled from push_preferences where member_id='${member}'`), "f");
  assert.equal(consentSnapshot(), before);
  db.sql(patch("true", evidence)); assert.notEqual(consentSnapshot(), before);
});

test("reviewed version and legacy signature fail closed before changing preference state", () => {
  for (const statement of [patch("true"), patch("true", `'${policy}',2`), patch("true", `'${nextPolicy}',2`),
    `select * from update_member_push_preferences_atomic('${member}',null,null,null,null,null,false,true,null,null)`]) {
    assert.throws(() => db.sql(statement), /marketing_policy_(confirmation_required|changed)/);
    assert.equal(db.sql("select count(*) from push_preferences"), "0");
    assert.equal(db.sql("select count(*) from member_policy_consents"), "0");
  }
  db.sql(`select * from update_member_push_preferences_atomic('${member}',null,null,null,null,null,false,false,null,null)`);
});

test("new active policy is never manufactured by an unrelated preference change", () => {
  db.sql(patch("true", evidence)); const before = consentSnapshot();
  db.sql(`update policy_documents set is_active=false; update policy_documents set is_active=true where id='${nextPolicy}'`);
  assert.equal(db.sql(patch("null", "null,null", "false")).split("|").at(-1), "f");
  assert.equal(consentSnapshot(), before);
});

test("both marketing writes roll back when either mutation fails", () => {
  for (const table of ["push_preferences", "member_policy_consents"]) {
    db.sql(`create function inject_failure() returns trigger language plpgsql as $$ begin raise exception 'injected_failure'; end $$;
      create trigger injected before insert or update on ${table} for each row execute function inject_failure()`);
    try {
      assert.throws(() => db.sql(patch("true", evidence)), /injected_failure/);
      assert.equal(db.sql("select count(*) from push_preferences"), "0");
      assert.equal(db.sql("select count(*) from member_policy_consents"), "0");
    } finally { db.sql(`drop trigger injected on ${table}; drop function inject_failure()`); }
  }
});

test("withdrawal and stale unrelated changes serialize without resurrection", async () => {
  db.sql(patch("true", evidence)); const before = consentSnapshot();
  const holder = await db.transaction(patch("false"));
  const contender = db.concurrent(patch("null", "null,null", "false"));
  try { await db.waitForLock(); } finally { await holder.finish(); }
  assert.equal((await contender).code, 0);
  assert.equal(db.sql("select marketing_enabled from push_preferences"), "f");
  assert.equal(consentSnapshot(), before);
});

test("registration and final-device removal intents cannot restore a committed withdrawal", async () => {
  for (const enabled of [true, false]) {
    db.sql(patch("true", evidence)); const before = consentSnapshot();
    const holder = await db.transaction(patch("false"));
    const contender = db.concurrent(`select * from patch_member_notification_preferences_atomic('${member}',${enabled},${enabled ? "true,true,true,true" : "null,null,null,null"},null,null,null,null,null,null)`);
    try { await db.waitForLock(); } finally { await holder.finish(); }
    assert.equal((await contender).code, 0);
    assert.equal(db.sql("select marketing_enabled from push_preferences"), "f");
    assert.equal(consentSnapshot(), before);
  }
});

test("admin approval and rejection both lock member before target, with safe loser revalidation", async () => {
  for (const first of ["approve", "reject"] as const) {
    const holder = await db.transaction(`select 1 from members where id='${member}' for update`);
    const contender = db.concurrent(first === "approve" ? reject() : admin());
    await db.waitForLock();
    await holder.finish(`${first === "approve" ? admin() : reject()}; commit`);
    const result = await contender;
    assert.match(result.errors, /profile_image_not_reviewable/);
    assert.doesNotMatch(result.errors, /deadlock/);
    assert.equal(db.sql(`select status from member_profile_images where id='${another}'`), first === "approve" ? "approved" : "rejected");
    if (first === "approve") {
      db.sql("alter table member_profile_images disable trigger image_transition");
      db.sql(`update member_profile_images set status='pending' where id='${another}'; update member_profile_images set status='approved' where id='${oldImage}'`);
      db.sql("alter table member_profile_images enable trigger image_transition");
    }
  }
});

test("policy activation committed first rejects a waiting stale opt-in", async () => {
  const holder = await db.transaction(`update policy_documents set is_active=false where id='${policy}'; update policy_documents set is_active=true where id='${nextPolicy}'`);
  const contender = db.concurrent(patch("true", evidence));
  try { await db.waitForLock(); } finally { await holder.finish(); }
  assert.match((await contender).errors, /marketing_policy_changed/);
  assert.equal(db.sql("select count(*) from member_policy_consents"), "0");
});

test("opt-in row lock holds activation until consent is committed", async () => {
  const holder = await db.transaction(patch("true", evidence));
  const contender = db.concurrent(`update policy_documents set is_active=false where id='${policy}'`);
  try { await db.waitForLock(); } finally { await holder.finish(); }
  assert.equal((await contender).code, 0);
  assert.equal(db.sql("select version from member_policy_consents"), "1");
});

test("promotion is atomic, same approved target is idempotent, superseded retry is rejected", () => {
  assert.equal(db.sql(activate()), "t"); const before = photoSnapshot();
  db.sql(activate()); assert.equal(photoSnapshot(), before);
  assert.throws(() => db.sql(activate(oldImage)), /profile_image_not_activatable/);
  assert.equal(db.sql("select count(*) from member_profile_images where status='approved'"), "1");
});

test("invalid owner, deleted member/image, review source and terminal state cannot replace old photo", () => {
  for (const change of ["member_id='" + other + "'", "deleted_at=now()", "source='member_upload'", "source='graduate_verification'", "graduate_verification_request_id='" + other + "'", "status='rejected'", "status='superseded'"]) {
    db.sql("alter table member_profile_images disable trigger image_transition");
    db.sql(`update member_profile_images set member_id='${member}',deleted_at=null,source='mattermost',graduate_verification_request_id=null,status='pending' where id='${target}'; update member_profile_images set ${change} where id='${target}'`);
    db.sql("alter table member_profile_images enable trigger image_transition");
    const before = photoSnapshot(); assert.throws(() => db.sql(activate()), /profile_image_not_activatable/);
    assert.equal(photoSnapshot(), before);
  }
  db.sql(`update members set deleted_at=now() where id='${member}'`);
  assert.throws(() => db.sql(activate()), /profile_image_member_missing/);
  assert.equal(db.sql(`select status from member_profile_images where id='${oldImage}'`), "approved");
});

test("failure at each of the three promotion writes preserves the canonical approved photo", () => {
  for (const [table, condition] of [["member_profile_images", "new.status = 'superseded'"], ["member_profile_images", "new.status = 'approved'"], ["members", "true"]]) {
    const before = photoSnapshot();
    db.sql(`create function inject_failure() returns trigger language plpgsql as $$ begin if ${condition} then raise exception 'injected_failure'; end if; return new; end $$;
      create trigger injected before update on ${table} for each row execute function inject_failure()`);
    try {
      assert.throws(() => db.sql(activate()), /injected_failure/);
      assert.equal(photoSnapshot(), before);
    } finally { db.sql(`drop trigger injected on ${table}; drop function inject_failure()`); }
  }
});

test("two automatic promotions and auto/admin promotions serialize on the member", async () => {
  for (const automatic of [true, false]) {
    if (automatic) db.sql(`update member_profile_images set source='mattermost' where id='${another}'`);
    const holder = await db.transaction(activate());
    const contender = db.concurrent(automatic ? activate(another) : admin());
    try { await db.waitForLock(); } finally { await holder.finish(); }
    assert.equal((await contender).code, 0);
    assert.equal(db.sql("select id from member_profile_images where status='approved'"), another);
    if (automatic) {
      // Reset only the synthetic state for the second lock-order case.
      db.sql("alter table member_profile_images disable trigger image_transition");
      db.sql(`update member_profile_images set status='pending'; update member_profile_images set source='manual_admin' where id='${another}'; update member_profile_images set status='approved' where id='${oldImage}'`);
      db.sql("alter table member_profile_images enable trigger image_transition");
    }
  }
});

test("admin-first overlap and unauthorized review cannot bypass the review boundary", async () => {
  const holder = await db.transaction(admin()); const contender = db.concurrent(activate());
  try { await db.waitForLock(); } finally { await holder.finish(); }
  assert.equal((await contender).code, 0);
  assert.equal(db.sql("select id from member_profile_images where status='approved'"), target);
  db.sql(`update admin_profiles set is_active=false; insert into member_profile_images(id,member_id,source,status,storage_path) values('80000000-0000-4000-8000-000000000004','${member}','member_upload','pending','manual.webp')`);
  assert.throws(() => db.sql(`select approve_member_profile_image_replacement('80000000-0000-4000-8000-000000000004','${other}')`), /profile_image_admin_profile_missing/);
  assert.throws(() => db.sql(`select reject_member_profile_image_replacement('80000000-0000-4000-8000-000000000004','${other}','reason')`), /profile_image_admin_profile_missing/);
  db.sql("update admin_profiles set is_active=true");
  assert.throws(() => db.sql(`select reject_member_profile_image_replacement('80000000-0000-4000-8000-000000000004','${other}',' ')`), /profile_image_rejection_reason_invalid/);
  assert.equal(db.sql("select status from member_profile_images where id='80000000-0000-4000-8000-000000000004'"), "pending");
});

test("only service_role can call new and compatibility RPCs", () => {
  for (const role of ["anon", "authenticated"]) {
    for (const statement of [patch("false"), activate(), admin(), reject(), `select * from update_member_push_preferences_atomic('${member}',null,null,null,null,null,false,false,null,null)`]) {
      assert.throws(() => db.sql(`set role ${role}; ${statement}`), /permission denied/);
    }
  }
  assert.equal(db.sql(`set role service_role; ${activate()}`), "t");
});
