-- Keep the copyable Mattermost verification message compact and consistent
-- with the current default notification catalog.
update public.notification_templates
set
  body_template = E'아래 코드를 복사해서 입력하세요.\n\n```\n{code}\n```\n- 유효 시간: 5분\n- 타인에게 노출하지 마세요.',
  updated_at = now()
where event_key in (
  'mattermost.signup_code',
  'mattermost.reset_password_code'
)
  and channel = 'mattermost'
  and body_template = E'아래 코드를 복사해서 입력하세요.\n\n```\n{code}\n```\n- 유효 시간: 5분\n---\n타인에게 노출하지 마세요.';
