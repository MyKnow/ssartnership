export type AdminPartnerAccountCompany = {
  id: string;
  is_active?: boolean | null;
  created_at?: string | null;
  company?:
      | {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        is_active?: boolean | null;
      }
    | null;
};

export type AdminPartnerAccount = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_token?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links: AdminPartnerAccountCompany[];
};
