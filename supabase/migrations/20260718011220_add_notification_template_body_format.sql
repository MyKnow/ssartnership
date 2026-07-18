-- 이메일 알림 본문 작성 형식: 일반 텍스트, Markdown, 제한된 HTML
alter table public.notification_templates
  add column if not exists body_format text not null default 'plain';

alter table public.notification_templates
  drop constraint if exists notification_templates_body_format_check;
alter table public.notification_templates
  add constraint notification_templates_body_format_check
  check (body_format in ('plain', 'markdown', 'html'));
