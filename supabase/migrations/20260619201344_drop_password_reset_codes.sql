delete from public.member_auth_attempts
where identifier like 'request-reset-code:%'
   or identifier like 'verify-reset-code:%';

drop table if exists public.password_reset_codes;
