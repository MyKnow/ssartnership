-- Roles are supplied by supabase/postgres before this init-script runs.
\set pgpass `echo "$POSTGRES_PASSWORD"`
alter user authenticator with password :'pgpass';
alter user supabase_storage_admin with password :'pgpass';
