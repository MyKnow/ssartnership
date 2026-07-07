update public.admin_permission_templates
set permissions = jsonb_set(
      permissions,
      '{logs,read}',
      'false'::jsonb,
      true
    ),
    updated_at = now()
where key = 'regional_partner_manager';
