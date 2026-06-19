delete from public.member_auth_attempts
where identifier like 'request-code:%'
   or identifier like 'verify-code:%';

drop table if exists public.mm_verification_codes;
drop table if exists public.mm_verification_attempts;
