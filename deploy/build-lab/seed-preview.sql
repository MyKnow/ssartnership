-- Only the isolated Preview provisioner invokes this file. Never a migration.
begin;
lock table public.members, public.partner_companies, public.partners in exclusive mode;
do $$
begin
  if exists (select 1 from public.members)
     or exists (select 1 from public.partner_companies)
     or exists (select 1 from public.partners) then
    raise exception 'LAB_SEED_REQUIRES_EMPTY_APPLICATION_DATA';
  end if;
end $$;

insert into public.categories (id, key, label, description)
values ('00000497-0000-4000-8000-000000000001', 'lab-497-synthetic',
        '실험용 제휴', '배포 검증용 가상 데이터');
insert into public.partner_companies (id, name, slug, description, managed_campus_slugs)
values ('00000497-0000-4000-8000-000000000002', '가상 제휴사', 'build-lab-497',
        '실제 업체가 아닌 배포 검증용 데이터', array['seoul']);
insert into public.partners
  (id, company_id, category_id, name, location, detail_description,
   campus_slugs, managed_campus_slugs, period_start, period_end, benefits, conditions)
values
  ('00000497-0000-4000-8000-000000000003',
   '00000497-0000-4000-8000-000000000002', '00000497-0000-4000-8000-000000000001',
   '배포 확인용 가상 제휴', '가상 캠퍼스 · 실제 매장 아님',
   '실험용 Preview의 데이터 연결과 배포를 확인하기 위한 가상 제휴입니다.',
   array['seoul'], array['seoul'], date '2026-01-01', date '2099-12-31',
   array['실험 데이터 · 실제 혜택 없음'], array['실제 이용이나 예약이 불가능합니다.']);
commit;
