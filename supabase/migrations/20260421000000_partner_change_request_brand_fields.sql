alter table partner_change_requests add column if not exists current_partner_name text not null default '';
alter table partner_change_requests add column if not exists current_partner_location text not null default '';
alter table partner_change_requests add column if not exists current_map_url text;
alter table partner_change_requests add column if not exists requested_partner_name text not null default '';
alter table partner_change_requests add column if not exists requested_partner_location text not null default '';
alter table partner_change_requests add column if not exists requested_map_url text;

update partner_change_requests as req
set
  current_partner_name = coalesce(nullif(req.current_partner_name, ''), p.name),
  current_partner_location = coalesce(nullif(req.current_partner_location, ''), p.location),
  current_map_url = coalesce(req.current_map_url, p.map_url),
  requested_partner_name = coalesce(nullif(req.requested_partner_name, ''), nullif(req.current_partner_name, ''), p.name),
  requested_partner_location = coalesce(nullif(req.requested_partner_location, ''), nullif(req.current_partner_location, ''), p.location),
  requested_map_url = coalesce(req.requested_map_url, req.current_map_url, p.map_url)
from partners as p
where req.partner_id = p.id;
