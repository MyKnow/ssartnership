-- 혜택별 RPC 전환 후 남아 있던 제휴처 단위 최대 횟수 RPC 오버로드를 제거한다.
drop function if exists public.update_partner_immediate_fields_with_audit(
  uuid, uuid[], text, text[], text[], text, text, integer, text, text,
  text, text, text, text, text, text, jsonb
);
