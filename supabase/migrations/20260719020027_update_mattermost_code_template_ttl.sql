-- Existing overrides remain intact; only the literal validity window is
-- corrected so sent Mattermost messages match the server-side five-minute TTL.
update public.notification_templates
set
  body_template = regexp_replace(
    regexp_replace(body_template, '10[[:space:]]*분', '5분', 'g'),
    '10[[:space:]]*minutes',
    '5 minutes',
    'gi'
  ),
  updated_at = now()
where event_key in (
  'mattermost.signup_code',
  'mattermost.reset_password_code'
)
  and channel = 'mattermost'
  and (
    body_template ~ '10[[:space:]]*분'
    or body_template ~* '10[[:space:]]*minutes'
  );
