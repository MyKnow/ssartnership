-- Admin sessions identify members; admin_profiles supplies their permissions.
-- Keep historical actor values and ON DELETE SET NULL. Each replacement FK
-- validates existing rows; inconsistent legacy values must abort the migration.
begin;

alter table public.showcase_events
  drop constraint showcase_events_settled_by_admin_id_fkey,
  add constraint showcase_events_settled_by_admin_id_fkey
    foreign key (settled_by_admin_id) references public.members(id) on delete set null;

alter table public.showcase_projects
  drop constraint showcase_projects_reviewed_by_admin_id_fkey,
  add constraint showcase_projects_reviewed_by_admin_id_fkey
    foreign key (reviewed_by_admin_id) references public.members(id) on delete set null;

alter table public.showcase_feedback
  drop constraint showcase_feedback_hidden_by_admin_id_fkey,
  add constraint showcase_feedback_hidden_by_admin_id_fkey
    foreign key (hidden_by_admin_id) references public.members(id) on delete set null;

alter table public.showcase_candidate_exclusions
  drop constraint showcase_candidate_exclusions_excluded_by_admin_id_fkey,
  add constraint showcase_candidate_exclusions_excluded_by_admin_id_fkey
    foreign key (excluded_by_admin_id) references public.members(id) on delete set null,
  drop constraint showcase_candidate_exclusions_restored_by_admin_id_fkey,
  add constraint showcase_candidate_exclusions_restored_by_admin_id_fkey
    foreign key (restored_by_admin_id) references public.members(id) on delete set null;

alter table public.showcase_draws
  drop constraint showcase_draws_admin_id_fkey,
  add constraint showcase_draws_admin_id_fkey
    foreign key (admin_id) references public.members(id) on delete set null;

alter table public.showcase_winners
  drop constraint showcase_winners_voided_by_admin_id_fkey,
  add constraint showcase_winners_voided_by_admin_id_fkey
    foreign key (voided_by_admin_id) references public.members(id) on delete set null,
  drop constraint showcase_winners_delivered_by_admin_id_fkey,
  add constraint showcase_winners_delivered_by_admin_id_fkey
    foreign key (delivered_by_admin_id) references public.members(id) on delete set null;

commit;
