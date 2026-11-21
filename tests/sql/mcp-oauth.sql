-- Destructive test fixtures: run ONLY against a disposable, network-isolated clone.
-- All fixture mutations roll back. Output contains assertion labels/counts only.
\set ON_ERROR_STOP on
begin;
set local client_min_messages = error;
do $$ begin
  if current_setting('ssartnership.isolated_rehearsal',true) is distinct from 'mcp-602-disposable'
    or current_setting('listen_addresses') <> '' then
    raise exception 'mcp_test_disposable_clone_required';
  end if;
end $$;
create temporary table mcp_checks(label text primary key);
create function pg_temp.check_mcp(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'mcp_test_%', label; end if;
  insert into mcp_checks values (label);
end;
$$;
create temporary table mcp_fixture as
select p.member_id admin_id, m.mattermost_account_id directory_id,
  p.permission_template_key original_template,
  gen_random_uuid() client_id, gen_random_uuid() grant_id, gen_random_uuid() event_id,
  gen_random_uuid() project_id, gen_random_uuid() feedback_id, gen_random_uuid() review_id,
  (extract(epoch from now())*1000)::bigint + 86400000 expires_ms
from public.admin_profiles p join public.members m on m.id=p.member_id
where m.mattermost_account_id is not null limit 1;
select pg_temp.check_mcp((select count(*)=1 from mcp_fixture),'fixture_admin_available');
update public.admin_profiles p set is_active=true,permission_template_key='operations_manager'
from mcp_fixture f where p.member_id=f.admin_id;
update public.members m set must_change_password=false,deleted_at=null from mcp_fixture f where m.id=f.admin_id;
update public.mm_user_directory d set is_active=true from mcp_fixture f where d.id=f.directory_id;
insert into public.showcase_events(id,slug,title) select event_id,'mcp-isolated-'||replace(event_id::text,'-',''),'MCP isolated fixture' from mcp_fixture;
insert into public.showcase_projects(id,event_id,project_type,title,summary,description,image_url,service_url,announcement_consented_at)
select project_id,event_id,'web','MCP isolated fixture','Synthetic test fixture','Synthetic isolated database fixture only.','/mcp-fixture.png','https://example.invalid',now() from mcp_fixture;
insert into public.showcase_feedback(id,event_id,project_id,body)
select feedback_id,event_id,project_id,'Synthetic isolated review fixture.' from mcp_fixture;
insert into public.mcp_oauth_clients(id,value) select client_id,jsonb_build_object('id',client_id,'name','isolated test','redirectUri','https://client.example.invalid/callback','createdBy',admin_id) from mcp_fixture;
create temporary table mcp_tokens as select
  jsonb_build_object('id',f.grant_id,'adminId',f.admin_id,'permissionVersion',p.permission_version,'clientId',f.client_id,'scopes',jsonb_build_array('catalog:read','showcase:moderate'),'resource','https://mcp.example.invalid/api/mcp','createdAt',f.expires_ms-86400000,'expiresAt',f.expires_ms) g,
  jsonb_build_object('kind','code','hash',repeat('1',64),'grantId',f.grant_id,'expiresAt',f.expires_ms,'redirectUri','https://client.example.invalid/callback','challenge',repeat('A',43)) c
from mcp_fixture f join public.admin_profiles p on p.member_id=f.admin_id;
create function pg_temp.exchange_mcp(kind text, digest text, access_digest text, refresh_digest text) returns jsonb language sql as $$
select jsonb_build_object('kind',kind,'hash',digest,'clientId',f.client_id,'resource','https://mcp.example.invalid/api/mcp','redirectUri','https://client.example.invalid/callback','challenge',repeat('A',43),
'access',jsonb_build_object('kind','access','hash',access_digest,'grantId',f.grant_id,'expiresAt',f.expires_ms-80000000),
'refresh',jsonb_build_object('kind','refresh','hash',refresh_digest,'grantId',f.grant_id,'expiresAt',f.expires_ms)) from mcp_fixture f;
$$;
create function pg_temp.commit_mcp() returns text language sql as $$
select public.mcp_commit_review(admin_id,grant_id,client_id,review_id) from mcp_fixture;
$$;
create function pg_temp.review_mcp() returns void language sql as $$
insert into public.mcp_oauth_records(key,value,expires_at)
select 'review:'||f.review_id,jsonb_build_object('id',f.review_id,'adminId',f.admin_id,'grantId',f.grant_id,'clientId',f.client_id,'feedbackId',f.feedback_id,'previousHidden',false,'previousBodyHash',encode(sha256(convert_to('Synthetic isolated review fixture.','UTF8')),'hex'),'hidden',true,'approved',false,'executed',false),now()+interval '5 minutes' from mcp_fixture f
on conflict(key) do update set value=excluded.value,expires_at=excluded.expires_at;
$$;
-- Roles cannot bypass application authorization by calling storage or RPCs.
do $$ declare t text; r text; op text; sig text; begin
foreach t in array array['mcp_oauth_clients','mcp_oauth_records'] loop
  perform pg_temp.check_mcp((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),'rls_'||t);
  foreach r in array array['anon','authenticated'] loop
    foreach op in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      perform pg_temp.check_mcp(not has_table_privilege(r,'public.'||t,op),'acl_'||t||'_'||r||'_'||lower(op));
    end loop;
  end loop;
end loop;
foreach sig in array array['mcp_create_grant(jsonb,jsonb)','mcp_exchange_credential(jsonb)','mcp_revoke_grant(uuid,uuid)','mcp_approve_review(uuid,uuid)','mcp_commit_review(uuid,uuid,uuid,uuid)','mcp_consume_quota(text,integer)'] loop
  foreach r in array array['anon','authenticated'] loop
    perform pg_temp.check_mcp(not has_function_privilege(r,'public.'||sig,'EXECUTE'),'rpc_acl_'||split_part(sig,'(',1)||'_'||r);
  end loop;
  perform pg_temp.check_mcp(has_function_privilege('service_role','public.'||sig,'EXECUTE'),'service_acl_'||split_part(sig,'(',1));
end loop;
end $$;
select public.mcp_create_grant(g,c) from mcp_tokens;
do $$ begin
  begin
    perform public.mcp_create_grant(g,c) from mcp_tokens;
    raise exception 'mcp_test_consent_replay_allowed';
  exception when unique_violation then perform pg_temp.check_mcp(true,'consent_single_use'); end;
end $$;
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('2',64),repeat('3',64))||jsonb_build_object('challenge',repeat('B',43))) is null,'pkce_mismatch');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('2',64),repeat('3',64))||jsonb_build_object('redirectUri','https://other.example.invalid/callback')) is null,'redirect_mismatch');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('2',64),repeat('3',64))||jsonb_build_object('clientId',gen_random_uuid())) is null,'client_mismatch');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('2',64),repeat('3',64))||jsonb_build_object('resource','https://other.example.invalid/api/mcp')) is null,'resource_mismatch');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('2',64),repeat('3',64))) is not null,'code_exchange');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('code',repeat('1',64),repeat('4',64),repeat('5',64))) is null,'code_single_use');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('refresh',repeat('3',64),repeat('4',64),repeat('5',64))) is not null,'refresh_rotation');
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('refresh',repeat('3',64),repeat('6',64),repeat('7',64))) is null,'refresh_replay_rejected');
select pg_temp.check_mcp((select (value->>'revoked')::boolean from public.mcp_oauth_records where key='grant:'||(select grant_id from mcp_fixture)),'refresh_replay_revokes_family');
update public.mcp_oauth_records set value=value-'revoked' where key='grant:'||(select grant_id from mcp_fixture);
select public.mcp_revoke_grant(gen_random_uuid(),grant_id) from mcp_fixture;
select pg_temp.check_mcp((select not coalesce((value->>'revoked')::boolean,false) from public.mcp_oauth_records where key='grant:'||(select grant_id from mcp_fixture)),'revoke_other_actor_denied');
select public.mcp_revoke_grant(admin_id,grant_id) from mcp_fixture;
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('refresh',repeat('5',64),repeat('6',64),repeat('7',64))) is null,'revoked_grant_denied');
update public.mcp_oauth_records set value=value-'revoked',expires_at=now()-interval '1 second' where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('refresh',repeat('5',64),repeat('6',64),repeat('7',64))) is null,'expired_grant_denied');
update public.mcp_oauth_records set expires_at=now()+interval '1 day' where key='grant:'||(select grant_id from mcp_fixture);
update public.mcp_oauth_records set expires_at=now()-interval '1 second' where key='refresh:'||repeat('5',64);
select pg_temp.check_mcp(public.mcp_exchange_credential(pg_temp.exchange_mcp('refresh',repeat('5',64),repeat('6',64),repeat('7',64))) is null,'expired_credential_denied');
-- Quota is persistent and reset only at its recorded minute boundary.
select pg_temp.check_mcp(not public.mcp_consume_quota('invalid',1),'quota_invalid_key');
select pg_temp.check_mcp(not public.mcp_consume_quota(repeat('a',64),0),'quota_invalid_limit');
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('a',64),2),'quota_first');
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('a',64),2),'quota_second');
select pg_temp.check_mcp(not public.mcp_consume_quota(repeat('a',64),2),'quota_exhausted');
update public.mcp_oauth_records set expires_at=now()-interval '1 second' where key='quota:'||repeat('a',64);
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('a',64),2),'quota_expiry_reset');
-- The expiry sweep is bounded and must never collect credential/review tombstones.
insert into public.mcp_oauth_records(key,value,expires_at)
select 'quota:'||lpad(i::text,64,'0'),jsonb_build_object('count',9),now()-interval '1 minute'
from generate_series(900000,900501) i;
insert into public.mcp_oauth_records(key,value,expires_at)
select kind||':'||repeat('e',64),jsonb_build_object('isolatedFixture',true),now()-interval '31 days'
from unnest(array['grant','code','access','refresh','review']) kind;
select pg_temp.check_mcp((select count(*)=502 from public.mcp_oauth_records where key like 'quota:%' and expires_at<=now()),'quota_cleanup_fixture_count');
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('c',64),2),'quota_cleanup_trigger');
select pg_temp.check_mcp((select count(*)=2 from public.mcp_oauth_records where key like 'quota:%' and expires_at<=now()),'quota_cleanup_bound_500');
select pg_temp.check_mcp((select count(*)=5 from public.mcp_oauth_records where key in (select kind||':'||repeat('e',64) from unnest(array['grant','code','access','refresh','review']) kind)),'quota_cleanup_preserves_auth_and_reviews');
select pg_temp.check_mcp((select value->>'count'='1' and expires_at>now() from public.mcp_oauth_records where key='quota:'||repeat('a',64)),'quota_cleanup_preserves_active_bucket');
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('c',64),2),'quota_cleanup_second_trigger');
select pg_temp.check_mcp(not exists(select 1 from public.mcp_oauth_records where key like 'quota:%' and expires_at<=now()),'quota_cleanup_eventual_collection');
-- Invalid nullable RPC inputs fail closed without allocating durable quota rows.
do $$ declare allowed boolean; begin
  begin allowed := public.mcp_consume_quota(null,1);
  exception when others then raise exception 'mcp_test_quota_null_key_raises'; end;
  perform pg_temp.check_mcp(allowed is false,'quota_null_key_denied');
end $$;
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('d',64),null) is false,'quota_null_limit_denied');
select pg_temp.check_mcp(not exists(select 1 from public.mcp_oauth_records where key='quota:'||repeat('d',64)),'quota_invalid_input_no_allocation');
-- Review receipts bind the human approval, caller, current body and prior state.
select pg_temp.review_mcp();
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_unapproved_denied');
select pg_temp.check_mcp(not public.mcp_approve_review(gen_random_uuid(),review_id),'review_other_approver_denied') from mcp_fixture;
select pg_temp.check_mcp(public.mcp_approve_review(admin_id,review_id),'review_approved') from mcp_fixture;
select pg_temp.check_mcp(public.mcp_commit_review(admin_id,grant_id,gen_random_uuid(),review_id)='forbidden','review_other_client_denied') from mcp_fixture;
update public.mcp_oauth_records set value=value-'scopes' where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_missing_scope_denied');
update public.mcp_oauth_records set value=jsonb_set(value,'{scopes}','null'::jsonb) where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_null_scope_denied');
update public.mcp_oauth_records set value=jsonb_set(value,'{scopes}','[]'::jsonb) where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_empty_scope_denied');
update public.mcp_oauth_records set value=jsonb_set(value,'{scopes}','["catalog:read"]'::jsonb) where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_insufficient_scope_denied');
update public.mcp_oauth_records set value=jsonb_set(value,'{scopes}','["catalog:read","showcase:moderate"]'::jsonb) where key='grant:'||(select grant_id from mcp_fixture);
update public.mcp_oauth_records set value=jsonb_set(value,'{permissionVersion}','0') where key='grant:'||(select grant_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_permission_version_denied');
update public.mcp_oauth_records set value=jsonb_set(value,'{permissionVersion}',to_jsonb(p.permission_version)) from public.admin_profiles p,mcp_fixture f where key='grant:'||f.grant_id and p.member_id=f.admin_id;
update public.members m set must_change_password=true from mcp_fixture f where m.id=f.admin_id;
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_password_gate_denied');
update public.members m set must_change_password=false from mcp_fixture f where m.id=f.admin_id;
update public.admin_profiles p set is_active=false from mcp_fixture f where p.member_id=f.admin_id;
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_inactive_admin_denied');
update public.admin_profiles p set is_active=true from mcp_fixture f where p.member_id=f.admin_id;
update public.showcase_feedback set body='Changed synthetic isolated review fixture.' where id=(select feedback_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='conflict','review_body_conflict');
update public.showcase_feedback set body='Synthetic isolated review fixture.',hidden_at=now() where id=(select feedback_id from mcp_fixture);
select pg_temp.check_mcp(pg_temp.commit_mcp()='conflict','review_state_conflict');
update public.showcase_feedback set hidden_at=null where id=(select feedback_id from mcp_fixture);
update public.admin_profiles p set permission_template_key='readonly' from mcp_fixture f where p.member_id=f.admin_id;
update public.mcp_oauth_records set value=jsonb_set(value,'{permissionVersion}',to_jsonb(p.permission_version)) from public.admin_profiles p,mcp_fixture f where key='grant:'||f.grant_id and p.member_id=f.admin_id;
select pg_temp.check_mcp(pg_temp.commit_mcp()='forbidden','review_readonly_permission_denied');
update public.admin_profiles p set permission_template_key='operations_manager' from mcp_fixture f where p.member_id=f.admin_id;
update public.mcp_oauth_records set value=jsonb_set(value,'{permissionVersion}',to_jsonb(p.permission_version)) from public.admin_profiles p,mcp_fixture f where key='grant:'||f.grant_id and p.member_id=f.admin_id;
-- An audit failure must roll back both the business mutation and the receipt.
create function pg_temp.mcp_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'mcp_test_expected_audit_failure'; end $$;
create trigger mcp_isolated_audit_failure before insert on public.admin_audit_logs for each row when (new.path='/api/mcp') execute function pg_temp.mcp_fail_audit();
do $$ begin
  begin
    perform pg_temp.commit_mcp();
    raise exception 'mcp_test_audit_failure_not_raised';
  exception when raise_exception then
    if sqlerrm <> 'mcp_test_expected_audit_failure' then raise; end if;
    perform pg_temp.check_mcp(true,'review_audit_failure_observed');
  end;
end $$;
select pg_temp.check_mcp((select hidden_at is null from public.showcase_feedback where id=(select feedback_id from mcp_fixture)),'review_audit_rollback_mutation');
select pg_temp.check_mcp((select not coalesce((value->>'executed')::boolean,false) from public.mcp_oauth_records where key='review:'||(select review_id from mcp_fixture)),'review_audit_rollback_receipt');
drop trigger mcp_isolated_audit_failure on public.admin_audit_logs;
grant select on mcp_fixture to service_role;
grant insert on mcp_checks to service_role;
grant execute on function pg_temp.check_mcp(boolean,text),pg_temp.commit_mcp() to service_role;
set local role service_role;
select pg_temp.check_mcp(pg_temp.commit_mcp()='executed','review_commit');
select pg_temp.check_mcp(pg_temp.commit_mcp()='replayed','review_idempotent');
select pg_temp.check_mcp((select count(*)=1 from public.admin_audit_logs where path='/api/mcp' and properties->>'reviewId'=(select review_id::text from mcp_fixture)),'review_single_audit');
select pg_temp.check_mcp((select hidden_at is not null and hidden_by_admin_id=(select admin_id from mcp_fixture) from public.showcase_feedback where id=(select feedback_id from mcp_fixture)),'review_business_rpc_reused');
select pg_temp.check_mcp(public.mcp_consume_quota(repeat('b',64),1),'service_role_quota_execution');
select pg_temp.check_mcp(pg_temp.commit_mcp()='replayed','service_role_review_execution');
reset role;
set local role anon;
do $$ declare denied boolean=false; begin
  begin perform public.mcp_consume_quota(repeat('c',64),1); exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'mcp_test_anon_rpc_allowed'; end if;
end $$;
reset role;
select pg_temp.check_mcp(true,'anon_actual_rpc_denied');
select jsonb_build_object('suite','mcp-oauth','passed',count(*),'rolled_back',true) from mcp_checks;
rollback;
