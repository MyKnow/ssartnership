export type PartnerPortalAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_token?: string | null;
  initial_setup_token_hash?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_expires_at?: string | null;
  updated_at?: string | null;
};

export type PartnerPortalSetupCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

export type PartnerPortalSetupServiceRow = {
  id: string;
  name: string;
  location: string;
  visibility?: string | null;
  categories?:
    | { label?: string | null }
    | Array<{ label?: string | null }>
    | null;
};
