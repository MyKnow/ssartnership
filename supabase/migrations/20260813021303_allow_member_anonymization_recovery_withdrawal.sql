-- Approved recovery requests are normally terminal. Permit the one narrow
-- transition needed to remove a departing member's recovery FK while keeping
-- the historical request as a privacy-safe tombstone.
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
