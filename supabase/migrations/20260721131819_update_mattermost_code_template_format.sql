-- Keep the Mattermost verification messages consistent with the copyable-code
-- format while preserving administrator-customized templates.
update public.notification_templates
set
  title_template = case
    when title_template = '[싸트너십] {title}'
      then '### [SSARTNERSHIP] {title}'
    else title_template
  end,
  body_template = case
    when body_template like '인증 코드: `{code}`%'
      then E'아래 코드를 복사해서 입력하세요.\n\n```\n{code}\n```\n- 유효 시간: 5분\n---\n타인에게 노출하지 마세요.'
    else body_template
  end,
  updated_at = now()
where event_key in (
  'mattermost.signup_code',
  'mattermost.reset_password_code'
)
  and channel = 'mattermost'
  and (
    title_template = '[싸트너십] {title}'
    or body_template like '인증 코드: `{code}`%'
  );
