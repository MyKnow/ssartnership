-- Keep approved recovery requests terminal outside the delayed member
-- anonymization lifecycle. The tombstone transition is allowed only while the
-- linked member independently satisfies the same 30-day gate as the RPC.
create or replace function public.enforce_graduate_verification_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if (
    (old.status = 'draft' and new.status in ('submitted', 'withdrawn'))
    or (old.status = 'submitted' and new.status in ('in_review', 'withdrawn'))
    or (old.status = 'in_review' and new.status in ('needs_resubmission', 'approved', 'rejected'))
    or (old.status = 'needs_resubmission' and new.status in ('submitted', 'withdrawn'))
  ) then
    return new;
  end if;

  if old.status = 'approved'
    and new.status = 'withdrawn'
    and old.request_kind = 'existing_member_recovery'
    and new.request_kind = old.request_kind
    and new.id = old.id
    and old.recovery_member_id is not null
    and new.recovery_member_id is null
    and exists (
      select 1
      from public.members anonymizing_member
      where anonymizing_member.id = old.recovery_member_id
        and anonymizing_member.deleted_at is not null
        and anonymizing_member.deleted_at <= now() - interval '30 days'
        and anonymizing_member.anonymized_at is null
    )
    and new.email = concat('deleted+', new.id::text, '@deleted.invalid')
    and new.email_normalized = new.email
    and new.legal_name = '탈퇴한 수료생'
    and new.document_number_hmac is null
    and new.certificate_storage_path is null
    and new.certificate_sha256 is null
    and new.certificate_deleted_at is not null
    and new.review_note is null
    and new.rejection_reason is null
  then
    return new;
  end if;

  raise exception 'invalid_graduate_verification_status_transition';
end;
$$;
