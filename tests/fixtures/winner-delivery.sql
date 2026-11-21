create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.notifications (
 id uuid primary key default gen_random_uuid(),type text not null,title text not null,body text not null,
 target_url text not null,metadata jsonb,created_by_member_id uuid,idempotency_key text unique,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.member_notifications (notification_id uuid,member_id uuid,read_at timestamptz,
 deleted_at timestamptz,created_at timestamptz,updated_at timestamptz,primary key(notification_id,member_id));
create table public.notification_deliveries (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null, member_id uuid,
 channel text not null, status text not null default 'pending',error_message text,
 provider text,provider_campaign_id text,provider_idempotency_key text,provider_status text,
 delivered_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now()
);
create unique index notification_deliveries_web_push_unique on public.notification_deliveries(provider_idempotency_key)
where provider='web_push' and provider_idempotency_key is not null;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
