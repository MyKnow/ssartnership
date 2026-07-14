-- Admin-only XLSX/ZIP member intake. Staging files remain private and expire
-- within 24 hours; only service-role server code may read these records.
alter table public.ssafy_cycle_settings
  add column if not exists manual_member_mm_lookup_generations integer[] not null default array[14, 15]::integer[];

alter table public.ssafy_cycle_settings
  drop constraint if exists ssafy_cycle_settings_manual_member_mm_lookup_generations_check;
alter table public.ssafy_cycle_settings
  add constraint ssafy_cycle_settings_manual_member_mm_lookup_generations_check
  check (
    cardinality(manual_member_mm_lookup_generations) between 0 and 99
    and manual_member_mm_lookup_generations <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
      41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,
      61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,
      81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99
    ]::integer[]
  );

alter table public.member_profile_images
  drop constraint if exists member_profile_images_source_check;
alter table public.member_profile_images
  add constraint member_profile_images_source_check
  check (source in ('legacy', 'mattermost', 'graduate_verification', 'member_upload', 'manual_admin'));

alter table public.member_password_action_tokens
  add column if not exists delivery_channel text not null default 'email';
alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (purpose in ('graduate_initial_setup', 'graduate_password_reset', 'manual_initial_setup', 'manual_password_reset'));
alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_delivery_channel_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_delivery_channel_check
  check (delivery_channel in ('mattermost', 'email'));

create table if not exists public.manual_member_import_batches (
  id uuid primary key default uuid_generate_v4(),
  created_by_admin_id uuid not null references public.members(id) on delete restrict,
  status text not null default 'staging',
  expires_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manual_member_import_batches_status_check
    check (status in ('staging', 'ready', 'processing', 'completed', 'expired'))
);

create table if not exists public.manual_member_import_rows (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references public.manual_member_import_batches(id) on delete cascade,
  row_number integer not null,
  generation integer not null,
  display_name text,
  campus text,
  mm_username text,
  email text,
  email_normalized text,
  photo_filename text,
  staging_bucket text,
  staging_path text,
  staging_deleted_at timestamp with time zone,
  photo_content_type text,
  photo_size_bytes integer,
  member_id uuid references public.members(id) on delete set null,
  status text not null default 'staged',
  error_code text,
  error_message text,
  delivery_channel text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manual_member_import_rows_generation_check check (generation between 0 and 99),
  constraint manual_member_import_rows_status_check check (status in ('staged', 'processing', 'created', 'failed')),
  constraint manual_member_import_rows_delivery_channel_check check (delivery_channel is null or delivery_channel in ('mattermost', 'email')),
  constraint manual_member_import_rows_photo_check check (
    (photo_filename is null and staging_bucket is null and staging_path is null and photo_content_type is null and photo_size_bytes is null)
    or
    (photo_filename is not null and staging_bucket = 'manual-member-import-staging' and staging_path is not null and photo_content_type in ('image/jpeg', 'image/png', 'image/webp') and photo_size_bytes between 1 and 5242880)
  ),
  unique (batch_id, row_number),
  unique (batch_id, staging_path)
);

create index if not exists manual_member_import_batches_expiry_idx
  on public.manual_member_import_batches(expires_at)
  where status in ('staging', 'ready', 'processing');
create index if not exists manual_member_import_rows_batch_status_idx
  on public.manual_member_import_rows(batch_id, status, row_number);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'manual-member-import-staging',
  'manual-member-import-staging',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.manual_member_import_batches enable row level security;
alter table public.manual_member_import_rows enable row level security;
revoke all on table public.manual_member_import_batches from anon;
revoke all on table public.manual_member_import_batches from authenticated;
revoke all on table public.manual_member_import_rows from anon;
revoke all on table public.manual_member_import_rows from authenticated;

drop trigger if exists manual_member_import_batches_set_partnership_updated_at on public.manual_member_import_batches;
create trigger manual_member_import_batches_set_partnership_updated_at
  before update on public.manual_member_import_batches
  for each row execute function public.set_partnership_updated_at();
drop trigger if exists manual_member_import_rows_set_partnership_updated_at on public.manual_member_import_rows;
create trigger manual_member_import_rows_set_partnership_updated_at
  before update on public.manual_member_import_rows
  for each row execute function public.set_partnership_updated_at();

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
begin
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      email_verified_at = case
        when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
        else email_verified_at
      end,
      updated_at = now()
  where id = token_row.member_id
    and deleted_at is null;
  if not found then
    raise exception 'manual_password_action_member_missing';
  end if;
  return token_row.member_id;
end;
$$;
revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;
