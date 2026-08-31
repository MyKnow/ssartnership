alter table public.partner_benefits enable row level security;

revoke all on table public.partners from public;
revoke all on table public.partners from anon;
revoke all on table public.partners from authenticated;

revoke all on table public.partner_benefits from public;
revoke all on table public.partner_benefits from anon;
revoke all on table public.partner_benefits from authenticated;

grant select, insert, update, delete on table public.partners to service_role;
grant select, insert, update, delete on table public.partner_benefits to service_role;
