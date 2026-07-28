-- Keep the two admin graduate-verification queues ordered by their actual
-- operating timestamp without scanning unrelated request states.
create index if not exists graduate_verification_requests_open_queue_created_at_idx
  on public.graduate_verification_requests(created_at desc, id desc)
  where status in ('submitted', 'in_review');

create index if not exists graduate_verification_requests_setup_email_retry_idx
  on public.graduate_verification_requests(setup_email_last_error_at desc, id desc)
  where status = 'approved'
    and setup_email_last_error_at is not null;
