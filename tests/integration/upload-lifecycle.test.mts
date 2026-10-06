import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPostgres } from "../support/isolated-postgres.mts";

const db = isolatedPostgres("ssartnership-upload-lifecycle");
const member = "10000000-0000-4000-8000-000000000001";
const partner = "20000000-0000-4000-8000-000000000001";
const review = "30000000-0000-4000-8000-000000000001";
const upload = "40000000-0000-4000-8000-000000000001";
const upload2 = "40000000-0000-4000-8000-000000000002";
const url = "https://fixture.test/review.webp";
const url2 = "https://fixture.test/other.webp";
const claim = (limit = 100) => `select id,previous_status from claim_image_upload_cleanup(p_limit=>${limit})`;
const discard = (id = upload, purpose = "review", owner = "member") =>
  `select id from claim_image_upload_cleanup('${id}','${owner}','${member}','${purpose}',true,100)`;
const insertReview = (urls = [url], id = review) => `insert into partner_reviews(id,member_id,partner_id,images) values('${id}','${member}','${partner}',array[${urls.map((u)=>`'${u}'`).join(",")}])`;
const session = (id = upload, finalUrl = url) => `insert into image_upload_sessions(id,owner_kind,owner_id,purpose,role,storage_path,final_bucket,final_path,final_url,status,attached_resource_type,attached_resource_id)
  values('${id}','member','${member}','review','image','${id}/staging.webp','review-media','${id}.webp','${finalUrl}','attached','partner_review','${review}')`;

before(async () => {
  await db.start(); db.sql(await readFile(new URL("../fixtures/upload-lifecycle.sql", import.meta.url), "utf8"));
  if (process.env.TEST_UPLOAD_SQL_PATH) {
    db.sql(await readFile(process.env.TEST_UPLOAD_SQL_PATH, "utf8")); return;
  }
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).sort().reverse()) {
    const text = await readFile(new URL(name, dir), "utf8");
    if (text.includes("create or replace function public.claim_image_upload_cleanup(")) {
      db.sql(text.split("-- BEGIN UPLOAD LIFECYCLE")[1].split("-- END UPLOAD LIFECYCLE")[0]); return;
    }
  }
  throw new Error("Missing upload lifecycle migration");
});
after(() => db.stop());
beforeEach(() => db.sql("truncate partner_reviews,member_signup_approval_requests,member_profile_images,image_upload_sessions"));

test("only an owned, attached, unexpired exact review resource can introduce an image", () => {
  assert.throws(() => db.sql(insertReview()), /review_image_reference_invalid/);
  db.sql(session());
  for (const wrong of ["owner_id='other'", "role='profile'", "status='failed'", "attached_resource_id='other'", "attached_resource_type='other'", "final_bucket='other'", "final_path=null", "expires_at=now()-interval '1 second'"]) {
    db.sql("begin; " + `update image_upload_sessions set ${wrong} where id='${upload}';` + " rollback;");
    assert.throws(() => db.sql("begin; " + `update image_upload_sessions set ${wrong} where id='${upload}';` + insertReview() + "; commit"), /review_image_reference_invalid/);
  }
  db.sql(insertReview()); assert.equal(db.sql("select count(*) from partner_reviews"), "1");
});

test("unchanged historic, expired, soft-deleted and hidden references remain protected", () => {
  db.sql("alter table partner_reviews disable trigger partner_reviews_validate_image_references");
  db.sql(insertReview(["https://legacy.test/image.webp"]));
  db.sql("alter table partner_reviews enable trigger partner_reviews_validate_image_references");
  db.sql("update partner_reviews set images=images,is_public=false,deleted_at=now()");
  assert.throws(() => db.sql(`update partner_reviews set images=images||array['${url}']`), /review_image_reference_invalid/);
  db.sql("truncate partner_reviews"); db.sql(session()); db.sql(insertReview());
  db.sql("update partner_reviews set is_public=false,deleted_at=now(); update image_upload_sessions set expires_at=now()-interval '1 hour'");
  db.sql("update partner_reviews set images=images");
  assert.equal(db.sql(claim()), ""); assert.equal(db.sql(discard()), "");
});

test("anonymization preserves existing review media without allowing new or transferred references", () => {
  db.sql(session()); db.sql(insertReview());
  db.sql("update partner_reviews set member_id=null");
  db.sql("update partner_reviews set images=images");
  db.sql("update image_upload_sessions set expires_at=now()-interval '1 hour'");
  assert.equal(db.sql(claim()), "");
  assert.throws(() => db.sql(`update partner_reviews set images=images||array['${url2}']`), /review_image_reference_invalid/);
  assert.throws(() => db.sql(`update partner_reviews set member_id='10000000-0000-4000-8000-000000000002'`), /review_image_reference_invalid/);
});

test("review insert locking first prevents cleanup; cleanup locking first rejects insert", async () => {
  db.sql(session());
  const writer = await db.transaction(insertReview());
  try { assert.equal(db.sql(discard()), ""); } finally { await writer.finish(); }
  assert.equal(db.sql(discard()), "");
  db.sql("truncate partner_reviews");
  const collector = await db.transaction(discard());
  const contender = db.concurrent(insertReview());
  try { await db.waitForLock(); } finally { await collector.finish(); }
  assert.match((await contender).errors, /review_image_reference_invalid/);
  assert.equal(db.sql("select count(*) from partner_reviews"), "0");
});

test("review UPDATE vs cleanup serializes without locking the review from the collector", async () => {
  db.sql(session()); db.sql(session(upload2,url2)); db.sql(insertReview());
  const writer = await db.transaction(`update partner_reviews set images=array['${url}','${url2}'] where id='${review}'`);
  try { assert.equal(db.sql(discard(upload2)), ""); } finally { await writer.finish(); }
  assert.equal(db.sql(discard(upload2)), "");
  db.sql(`update partner_reviews set images=array['${url}']`);
  const collector = await db.transaction(discard(upload2));
  const contender = db.concurrent(`update partner_reviews set images=array['${url}','${url2}'] where id='${review}'`);
  try { await db.waitForLock(); } finally { await collector.finish(); }
  assert.match((await contender).errors, /review_image_reference_invalid/);
  assert.equal(db.sql("select array_length(images,1) from partner_reviews"), "1");
});

test("claim rechecks a previously stale attaching candidate and only expires genuinely unbound rows", async () => {
  db.sql(session()); db.sql("update image_upload_sessions set status='attaching',expires_at=now()-interval '1 hour'");
  const attachment = await db.transaction("update image_upload_sessions set status='attached',expires_at=now()+interval '1 hour'" );
  try { assert.equal(db.sql(claim()), ""); } finally { await attachment.finish(); }
  db.sql(insertReview()); assert.equal(db.sql(claim()), "");
  db.sql(session(upload2,url2)); db.sql(`update image_upload_sessions set status='ready',purpose='partner',expires_at=now()-interval '1 hour' where id='${upload2}'`);
  assert.match(db.sql(claim()), new RegExp(upload2));
  assert.equal(db.sql(`select status from image_upload_sessions where id='${upload}'`), "attached");
});

test("signup references race with cleanup at the same session, and retained pending/approved requests protect bytes", async () => {
  db.sql(session()); db.sql("update image_upload_sessions set purpose='member-signup-profile',owner_kind='signup',role='profile',status='ready'");
  const insert = `insert into member_signup_approval_requests(id,profile_image_upload_id) values('${review}','${upload}')`;
  const writer = await db.transaction(insert);
  try { assert.equal(db.sql(discard(upload,"member-signup-profile","signup")), ""); } finally { await writer.finish(); }
  db.sql("update image_upload_sessions set expires_at=now()-interval '1 hour'");
  assert.equal(db.sql(claim()), "");
  db.sql("update member_signup_approval_requests set status='approved'"); assert.equal(db.sql(claim()), "");
  db.sql("truncate member_signup_approval_requests");
  const collector = await db.transaction(discard(upload,"member-signup-profile","signup"));
  const contender = db.concurrent(insert);
  try { await db.waitForLock(); } finally { await collector.finish(); }
  assert.match((await contender).errors, /signup_image_reference_invalid/);
});

test("canonical profile ledger protects its file even after its signup request is gone", async () => {
  db.sql(session()); db.sql("update image_upload_sessions set purpose='member-signup-profile',owner_kind='signup',role='profile',final_bucket='member-profile-images'");
  const insert = `insert into member_profile_images(id,member_id,storage_path) values('${review}','${member}','${upload}.webp')`;
  const writer = await db.transaction(insert);
  try { assert.equal(db.sql(discard(upload,"member-signup-profile","signup")), ""); } finally { await writer.finish(); }
  assert.equal(db.sql(discard(upload,"member-signup-profile","signup")), "");
  db.sql("delete from member_profile_images");
  const collector = await db.transaction(discard(upload,"member-signup-profile","signup"));
  const contender = db.concurrent(insert);
  try { await db.waitForLock(); } finally { await collector.finish(); }
  assert.match((await contender).errors, /profile_image_upload_reference_invalid/);
});

test("retired review paths stay fenced, reconcile late writes, and rotate under tiny batches", () => {
  db.sql(session()); db.sql(session(upload2,url2)); db.sql("update image_upload_sessions set expires_at=now()-interval '1 hour'");
  const first = db.sql(claim(1)).split("|")[0]; assert.ok(first);
  const second = db.sql(claim(1)).split("|")[0]; assert.notEqual(second,first);
  // Reconciliation is eligible after the existing hourly sweep interval.
  db.sql("alter table image_upload_sessions disable trigger image_upload_sessions_set_updated_at");
  db.sql(`update image_upload_sessions set status='expired',failure_code='review_cleanup_tombstone',updated_at=now()-interval '2 hours' where id='${first}'`);
  db.sql("alter table image_upload_sessions enable trigger image_upload_sessions_set_updated_at");
  assert.equal(db.sql(claim(1)), `${first}|expired`);
  // A failed storage re-sweep leaves its tombstone identity intact on retry.
  assert.equal(db.sql(`select previous_status from claim_image_upload_cleanup('${first}','member','${member}','review',true,100)`), "expired");
  assert.equal(db.sql(`select failure_code from image_upload_sessions where id='${first}'`), "review_cleanup_tombstone");
  assert.throws(() => db.sql(insertReview()), /review_image_reference_invalid/);
});

test("retired non-review uploads, including no final path, reconcile late objects without changing attached retention", () => {
  db.sql(session()); db.sql(session(upload2,url2));
  db.sql("update image_upload_sessions set purpose='partner',expires_at=now()-interval '1 hour'");
  assert.equal(db.sql(claim()), ""); // An attached non-review resource stays retained.
  db.sql(`update image_upload_sessions set status='processing',final_bucket=null,final_path=null,final_url=null where id='${upload}'`);
  assert.equal(db.sql(claim()), `${upload}|processing`);
  db.sql("alter table image_upload_sessions disable trigger image_upload_sessions_set_updated_at");
  db.sql(`update image_upload_sessions set status='expired',failure_code='image_cleanup_tombstone',updated_at=now()-interval '2 hours' where id='${upload}'`);
  db.sql("alter table image_upload_sessions enable trigger image_upload_sessions_set_updated_at");
  assert.equal(db.sql(claim()), `${upload}|expired`);
  assert.equal(db.sql(claim()), `${upload}|expired`); // Failed re-sweep preserves the original expiry.
  assert.equal(db.sql(`select failure_code from image_upload_sessions where id='${upload}'`), "image_cleanup_tombstone");
  assert.equal(db.sql(`select status from image_upload_sessions where id='${upload2}'`), "attached");
});

test("referenced rows and failed cleanup retries cannot starve new due claims", () => {
  db.sql(session()); db.sql(insertReview()); db.sql(session(upload2,url2));
  db.sql("update image_upload_sessions set expires_at=now()-interval '1 hour'");
  assert.equal(db.sql(claim(1)), `${upload2}|attached`);
  assert.equal(db.sql(`select failure_code from image_upload_sessions where id='${upload}'`), "");
});

test("large retired queues use the ordered partial index under a generic plan and retain bounded lane progress", async () => {
  db.sql(`insert into image_upload_sessions(id,owner_kind,owner_id,purpose,role,storage_path,status,failure_code,updated_at)
    select md5(n::text)::uuid,'member','${member}','partner','image',n::text,'expired','image_cleanup_tombstone',now()-interval '2 hours'
    from generate_series(1,5000) n; analyze image_upload_sessions`);
  const result = await db.concurrent(`load 'auto_explain';
    set auto_explain.log_min_duration=0; set auto_explain.log_nested_statements=on;
    set auto_explain.log_format=json; set auto_explain.log_analyze=on;
    set auto_explain.log_level=notice; set client_min_messages=notice;
    set plan_cache_mode=force_generic_plan; ${claim(100)}`);
  assert.equal(result.code, 0, result.errors);
  assert.match(result.errors, /"Index Name": "image_upload_sessions_cleanup_tombstone_rotation_idx"/);
  assert.equal(result.output.split("\n").length, 33);
  assert.equal(db.sql("select count(*) from image_upload_sessions where status='expired'"), "4967");
});

test("opposite multi-image manifests and duplicate IDs converge without a lock-order deadlock", async () => {
  db.sql(session()); db.sql(session(upload2,url2));
  const first = await db.transaction(insertReview([url,url2]));
  const second = db.concurrent(insertReview([url2,url]));
  try { await db.waitForLock(); } finally { await first.finish(); }
  assert.match((await second).errors, /duplicate key/);
  assert.equal(db.sql("select count(*) from partner_reviews"), "1");
  assert.equal(db.sql(discard(upload)), ""); assert.equal(db.sql(discard(upload2)), "");
});

test("duplicate create with a different manifest retains the winner and only collects the loser orphan", async () => {
  db.sql(session()); db.sql(session(upload2,url2));
  const first = await db.transaction(insertReview([url]));
  const second = db.concurrent(insertReview([url2]));
  try { await db.waitForLock(); assert.equal(db.sql(discard(upload2)), ""); } finally { await first.finish(); }
  assert.match((await second).errors, /duplicate key/);
  db.sql("update image_upload_sessions set expires_at=now()-interval '1 hour'");
  assert.equal(db.sql(claim()), `${upload2}|attached`);
  assert.equal(db.sql(`select status from image_upload_sessions where id='${upload}'`), "attached");
});

test("unsupported isolation, invalid owner/limit and anonymous calls fail closed", () => {
  db.sql(session());
  assert.throws(() => db.sql("begin isolation level repeatable read; " + claim()), /image_cleanup_isolation_unsupported/);
  assert.throws(() => db.sql("begin isolation level repeatable read; " + insertReview()), /review_image_isolation_unsupported/);
  assert.throws(() => db.sql("select * from claim_image_upload_cleanup(p_upload_id=>'"+upload+"')"), /image_cleanup_owner_required/);
  assert.throws(() => db.sql(claim(101)), /image_cleanup_parameters_invalid/);
  assert.equal(db.sql(discard(upload,"review","admin")), "");
  for (const role of ["anon","authenticated"]) assert.throws(() => db.sql(`set role ${role}; ${claim()}`), /permission denied/);
  assert.equal(db.sql(`set role service_role; ${discard()}`),upload);
});
