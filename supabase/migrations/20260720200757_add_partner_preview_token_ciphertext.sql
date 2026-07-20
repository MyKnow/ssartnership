alter table public.partner_preview_tokens
  add column if not exists token_ciphertext text,
  add column if not exists token_nonce text,
  add column if not exists token_auth_tag text,
  add column if not exists token_key_version smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_preview_tokens_encrypted_fields_check'
      and conrelid = 'public.partner_preview_tokens'::regclass
  ) then
    alter table public.partner_preview_tokens
      add constraint partner_preview_tokens_encrypted_fields_check
      check (
        (
          token_ciphertext is null
          and token_nonce is null
          and token_auth_tag is null
          and token_key_version is null
        )
        or (
          token_ciphertext is not null
          and token_nonce is not null
          and token_auth_tag is not null
          and token_key_version is not null
          and token_key_version between 1 and 99
        )
      );
  end if;
end
$$;
