alter table public.manual_member_import_rows
  add column if not exists photo_attached_at timestamp with time zone,
  add column if not exists delivery_attempted_at timestamp with time zone,
  add column if not exists delivery_sent_at timestamp with time zone,
  add column if not exists delivery_idempotency_key text;

alter table public.manual_member_import_rows
  drop constraint if exists manual_member_import_rows_delivery_checkpoint_check;
alter table public.manual_member_import_rows
  add constraint manual_member_import_rows_delivery_checkpoint_check
  check (
    (
      delivery_attempted_at is null
      or (
        delivery_idempotency_key is not null
        and delivery_channel is not null
      )
    )
    and (
      delivery_sent_at is null
      or (
        delivery_attempted_at is not null
        and delivery_idempotency_key is not null
        and delivery_channel is not null
      )
    )
  );

create unique index if not exists manual_member_import_rows_delivery_key_unique
  on public.manual_member_import_rows(delivery_idempotency_key)
  where delivery_idempotency_key is not null;

alter table public.member_profile_images
  add column if not exists manual_member_import_row_id uuid
  references public.manual_member_import_rows(id) on delete set null;

create unique index if not exists member_profile_images_manual_import_row_unique
  on public.member_profile_images(manual_member_import_row_id)
  where manual_member_import_row_id is not null;
