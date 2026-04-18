update policy_documents
set is_active = false,
    updated_at = now()
where kind = 'marketing'
  and version = 2
  and is_active = true;

update policy_documents
set is_active = true,
    updated_at = now()
where kind = 'marketing'
  and version = 1;
