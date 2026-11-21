create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.image_upload_sessions (
 id uuid primary key, owner_kind text not null, owner_id text not null, purpose text not null, role text not null,
 storage_bucket text not null default 'image-upload-staging', storage_path text not null, source_storage_path text,
 final_bucket text, final_path text, final_url text, status text not null default 'ready',
 failure_code text, signed_url_expires_at timestamptz not null default now()+interval '1 hour',
 expires_at timestamptz not null default now()+interval '2 hours',
 updated_at timestamptz not null default now(), attached_resource_type text, attached_resource_id text
);
create table public.partner_reviews (id uuid primary key,member_id uuid,partner_id uuid,images text[] not null default '{}',deleted_at timestamptz,is_public boolean default true);
create table public.member_signup_approval_requests (id uuid primary key,profile_image_upload_id uuid,status text not null default 'pending');
create table public.member_profile_images (id uuid primary key,member_id uuid,storage_path text not null,deleted_at timestamptz);
create function public.set_partnership_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger image_upload_sessions_set_updated_at before update on image_upload_sessions for each row execute function public.set_partnership_updated_at();
alter default privileges in schema public revoke execute on functions from public;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
