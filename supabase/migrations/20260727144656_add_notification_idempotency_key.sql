alter table public.notifications
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_idempotency_key_unique'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_idempotency_key_unique unique (idempotency_key);
  end if;
end
$$;
