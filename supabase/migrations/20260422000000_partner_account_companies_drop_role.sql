alter table partner_account_companies
  drop constraint if exists partner_account_companies_role_check;

alter table partner_account_companies
  drop column if exists role;
