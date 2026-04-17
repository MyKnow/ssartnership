alter table partner_companies
  drop column if exists contact_name,
  drop column if exists contact_email,
  drop column if exists contact_phone;
