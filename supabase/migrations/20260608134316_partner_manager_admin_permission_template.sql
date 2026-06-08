insert into public.admin_permission_templates (key, name, description, permissions)
values (
  'partner_manager',
  '업체 관리 어드민',
  '지역대표가 협력사와 브랜드 정보를 관리합니다.',
  '{
    "members":{"create":false,"read":false,"update":false,"delete":false},
    "reviews":{"create":false,"read":false,"update":false,"delete":false},
    "logs":{"create":false,"read":false,"update":false,"delete":false},
    "brands":{"create":true,"read":true,"update":true,"delete":true},
    "companies":{"create":true,"read":true,"update":true,"delete":true},
    "notifications":{"create":false,"read":false,"update":false,"delete":false},
    "home_ads":{"create":false,"read":false,"update":false,"delete":false},
    "events":{"create":false,"read":false,"update":false,"delete":false},
    "cycles":{"create":false,"read":false,"update":false,"delete":false},
    "admin_management":{"create":false,"read":false,"update":false,"delete":false}
  }'::jsonb
)
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       permissions = excluded.permissions,
       updated_at = now();
