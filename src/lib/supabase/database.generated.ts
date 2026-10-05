export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ad_campaigns: {
        Row: {
          channels: string[]
          created_at: string
          created_by_admin_id: string | null
          description: string
          ends_at: string
          id: string
          monthly_price_krw: number
          notes: string
          package_tier: string
          partner_id: string
          sponsor_label: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by_admin_id?: string | null
          description?: string
          ends_at: string
          id?: string
          monthly_price_krw?: number
          notes?: string
          package_tier?: string
          partner_id: string
          sponsor_label?: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by_admin_id?: string | null
          description?: string
          ends_at?: string
          id?: string
          monthly_price_krw?: number
          notes?: string
          package_tier?: string
          partner_id?: string
          sponsor_label?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_coupon_codes: {
        Row: {
          assigned_at: string | null
          code: string
          code_hash: string
          coupon_id: string
          created_at: string
          id: string
          issue_id: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          code: string
          code_hash: string
          coupon_id: string
          created_at?: string
          id?: string
          issue_id?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          code?: string
          code_hash?: string
          coupon_id?: string
          created_at?: string
          id?: string
          issue_id?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_coupon_codes_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "ad_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_codes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "ad_coupon_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_coupon_issues: {
        Row: {
          assigned_code: string | null
          code_id: string | null
          coupon_id: string
          created_at: string
          description_snapshot: string
          discount_label_snapshot: string
          expired_at: string | null
          external_url_snapshot: string
          id: string
          issued_at: string
          member_id: string
          onsite_password_hash_snapshot: string | null
          onsite_password_salt_snapshot: string | null
          redemption_type_snapshot: string
          status: string
          terms_snapshot: string[]
          title_snapshot: string
          usage_ends_at: string
          usage_starts_at: string
          used_at: string | null
        }
        Insert: {
          assigned_code?: string | null
          code_id?: string | null
          coupon_id: string
          created_at?: string
          description_snapshot?: string
          discount_label_snapshot?: string
          expired_at?: string | null
          external_url_snapshot?: string
          id?: string
          issued_at?: string
          member_id: string
          onsite_password_hash_snapshot?: string | null
          onsite_password_salt_snapshot?: string | null
          redemption_type_snapshot: string
          status?: string
          terms_snapshot?: string[]
          title_snapshot: string
          usage_ends_at: string
          usage_starts_at: string
          used_at?: string | null
        }
        Update: {
          assigned_code?: string | null
          code_id?: string | null
          coupon_id?: string
          created_at?: string
          description_snapshot?: string
          discount_label_snapshot?: string
          expired_at?: string | null
          external_url_snapshot?: string
          id?: string
          issued_at?: string
          member_id?: string
          onsite_password_hash_snapshot?: string | null
          onsite_password_salt_snapshot?: string | null
          redemption_type_snapshot?: string
          status?: string
          terms_snapshot?: string[]
          title_snapshot?: string
          usage_ends_at?: string
          usage_starts_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_coupon_issues_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "ad_coupon_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_issues_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "ad_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_issues_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_coupon_redemptions: {
        Row: {
          campaign_id: string | null
          coupon_id: string
          created_at: string
          id: string
          issue_id: string | null
          member_id: string | null
          metadata: Json
          partner_id: string
          redemption_code: string
          session_id: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          coupon_id: string
          created_at?: string
          id?: string
          issue_id?: string | null
          member_id?: string | null
          metadata?: Json
          partner_id: string
          redemption_code?: string
          session_id?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          coupon_id?: string
          created_at?: string
          id?: string
          issue_id?: string | null
          member_id?: string | null
          metadata?: Json
          partner_id?: string
          redemption_code?: string
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_coupon_redemptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "ad_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_redemptions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "ad_coupon_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupon_redemptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_coupons: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          daily_issue_limit: number | null
          description: string
          discount_label: string
          download_ends_at: string
          download_starts_at: string
          ends_at: string
          external_url: string
          id: string
          issuance_type: string
          monthly_issue_limit: number | null
          onsite_password_hash: string | null
          onsite_password_salt: string | null
          partner_id: string
          per_member_daily_issue_limit: number | null
          per_member_limit: number
          per_member_monthly_issue_limit: number | null
          per_member_weekly_issue_limit: number | null
          redemption_type: string
          starts_at: string
          status: string
          terms: string[]
          title: string
          updated_at: string
          usage_ends_at: string
          usage_limit: number | null
          usage_starts_at: string
          weekly_issue_limit: number | null
        }
        Insert: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          daily_issue_limit?: number | null
          description?: string
          discount_label?: string
          download_ends_at: string
          download_starts_at: string
          ends_at: string
          external_url?: string
          id?: string
          issuance_type?: string
          monthly_issue_limit?: number | null
          onsite_password_hash?: string | null
          onsite_password_salt?: string | null
          partner_id: string
          per_member_daily_issue_limit?: number | null
          per_member_limit?: number
          per_member_monthly_issue_limit?: number | null
          per_member_weekly_issue_limit?: number | null
          redemption_type?: string
          starts_at: string
          status?: string
          terms?: string[]
          title: string
          updated_at?: string
          usage_ends_at: string
          usage_limit?: number | null
          usage_starts_at: string
          weekly_issue_limit?: number | null
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          daily_issue_limit?: number | null
          description?: string
          discount_label?: string
          download_ends_at?: string
          download_starts_at?: string
          ends_at?: string
          external_url?: string
          id?: string
          issuance_type?: string
          monthly_issue_limit?: number | null
          onsite_password_hash?: string | null
          onsite_password_salt?: string | null
          partner_id?: string
          per_member_daily_issue_limit?: number | null
          per_member_limit?: number
          per_member_monthly_issue_limit?: number | null
          per_member_weekly_issue_limit?: number | null
          redemption_type?: string
          starts_at?: string
          status?: string
          terms?: string[]
          title?: string
          updated_at?: string
          usage_ends_at?: string
          usage_limit?: number | null
          usage_starts_at?: string
          weekly_issue_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_coupons_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_coupons_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_accounts: {
        Row: {
          created_at: string | null
          display_name: string
          email: string | null
          id: string
          initial_setup_completed_at: string | null
          initial_setup_expires_at: string | null
          initial_setup_token_hash: string | null
          is_active: boolean
          last_login_at: string | null
          login_id: string
          must_change_password: boolean
          password_hash: string | null
          password_salt: string | null
          permission_version: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          email?: string | null
          id?: string
          initial_setup_completed_at?: string | null
          initial_setup_expires_at?: string | null
          initial_setup_token_hash?: string | null
          is_active?: boolean
          last_login_at?: string | null
          login_id: string
          must_change_password?: boolean
          password_hash?: string | null
          password_salt?: string | null
          permission_version?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          initial_setup_completed_at?: string | null
          initial_setup_expires_at?: string | null
          initial_setup_token_hash?: string | null
          is_active?: boolean
          last_login_at?: string | null
          login_id?: string
          must_change_password?: boolean
          password_hash?: string | null
          password_salt?: string | null
          permission_version?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          path: string | null
          properties: Json
          request_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          path?: string | null
          properties?: Json
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          path?: string | null
          properties?: Json
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      admin_notification_deliveries: {
        Row: {
          admin_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          notification_id: string
          status: string
        }
        Insert: {
          admin_id?: string | null
          channel: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          status: string
        }
        Update: {
          admin_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_deliveries_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_preferences: {
        Row: {
          admin_id: string
          created_at: string
          enabled: boolean
          expiring_partner_enabled: boolean
          partner_request_enabled: boolean
          portal_enabled: boolean
          push_enabled: boolean
          security_enabled: boolean
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          enabled?: boolean
          expiring_partner_enabled?: boolean
          partner_request_enabled?: boolean
          portal_enabled?: boolean
          push_enabled?: boolean
          security_enabled?: boolean
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          enabled?: boolean
          expiring_partner_enabled?: boolean
          partner_request_enabled?: boolean
          portal_enabled?: boolean
          push_enabled?: boolean
          security_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_preferences_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_recipients: {
        Row: {
          admin_id: string
          created_at: string
          deleted_at: string | null
          id: string
          notification_id: string
          read_at: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_recipients_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          target_url: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          target_url?: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_url?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      admin_permission_templates: {
        Row: {
          created_at: string | null
          description: string
          key: string
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          key: string
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          key?: string
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          granted: boolean
          resource: string
          updated_at: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          granted?: boolean
          resource: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          granted?: boolean
          resource?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          managed_campus_slugs: string[]
          member_id: string
          permission_template_key: string
          permission_version: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          managed_campus_slugs?: string[]
          member_id: string
          permission_template_key: string
          permission_version?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          managed_campus_slugs?: string[]
          member_id?: string
          permission_template_key?: string
          permission_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_profiles_permission_template_key_fkey"
            columns: ["permission_template_key"]
            isOneToOne: false
            referencedRelation: "admin_permission_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      admin_push_subscriptions: {
        Row: {
          admin_id: string
          auth: string
          created_at: string
          endpoint: string
          expiration_time: string | null
          failure_reason: string | null
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          auth: string
          created_at?: string
          endpoint: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_push_subscriptions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_wallet_device_registrations: {
        Row: {
          created_at: string
          device_library_identifier_hash: string
          id: string
          last_registered_at: string
          pass_id: string
          push_token_auth_tag: string
          push_token_ciphertext: string
          push_token_iv: string
          push_token_key_version: number
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_library_identifier_hash: string
          id?: string
          last_registered_at?: string
          pass_id: string
          push_token_auth_tag: string
          push_token_ciphertext: string
          push_token_iv: string
          push_token_key_version: number
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_library_identifier_hash?: string
          id?: string
          last_registered_at?: string
          pass_id?: string
          push_token_auth_tag?: string
          push_token_ciphertext?: string
          push_token_iv?: string
          push_token_key_version?: number
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apple_wallet_device_registrations_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "member_wallet_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_security_logs: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string | null
          event_name: string
          id: string
          identifier: string | null
          ip_address: string | null
          path: string | null
          properties: Json
          request_id: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          event_name: string
          id?: string
          identifier?: string | null
          ip_address?: string | null
          path?: string | null
          properties?: Json
          request_id?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          event_name?: string
          id?: string
          identifier?: string | null
          ip_address?: string | null
          path?: string | null
          properties?: Json
          request_id?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string | null
          event_id: string | null
          event_name: string
          id: string
          ip_address: string | null
          occurred_at: string | null
          path: string | null
          properties: Json
          recorded_at: string | null
          referrer: string | null
          request_id: string | null
          schema_version: number | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          event_id?: string | null
          event_name: string
          id?: string
          ip_address?: string | null
          occurred_at?: string | null
          path?: string | null
          properties?: Json
          recorded_at?: string | null
          referrer?: string | null
          request_id?: string | null
          schema_version?: number | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          event_id?: string | null
          event_name?: string
          id?: string
          ip_address?: string | null
          occurred_at?: string | null
          path?: string | null
          properties?: Json
          recorded_at?: string | null
          referrer?: string | null
          request_id?: string | null
          schema_version?: number | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      event_reward_draws: {
        Row: {
          candidate_count: number
          created_at: string
          created_by_admin_id: string | null
          event_slug: string
          finalized_at: string | null
          google_form_url: string
          guide_path: string
          id: string
          metadata: Json
          seed: string
          sent_at: string | null
          sent_notification_id: string | null
          status: string
          total_tickets: number
          updated_at: string
          winner_count: number
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          created_by_admin_id?: string | null
          event_slug: string
          finalized_at?: string | null
          google_form_url: string
          guide_path: string
          id?: string
          metadata?: Json
          seed: string
          sent_at?: string | null
          sent_notification_id?: string | null
          status?: string
          total_tickets?: number
          updated_at?: string
          winner_count: number
        }
        Update: {
          candidate_count?: number
          created_at?: string
          created_by_admin_id?: string | null
          event_slug?: string
          finalized_at?: string | null
          google_form_url?: string
          guide_path?: string
          id?: string
          metadata?: Json
          seed?: string
          sent_at?: string | null
          sent_notification_id?: string | null
          status?: string
          total_tickets?: number
          updated_at?: string
          winner_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_reward_draws_event_slug_fkey"
            columns: ["event_slug"]
            isOneToOne: false
            referencedRelation: "promotion_events"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "event_reward_draws_sent_notification_id_fkey"
            columns: ["sent_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reward_winners: {
        Row: {
          campus: string | null
          created_at: string
          display_name: string | null
          draw_id: string
          event_slug: string
          id: string
          member_id: string
          mm_username: string | null
          notification_error: string | null
          notification_sent_at: string | null
          notification_status: string
          ticket_count: number
          updated_at: string
          winner_rank: number
          year: number | null
        }
        Insert: {
          campus?: string | null
          created_at?: string
          display_name?: string | null
          draw_id: string
          event_slug: string
          id?: string
          member_id: string
          mm_username?: string | null
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          ticket_count: number
          updated_at?: string
          winner_rank: number
          year?: number | null
        }
        Update: {
          campus?: string | null
          created_at?: string
          display_name?: string | null
          draw_id?: string
          event_slug?: string
          id?: string
          member_id?: string
          mm_username?: string | null
          notification_error?: string | null
          notification_sent_at?: string | null
          notification_status?: string
          ticket_count?: number
          updated_at?: string
          winner_rank?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_reward_winners_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "event_reward_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reward_winners_event_slug_fkey"
            columns: ["event_slug"]
            isOneToOne: false
            referencedRelation: "promotion_events"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "event_reward_winners_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      graduate_email_challenges: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email_normalized: string
          expires_at: string
          id: string
          purpose: string
          request_id: string | null
          request_kind: string
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email_normalized: string
          expires_at: string
          id?: string
          purpose: string
          request_id?: string | null
          request_kind?: string
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          purpose?: string
          request_id?: string | null
          request_kind?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graduate_email_challenges_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "graduate_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      graduate_profiles: {
        Row: {
          created_at: string
          member_id: string
          updated_at: string
          verification_request_id: string | null
          verification_source: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          member_id: string
          updated_at?: string
          verification_request_id?: string | null
          verification_source: string
          verified_at: string
        }
        Update: {
          created_at?: string
          member_id?: string
          updated_at?: string
          verification_request_id?: string | null
          verification_source?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graduate_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduate_profiles_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: true
            referencedRelation: "graduate_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      graduate_verification_requests: {
        Row: {
          campus: string | null
          certificate_delete_after: string | null
          certificate_deleted_at: string | null
          certificate_sha256: string | null
          certificate_storage_path: string | null
          cohort_rule_version: string
          completion_stage: string | null
          created_at: string
          decided_at: string | null
          document_number_hmac: string | null
          email: string
          email_normalized: string
          id: string
          inferred_cohort: number
          inferred_generation: number
          legal_name: string
          privacy_photo_consented_at: string | null
          profile_image_id: string | null
          recovery_member_id: string | null
          rejection_email_last_error_at: string | null
          rejection_email_sent_at: string | null
          rejection_reason: string | null
          request_kind: string
          resubmission_email_last_error_at: string | null
          resubmission_email_sent_at: string | null
          resubmission_targets: string[]
          review_note: string | null
          reviewed_at: string | null
          reviewer_admin_id: string | null
          reviewer_admin_profile_id: string | null
          setup_email_last_error_at: string | null
          setup_email_sent_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          campus?: string | null
          certificate_delete_after?: string | null
          certificate_deleted_at?: string | null
          certificate_sha256?: string | null
          certificate_storage_path?: string | null
          cohort_rule_version?: string
          completion_stage?: string | null
          created_at?: string
          decided_at?: string | null
          document_number_hmac?: string | null
          email: string
          email_normalized: string
          id?: string
          inferred_cohort: number
          inferred_generation: number
          legal_name: string
          privacy_photo_consented_at?: string | null
          profile_image_id?: string | null
          recovery_member_id?: string | null
          rejection_email_last_error_at?: string | null
          rejection_email_sent_at?: string | null
          rejection_reason?: string | null
          request_kind?: string
          resubmission_email_last_error_at?: string | null
          resubmission_email_sent_at?: string | null
          resubmission_targets?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_admin_id?: string | null
          reviewer_admin_profile_id?: string | null
          setup_email_last_error_at?: string | null
          setup_email_sent_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          campus?: string | null
          certificate_delete_after?: string | null
          certificate_deleted_at?: string | null
          certificate_sha256?: string | null
          certificate_storage_path?: string | null
          cohort_rule_version?: string
          completion_stage?: string | null
          created_at?: string
          decided_at?: string | null
          document_number_hmac?: string | null
          email?: string
          email_normalized?: string
          id?: string
          inferred_cohort?: number
          inferred_generation?: number
          legal_name?: string
          privacy_photo_consented_at?: string | null
          profile_image_id?: string | null
          recovery_member_id?: string | null
          rejection_email_last_error_at?: string | null
          rejection_email_sent_at?: string | null
          rejection_reason?: string | null
          request_kind?: string
          resubmission_email_last_error_at?: string | null
          resubmission_email_sent_at?: string | null
          resubmission_targets?: string[]
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_admin_id?: string | null
          reviewer_admin_profile_id?: string | null
          setup_email_last_error_at?: string | null
          setup_email_sent_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graduate_verification_requests_profile_image_id_fkey"
            columns: ["profile_image_id"]
            isOneToOne: false
            referencedRelation: "member_profile_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduate_verification_requests_recovery_member_id_fkey"
            columns: ["recovery_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduate_verification_requests_reviewer_admin_id_fkey"
            columns: ["reviewer_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduate_verification_requests_reviewer_admin_profile_id_fkey"
            columns: ["reviewer_admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      graduate_verification_uploads: {
        Row: {
          challenge_id: string | null
          consumed_at: string | null
          content_type: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          member_id: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          challenge_id?: string | null
          consumed_at?: string | null
          content_type: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          member_id?: string | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          challenge_id?: string | null
          consumed_at?: string | null
          content_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          member_id?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "graduate_verification_uploads_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "graduate_email_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduate_verification_uploads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      image_asset_migrations: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          expected_value: string
          final_bucket: string | null
          final_path: string | null
          final_url: string | null
          id: string
          source_hash: string | null
          source_url: string
          status: string
          target_column: string
          target_index: number | null
          target_row_id: string
          target_table: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          expected_value: string
          final_bucket?: string | null
          final_path?: string | null
          final_url?: string | null
          id?: string
          source_hash?: string | null
          source_url: string
          status?: string
          target_column: string
          target_index?: number | null
          target_row_id: string
          target_table: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          expected_value?: string
          final_bucket?: string | null
          final_path?: string | null
          final_url?: string | null
          id?: string
          source_hash?: string | null
          source_url?: string
          status?: string
          target_column?: string
          target_index?: number | null
          target_row_id?: string
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      image_upload_quota_windows: {
        Row: {
          created_at: string
          identifier_hash: string
          object_count: number
          request_count: number
          reserved_size_bytes: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          identifier_hash: string
          object_count?: number
          request_count?: number
          reserved_size_bytes?: number
          updated_at?: string
          window_started_at: string
        }
        Update: {
          created_at?: string
          identifier_hash?: string
          object_count?: number
          request_count?: number
          reserved_size_bytes?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      image_upload_sessions: {
        Row: {
          attached_at: string | null
          attached_resource_id: string | null
          attached_resource_type: string | null
          completed_at: string | null
          content_type: string | null
          created_at: string
          expires_at: string
          failure_code: string | null
          final_bucket: string | null
          final_path: string | null
          final_url: string | null
          height: number | null
          id: string
          owner_id: string
          owner_kind: string
          purpose: string
          quota_size_bytes: number
          role: string
          sha256: string | null
          signed_url_expires_at: string
          source_content_type: string | null
          source_size_bytes: number | null
          source_storage_path: string | null
          status: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          attached_at?: string | null
          attached_resource_id?: string | null
          attached_resource_type?: string | null
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          expires_at: string
          failure_code?: string | null
          final_bucket?: string | null
          final_path?: string | null
          final_url?: string | null
          height?: number | null
          id?: string
          owner_id: string
          owner_kind: string
          purpose: string
          quota_size_bytes: number
          role: string
          sha256?: string | null
          signed_url_expires_at: string
          source_content_type?: string | null
          source_size_bytes?: number | null
          source_storage_path?: string | null
          status?: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          attached_at?: string | null
          attached_resource_id?: string | null
          attached_resource_type?: string | null
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          expires_at?: string
          failure_code?: string | null
          final_bucket?: string | null
          final_path?: string | null
          final_url?: string | null
          height?: number | null
          id?: string
          owner_id?: string
          owner_kind?: string
          purpose?: string
          quota_size_bytes?: number
          role?: string
          sha256?: string | null
          signed_url_expires_at?: string
          source_content_type?: string | null
          source_size_bytes?: number | null
          source_storage_path?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      log_retention_holds: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string
          expires_at: string | null
          id: string
          log_group: string
          reason: string
          start_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at: string
          expires_at?: string | null
          id?: string
          log_group: string
          reason: string
          start_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string
          expires_at?: string | null
          id?: string
          log_group?: string
          reason?: string
          start_at?: string
        }
        Relationships: []
      }
      manual_member_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_admin_id: string
          expires_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_admin_id: string
          expires_at: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_admin_id?: string
          expires_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_member_import_batches_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_member_import_rows: {
        Row: {
          batch_id: string
          campus: string | null
          created_at: string
          delivery_attempted_at: string | null
          delivery_channel: string | null
          delivery_idempotency_key: string | null
          delivery_sent_at: string | null
          display_name: string | null
          email: string | null
          email_normalized: string | null
          error_code: string | null
          error_message: string | null
          generation: number
          id: string
          image_upload_id: string | null
          member_id: string | null
          mm_username: string | null
          photo_attached_at: string | null
          photo_content_type: string | null
          photo_filename: string | null
          photo_height: number | null
          photo_sha256: string | null
          photo_size_bytes: number | null
          photo_width: number | null
          row_number: number
          staging_bucket: string | null
          staging_deleted_at: string | null
          staging_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          campus?: string | null
          created_at?: string
          delivery_attempted_at?: string | null
          delivery_channel?: string | null
          delivery_idempotency_key?: string | null
          delivery_sent_at?: string | null
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          error_code?: string | null
          error_message?: string | null
          generation: number
          id?: string
          image_upload_id?: string | null
          member_id?: string | null
          mm_username?: string | null
          photo_attached_at?: string | null
          photo_content_type?: string | null
          photo_filename?: string | null
          photo_height?: number | null
          photo_sha256?: string | null
          photo_size_bytes?: number | null
          photo_width?: number | null
          row_number: number
          staging_bucket?: string | null
          staging_deleted_at?: string | null
          staging_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          campus?: string | null
          created_at?: string
          delivery_attempted_at?: string | null
          delivery_channel?: string | null
          delivery_idempotency_key?: string | null
          delivery_sent_at?: string | null
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          error_code?: string | null
          error_message?: string | null
          generation?: number
          id?: string
          image_upload_id?: string | null
          member_id?: string | null
          mm_username?: string | null
          photo_attached_at?: string | null
          photo_content_type?: string | null
          photo_filename?: string | null
          photo_height?: number | null
          photo_sha256?: string | null
          photo_size_bytes?: number | null
          photo_width?: number | null
          row_number?: number
          staging_bucket?: string | null
          staging_deleted_at?: string | null
          staging_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_member_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "manual_member_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_member_import_rows_image_upload_id_fkey"
            columns: ["image_upload_id"]
            isOneToOne: false
            referencedRelation: "image_upload_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_member_import_rows_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mattermost_sender_credentials: {
        Row: {
          created_at: string
          created_by_admin_id: string | null
          encrypted_auth_tag: string | null
          encrypted_ciphertext: string | null
          encrypted_nonce: string | null
          expires_at: string | null
          generation: number
          health_blocked_until: string | null
          health_checked_at: string | null
          health_failure_count: number
          health_last_error_code: string | null
          health_status: string
          id: string
          key_version: number | null
          last_error_code: string | null
          last_test_target_kind: string | null
          last_tested_at: string | null
          login_id_hint: string
          sender_mm_user_id: string | null
          sender_username_hint: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          encrypted_auth_tag?: string | null
          encrypted_ciphertext?: string | null
          encrypted_nonce?: string | null
          expires_at?: string | null
          generation: number
          health_blocked_until?: string | null
          health_checked_at?: string | null
          health_failure_count?: number
          health_last_error_code?: string | null
          health_status?: string
          id?: string
          key_version?: number | null
          last_error_code?: string | null
          last_test_target_kind?: string | null
          last_tested_at?: string | null
          login_id_hint: string
          sender_mm_user_id?: string | null
          sender_username_hint?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          encrypted_auth_tag?: string | null
          encrypted_ciphertext?: string | null
          encrypted_nonce?: string | null
          expires_at?: string | null
          generation?: number
          health_blocked_until?: string | null
          health_checked_at?: string | null
          health_failure_count?: number
          health_last_error_code?: string | null
          health_status?: string
          id?: string
          key_version?: number | null
          last_error_code?: string | null
          last_test_target_kind?: string | null
          last_tested_at?: string | null
          login_id_hint?: string
          sender_mm_user_id?: string | null
          sender_username_hint?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mattermost_sender_credentials_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mattermost_sender_test_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      mattermost_verification_codes: {
        Row: {
          attempt_count: number
          challenge_hash: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          delivery_status: string
          expires_at: string
          id: string
          last_error_code: string | null
          mm_user_id: string | null
          purpose: string
          request_key_hash: string
          resend_available_at: string
          sender_generation: number | null
          subject_generation: number | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          challenge_hash: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          delivery_status?: string
          expires_at: string
          id?: string
          last_error_code?: string | null
          mm_user_id?: string | null
          purpose: string
          request_key_hash: string
          resend_available_at: string
          sender_generation?: number | null
          subject_generation?: number | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          challenge_hash?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          delivery_status?: string
          expires_at?: string
          id?: string
          last_error_code?: string | null
          mm_user_id?: string | null
          purpose?: string
          request_key_hash?: string
          resend_available_at?: string
          sender_generation?: number | null
          subject_generation?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      member_auth_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      member_email_challenges: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          delivery_status: string
          email_normalized: string
          expires_at: string
          graduate_verification_request_id: string | null
          id: string
          member_id: string | null
          purpose: string
          resend_available_at: string
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          delivery_status?: string
          email_normalized: string
          expires_at: string
          graduate_verification_request_id?: string | null
          id?: string
          member_id?: string | null
          purpose: string
          resend_available_at?: string
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          delivery_status?: string
          email_normalized?: string
          expires_at?: string
          graduate_verification_request_id?: string | null
          id?: string
          member_id?: string | null
          purpose?: string
          resend_available_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_email_challenges_graduate_verification_request_id_fkey"
            columns: ["graduate_verification_request_id"]
            isOneToOne: false
            referencedRelation: "graduate_verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_email_challenges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_email_login_transitions: {
        Row: {
          candidate_email: string
          candidate_email_normalized: string
          candidate_email_reservation_hash: string
          completed_at: string | null
          created_at: string
          email_sent_at: string | null
          id: string
          initiated_by_admin_id: string
          member_id: string
          password_action_token_id: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_email: string
          candidate_email_normalized: string
          candidate_email_reservation_hash: string
          completed_at?: string | null
          created_at?: string
          email_sent_at?: string | null
          id?: string
          initiated_by_admin_id: string
          member_id: string
          password_action_token_id?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_email?: string
          candidate_email_normalized?: string
          candidate_email_reservation_hash?: string
          completed_at?: string | null
          created_at?: string
          email_sent_at?: string | null
          id?: string
          initiated_by_admin_id?: string
          member_id?: string
          password_action_token_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_email_login_transitions_initiated_by_admin_id_fkey"
            columns: ["initiated_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_email_login_transitions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_email_login_transitions_password_action_token_id_fkey"
            columns: ["password_action_token_id"]
            isOneToOne: true
            referencedRelation: "member_password_action_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      member_identifier_reservations: {
        Row: {
          created_at: string
          id: string
          identifier_hash: string
          identifier_kind: string
          reserved_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier_hash: string
          identifier_kind: string
          reserved_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier_hash?: string
          identifier_kind?: string
          reserved_at?: string
        }
        Relationships: []
      }
      member_mattermost_disabled_generations: {
        Row: {
          disabled_at: string
          generation: number
        }
        Insert: {
          disabled_at?: string
          generation: number
        }
        Update: {
          disabled_at?: string
          generation?: number
        }
        Relationships: []
      }
      member_notifications: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          member_id: string
          notification_id: string
          read_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          member_id: string
          notification_id: string
          read_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          member_id?: string
          notification_id?: string
          read_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      member_password_action_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          delivery_channel: string
          expires_at: string
          id: string
          member_id: string
          purpose: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          delivery_channel?: string
          expires_at: string
          id?: string
          member_id: string
          purpose: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          delivery_channel?: string
          expires_at?: string
          id?: string
          member_id?: string
          purpose?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_password_action_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_policy_consents: {
        Row: {
          agreed_at: string
          created_at: string | null
          id: string
          ip_address: string | null
          kind: string
          member_id: string
          policy_document_id: string
          user_agent: string | null
          version: number
        }
        Insert: {
          agreed_at?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          kind: string
          member_id: string
          policy_document_id: string
          user_agent?: string | null
          version: number
        }
        Update: {
          agreed_at?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          kind?: string
          member_id?: string
          policy_document_id?: string
          user_agent?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_policy_consents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_policy_consents_policy_document_id_fkey"
            columns: ["policy_document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profile_images: {
        Row: {
          content_type: string
          created_at: string
          delete_after: string | null
          deleted_at: string | null
          graduate_verification_request_id: string | null
          height: number
          id: string
          manual_member_import_row_id: string | null
          member_id: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewer_admin_id: string | null
          reviewer_admin_profile_id: string | null
          sha256: string
          source: string
          status: string
          storage_path: string
          updated_at: string
          width: number
        }
        Insert: {
          content_type?: string
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          graduate_verification_request_id?: string | null
          height?: number
          id?: string
          manual_member_import_row_id?: string | null
          member_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewer_admin_id?: string | null
          reviewer_admin_profile_id?: string | null
          sha256: string
          source?: string
          status?: string
          storage_path: string
          updated_at?: string
          width?: number
        }
        Update: {
          content_type?: string
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          graduate_verification_request_id?: string | null
          height?: number
          id?: string
          manual_member_import_row_id?: string | null
          member_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewer_admin_id?: string | null
          reviewer_admin_profile_id?: string | null
          sha256?: string
          source?: string
          status?: string
          storage_path?: string
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_profile_images_graduate_verification_request_id_fkey"
            columns: ["graduate_verification_request_id"]
            isOneToOne: false
            referencedRelation: "graduate_verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profile_images_manual_member_import_row_id_fkey"
            columns: ["manual_member_import_row_id"]
            isOneToOne: false
            referencedRelation: "manual_member_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profile_images_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profile_images_reviewer_admin_id_fkey"
            columns: ["reviewer_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profile_images_reviewer_admin_profile_id_fkey"
            columns: ["reviewer_admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_signup_approval_requests: {
        Row: {
          consent_agreed_at: string
          consent_ip_address: string | null
          consent_user_agent: string | null
          created_at: string
          expires_at: string
          id: string
          marketing_policy_checked: boolean
          marketing_policy_document_id: string | null
          marketing_policy_version: number | null
          mattermost_account_id: string
          mattermost_display_name: string
          mm_user_id: string
          mm_username: string
          parse_exclusion_reason: string | null
          password_hash: string | null
          password_salt: string | null
          privacy_policy_document_id: string
          privacy_policy_version: number
          profile_image_upload_id: string | null
          rejection_reason: string | null
          requested_generation: number
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          sender_generation: number
          service_policy_document_id: string
          service_policy_version: number
          status: string
          updated_at: string
        }
        Insert: {
          consent_agreed_at?: string
          consent_ip_address?: string | null
          consent_user_agent?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          marketing_policy_checked?: boolean
          marketing_policy_document_id?: string | null
          marketing_policy_version?: number | null
          mattermost_account_id: string
          mattermost_display_name: string
          mm_user_id: string
          mm_username: string
          parse_exclusion_reason?: string | null
          password_hash?: string | null
          password_salt?: string | null
          privacy_policy_document_id: string
          privacy_policy_version: number
          profile_image_upload_id?: string | null
          rejection_reason?: string | null
          requested_generation: number
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          sender_generation: number
          service_policy_document_id: string
          service_policy_version: number
          status?: string
          updated_at?: string
        }
        Update: {
          consent_agreed_at?: string
          consent_ip_address?: string | null
          consent_user_agent?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          marketing_policy_checked?: boolean
          marketing_policy_document_id?: string | null
          marketing_policy_version?: number | null
          mattermost_account_id?: string
          mattermost_display_name?: string
          mm_user_id?: string
          mm_username?: string
          parse_exclusion_reason?: string | null
          password_hash?: string | null
          password_salt?: string | null
          privacy_policy_document_id?: string
          privacy_policy_version?: number
          profile_image_upload_id?: string | null
          rejection_reason?: string | null
          requested_generation?: number
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          sender_generation?: number
          service_policy_document_id?: string
          service_policy_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_signup_approval_reques_marketing_policy_document_id_fkey"
            columns: ["marketing_policy_document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_signup_approval_requests_mattermost_account_id_fkey"
            columns: ["mattermost_account_id"]
            isOneToOne: false
            referencedRelation: "mm_user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_signup_approval_requests_privacy_policy_document_id_fkey"
            columns: ["privacy_policy_document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_signup_approval_requests_profile_image_upload_id_fkey"
            columns: ["profile_image_upload_id"]
            isOneToOne: false
            referencedRelation: "image_upload_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_signup_approval_requests_reviewed_by_admin_id_fkey"
            columns: ["reviewed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_signup_approval_requests_service_policy_document_id_fkey"
            columns: ["service_policy_document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      member_ssafy_verifications: {
        Row: {
          auth_time: string | null
          created_at: string
          last_scope: string | null
          member_id: string
          ssafy_sub: string
          track: string | null
          track_name: string | null
          updated_at: string
          verification_id: string | null
          verified_at: string
        }
        Insert: {
          auth_time?: string | null
          created_at?: string
          last_scope?: string | null
          member_id: string
          ssafy_sub: string
          track?: string | null
          track_name?: string | null
          updated_at?: string
          verification_id?: string | null
          verified_at: string
        }
        Update: {
          auth_time?: string | null
          created_at?: string
          last_scope?: string | null
          member_id?: string
          ssafy_sub?: string
          track?: string | null
          track_name?: string | null
          updated_at?: string
          verification_id?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ssafy_verifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_wallet_pass_operations: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          member_id: string
          operation: string
          platform: string
          request_fingerprint: string
          result_pass_id: string | null
          result_revision: number | null
          result_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          member_id: string
          operation: string
          platform: string
          request_fingerprint: string
          result_pass_id?: string | null
          result_revision?: number | null
          result_status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          member_id?: string
          operation?: string
          platform?: string
          request_fingerprint?: string
          result_pass_id?: string | null
          result_revision?: number | null
          result_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_wallet_pass_operations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_wallet_pass_operations_result_pass_id_fkey"
            columns: ["result_pass_id"]
            isOneToOne: false
            referencedRelation: "member_wallet_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      member_wallet_pass_revisions: {
        Row: {
          consent_version: number
          consented_at: string
          created_at: string
          id: string
          issued_at: string
          pass_id: string
          revision: number
          snapshot: Json
          snapshot_hash: string
        }
        Insert: {
          consent_version: number
          consented_at: string
          created_at?: string
          id?: string
          issued_at?: string
          pass_id: string
          revision: number
          snapshot?: Json
          snapshot_hash: string
        }
        Update: {
          consent_version?: number
          consented_at?: string
          created_at?: string
          id?: string
          issued_at?: string
          pass_id?: string
          revision?: number
          snapshot?: Json
          snapshot_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_wallet_pass_revisions_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "member_wallet_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      member_wallet_passes: {
        Row: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          id: string
          installation_status: string
          issued_at: string
          last_sync_attempted_at: string | null
          last_sync_error_at: string | null
          last_sync_error_code: string | null
          last_synced_at: string | null
          member_id: string
          platform: string
          public_id: string
          revoked_at: string | null
          serial_number: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          consent_version: number
          consented_at: string
          created_at?: string
          credential_status?: string
          current_revision?: number
          current_snapshot?: Json
          current_snapshot_hash: string
          id?: string
          installation_status?: string
          issued_at?: string
          last_sync_attempted_at?: string | null
          last_sync_error_at?: string | null
          last_sync_error_code?: string | null
          last_synced_at?: string | null
          member_id: string
          platform: string
          public_id: string
          revoked_at?: string | null
          serial_number: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          consent_version?: number
          consented_at?: string
          created_at?: string
          credential_status?: string
          current_revision?: number
          current_snapshot?: Json
          current_snapshot_hash?: string
          id?: string
          installation_status?: string
          issued_at?: string
          last_sync_attempted_at?: string | null
          last_sync_error_at?: string | null
          last_sync_error_code?: string | null
          last_synced_at?: string | null
          member_id?: string
          platform?: string
          public_id?: string
          revoked_at?: string | null
          serial_number?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_wallet_passes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          anonymized_at: string | null
          auth_session_version: number
          campus: string | null
          created_at: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          email_normalized: string | null
          email_verified_at: string | null
          generation: number | null
          id: string
          manual_login_id: string | null
          mattermost_account_id: string | null
          mattermost_login_disabled_at: string | null
          mattermost_login_disabled_reason: string | null
          must_change_password: boolean
          password_hash: string | null
          password_salt: string | null
          staff_source_generation: number | null
          updated_at: string | null
        }
        Insert: {
          anonymized_at?: string | null
          auth_session_version?: number
          campus?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          email_verified_at?: string | null
          generation?: number | null
          id?: string
          manual_login_id?: string | null
          mattermost_account_id?: string | null
          mattermost_login_disabled_at?: string | null
          mattermost_login_disabled_reason?: string | null
          must_change_password?: boolean
          password_hash?: string | null
          password_salt?: string | null
          staff_source_generation?: number | null
          updated_at?: string | null
        }
        Update: {
          anonymized_at?: string | null
          auth_session_version?: number
          campus?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          email_verified_at?: string | null
          generation?: number | null
          id?: string
          manual_login_id?: string | null
          mattermost_account_id?: string | null
          mattermost_login_disabled_at?: string | null
          mattermost_login_disabled_reason?: string | null
          must_change_password?: boolean
          password_hash?: string | null
          password_salt?: string | null
          staff_source_generation?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_mattermost_account_id_fkey"
            columns: ["mattermost_account_id"]
            isOneToOne: false
            referencedRelation: "mm_user_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_user_directory: {
        Row: {
          campus: string | null
          campus_snapshot: string | null
          created_at: string | null
          display_name: string
          display_name_snapshot: string | null
          id: string
          is_active: boolean
          is_staff: boolean
          last_seen_at: string | null
          legacy_ssafy_mattermost_user_id: string | null
          mm_user_id: string
          mm_username: string
          source_generations: number[]
          source_years: number[]
          synced_at: string
          updated_at: string | null
        }
        Insert: {
          campus?: string | null
          campus_snapshot?: string | null
          created_at?: string | null
          display_name: string
          display_name_snapshot?: string | null
          id?: string
          is_active?: boolean
          is_staff?: boolean
          last_seen_at?: string | null
          legacy_ssafy_mattermost_user_id?: string | null
          mm_user_id: string
          mm_username: string
          source_generations?: number[]
          source_years?: number[]
          synced_at?: string
          updated_at?: string | null
        }
        Update: {
          campus?: string | null
          campus_snapshot?: string | null
          created_at?: string | null
          display_name?: string
          display_name_snapshot?: string | null
          id?: string
          is_active?: boolean
          is_staff?: boolean
          last_seen_at?: string | null
          legacy_ssafy_mattermost_user_id?: string | null
          mm_user_id?: string
          mm_username?: string
          source_generations?: number[]
          source_years?: number[]
          synced_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          member_id: string | null
          notification_id: string
          provider: string | null
          provider_campaign_id: string | null
          provider_idempotency_key: string | null
          provider_notification_id: string | null
          provider_status: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          notification_id: string
          provider?: string | null
          provider_campaign_id?: string | null
          provider_idempotency_key?: string | null
          provider_notification_id?: string | null
          provider_status?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          notification_id?: string
          provider?: string | null
          provider_campaign_id?: string | null
          provider_idempotency_key?: string | null
          provider_notification_id?: string | null
          provider_status?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_format: string
          body_template: string
          channel: string
          created_at: string
          event_key: string
          id: string
          title_template: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_format?: string
          body_template: string
          channel: string
          created_at?: string
          event_key: string
          id?: string
          title_template: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_format?: string
          body_template?: string
          channel?: string
          created_at?: string
          event_key?: string
          id?: string
          title_template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          created_by_member_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          target_url: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by_member_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          target_url: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by_member_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          target_url?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_notification_dedupes: {
        Row: {
          audience: string
          created_at: string
          dedupe_key: string
          notification_type: string
          target_id: string
        }
        Insert: {
          audience: string
          created_at?: string
          dedupe_key: string
          notification_type: string
          target_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          dedupe_key?: string
          notification_type?: string
          target_id?: string
        }
        Relationships: []
      }
      partner_account_companies: {
        Row: {
          account_id: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          account_id: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          account_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_account_companies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_account_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_accounts: {
        Row: {
          auth_session_version: number
          created_at: string | null
          display_name: string
          email: string | null
          email_verified_at: string | null
          id: string
          initial_setup_completed_at: string | null
          initial_setup_expires_at: string | null
          initial_setup_link_sent_at: string | null
          initial_setup_token_hash: string | null
          is_active: boolean
          last_login_at: string | null
          login_id: string
          must_change_password: boolean
          password_hash: string
          password_salt: string
          updated_at: string | null
        }
        Insert: {
          auth_session_version?: number
          created_at?: string | null
          display_name: string
          email?: string | null
          email_verified_at?: string | null
          id?: string
          initial_setup_completed_at?: string | null
          initial_setup_expires_at?: string | null
          initial_setup_link_sent_at?: string | null
          initial_setup_token_hash?: string | null
          is_active?: boolean
          last_login_at?: string | null
          login_id: string
          must_change_password?: boolean
          password_hash: string
          password_salt: string
          updated_at?: string | null
        }
        Update: {
          auth_session_version?: number
          created_at?: string | null
          display_name?: string
          email?: string | null
          email_verified_at?: string | null
          id?: string
          initial_setup_completed_at?: string | null
          initial_setup_expires_at?: string | null
          initial_setup_link_sent_at?: string | null
          initial_setup_token_hash?: string | null
          is_active?: boolean
          last_login_at?: string | null
          login_id?: string
          must_change_password?: boolean
          password_hash?: string
          password_salt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_auth_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      partner_benefit_usages: {
        Row: {
          benefit_id: string | null
          benefit_snapshot: string
          created_at: string
          id: string
          idempotency_key: string
          member_id: string
          metadata: Json
          partner_id: string
          use_count: number
          verified_at: string
        }
        Insert: {
          benefit_id?: string | null
          benefit_snapshot: string
          created_at?: string
          id?: string
          idempotency_key: string
          member_id: string
          metadata?: Json
          partner_id: string
          use_count?: number
          verified_at?: string
        }
        Update: {
          benefit_id?: string | null
          benefit_snapshot?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          member_id?: string
          metadata?: Json
          partner_id?: string
          use_count?: number
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_benefit_usages_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "partner_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_benefit_usages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_benefit_usages_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_benefits: {
        Row: {
          created_at: string
          display_order: number
          id: string
          max_apply_count: number | null
          partner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          max_apply_count?: number | null
          partner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          max_apply_count?: number | null
          partner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_benefits_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_billing_invoices: {
        Row: {
          billing_policy: string
          billing_reason: string
          cancelled_at: string | null
          company_id: string
          created_at: string
          current_plan_tier: string
          downgraded_at: string | null
          due_at: string
          id: string
          invoice_number: string
          issue_date: string
          metadata: Json
          overdue_marked_at: string | null
          paid_at: string | null
          partner_id: string
          payment_method: string
          remaining_days: number
          requested_by_account_id: string | null
          requested_plan_tier: string
          service_period_end: string | null
          service_period_start: string | null
          status: string
          supply_amount_krw: number
          total_amount_krw: number
          updated_at: string
          upgrade_request_id: string | null
          vat_amount_krw: number
        }
        Insert: {
          billing_policy: string
          billing_reason?: string
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          current_plan_tier: string
          downgraded_at?: string | null
          due_at: string
          id?: string
          invoice_number: string
          issue_date?: string
          metadata?: Json
          overdue_marked_at?: string | null
          paid_at?: string | null
          partner_id: string
          payment_method?: string
          remaining_days?: number
          requested_by_account_id?: string | null
          requested_plan_tier: string
          service_period_end?: string | null
          service_period_start?: string | null
          status?: string
          supply_amount_krw: number
          total_amount_krw: number
          updated_at?: string
          upgrade_request_id?: string | null
          vat_amount_krw: number
        }
        Update: {
          billing_policy?: string
          billing_reason?: string
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          current_plan_tier?: string
          downgraded_at?: string | null
          due_at?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          metadata?: Json
          overdue_marked_at?: string | null
          paid_at?: string | null
          partner_id?: string
          payment_method?: string
          remaining_days?: number
          requested_by_account_id?: string | null
          requested_plan_tier?: string
          service_period_end?: string | null
          service_period_start?: string | null
          status?: string
          supply_amount_krw?: number
          total_amount_krw?: number
          updated_at?: string
          upgrade_request_id?: string | null
          vat_amount_krw?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_billing_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_billing_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_billing_invoices_requested_by_account_id_fkey"
            columns: ["requested_by_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_billing_invoices_upgrade_request_id_fkey"
            columns: ["upgrade_request_id"]
            isOneToOne: false
            referencedRelation: "partner_plan_upgrade_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_billing_payments: {
        Row: {
          amount_krw: number
          confirmed_at: string | null
          confirmed_by_admin_id: string | null
          created_at: string
          failure_reason: string | null
          id: string
          invoice_id: string
          memo: string
          method: string
          payer_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_krw: number
          confirmed_at?: string | null
          confirmed_by_admin_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          invoice_id: string
          memo?: string
          method?: string
          payer_name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_krw?: number
          confirmed_at?: string | null
          confirmed_by_admin_id?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          memo?: string
          method?: string
          payer_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_billing_payments_confirmed_by_admin_id_fkey"
            columns: ["confirmed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "partner_billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_billing_profiles: {
        Row: {
          account_id: string | null
          archived_at: string | null
          business_address: string
          business_item: string
          business_name: string
          business_registration_number: string
          business_type: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          last_used_at: string | null
          payer_name: string
          representative_name: string
          tax_document_type: string
          tax_invoice_email: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          business_address: string
          business_item: string
          business_name: string
          business_registration_number: string
          business_type: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          last_used_at?: string | null
          payer_name?: string
          representative_name: string
          tax_document_type?: string
          tax_invoice_email: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          business_address?: string
          business_item?: string
          business_name?: string
          business_registration_number?: string
          business_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          last_used_at?: string | null
          payer_name?: string
          representative_name?: string
          tax_document_type?: string
          tax_invoice_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_billing_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_billing_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_brand_plan_events: {
        Row: {
          actor_admin_id: string | null
          actor_partner_account_id: string | null
          company_id: string
          created_at: string
          id: string
          metadata: Json
          next_plan_tier: string
          note: string
          partner_id: string | null
          plan_expires_at: string | null
          plan_started_at: string | null
          previous_plan_tier: string | null
          source: string
          upgrade_request_id: string | null
        }
        Insert: {
          actor_admin_id?: string | null
          actor_partner_account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json
          next_plan_tier: string
          note?: string
          partner_id?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          previous_plan_tier?: string | null
          source?: string
          upgrade_request_id?: string | null
        }
        Update: {
          actor_admin_id?: string | null
          actor_partner_account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          next_plan_tier?: string
          note?: string
          partner_id?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          previous_plan_tier?: string | null
          source?: string
          upgrade_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_brand_plan_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_company_plan_events_actor_admin_id_fkey"
            columns: ["actor_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_company_plan_events_actor_partner_account_id_fkey"
            columns: ["actor_partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_company_plan_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_company_plan_events_upgrade_request_id_fkey"
            columns: ["upgrade_request_id"]
            isOneToOne: false
            referencedRelation: "partner_plan_upgrade_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_brand_profiles: {
        Row: {
          brand_phone: string | null
          category_id: string | null
          category_label: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_urls: string[]
          inquiry_link: string | null
          name: string
          tags: string[]
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          brand_phone?: string | null
          category_id?: string | null
          category_label?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[]
          inquiry_link?: string | null
          name: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_phone?: string | null
          category_id?: string | null
          category_label?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_urls?: string[]
          inquiry_link?: string | null
          name?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_brand_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_brand_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_change_requests: {
        Row: {
          cancelled_at: string | null
          cancelled_by_account_id: string | null
          company_id: string
          created_at: string | null
          current_applies_to: string[]
          current_benefits: string[]
          current_campus_slugs: string[]
          current_conditions: string[]
          current_detail_description: string | null
          current_images: string[]
          current_inquiry_link: string | null
          current_map_url: string | null
          current_partner_location: string
          current_partner_name: string
          current_period_end: string | null
          current_period_start: string | null
          current_reservation_link: string | null
          current_tags: string[]
          current_thumbnail: string | null
          id: string
          partner_id: string
          requested_applies_to: string[]
          requested_benefits: string[]
          requested_by_account_id: string | null
          requested_campus_slugs: string[]
          requested_conditions: string[]
          requested_detail_description: string | null
          requested_images: string[]
          requested_inquiry_link: string | null
          requested_map_url: string | null
          requested_partner_location: string
          requested_partner_name: string
          requested_period_end: string | null
          requested_period_start: string | null
          requested_reservation_link: string | null
          requested_tags: string[]
          requested_thumbnail: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by_account_id?: string | null
          company_id: string
          created_at?: string | null
          current_applies_to?: string[]
          current_benefits?: string[]
          current_campus_slugs?: string[]
          current_conditions?: string[]
          current_detail_description?: string | null
          current_images?: string[]
          current_inquiry_link?: string | null
          current_map_url?: string | null
          current_partner_location?: string
          current_partner_name?: string
          current_period_end?: string | null
          current_period_start?: string | null
          current_reservation_link?: string | null
          current_tags?: string[]
          current_thumbnail?: string | null
          id?: string
          partner_id: string
          requested_applies_to?: string[]
          requested_benefits?: string[]
          requested_by_account_id?: string | null
          requested_campus_slugs?: string[]
          requested_conditions?: string[]
          requested_detail_description?: string | null
          requested_images?: string[]
          requested_inquiry_link?: string | null
          requested_map_url?: string | null
          requested_partner_location?: string
          requested_partner_name?: string
          requested_period_end?: string | null
          requested_period_start?: string | null
          requested_reservation_link?: string | null
          requested_tags?: string[]
          requested_thumbnail?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by_account_id?: string | null
          company_id?: string
          created_at?: string | null
          current_applies_to?: string[]
          current_benefits?: string[]
          current_campus_slugs?: string[]
          current_conditions?: string[]
          current_detail_description?: string | null
          current_images?: string[]
          current_inquiry_link?: string | null
          current_map_url?: string | null
          current_partner_location?: string
          current_partner_name?: string
          current_period_end?: string | null
          current_period_start?: string | null
          current_reservation_link?: string | null
          current_tags?: string[]
          current_thumbnail?: string | null
          id?: string
          partner_id?: string
          requested_applies_to?: string[]
          requested_benefits?: string[]
          requested_by_account_id?: string | null
          requested_campus_slugs?: string[]
          requested_conditions?: string[]
          requested_detail_description?: string | null
          requested_images?: string[]
          requested_inquiry_link?: string | null
          requested_map_url?: string | null
          requested_partner_location?: string
          requested_partner_name?: string
          requested_period_end?: string | null
          requested_period_start?: string | null
          requested_reservation_link?: string | null
          requested_tags?: string[]
          requested_thumbnail?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_change_requests_cancelled_by_account_id_fkey"
            columns: ["cancelled_by_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_change_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_change_requests_requested_by_account_id_fkey"
            columns: ["requested_by_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          managed_campus_slugs: string[]
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          managed_campus_slugs?: string[]
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          managed_campus_slugs?: string[]
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_company_branches: {
        Row: {
          address: string
          branch_code: string | null
          branch_key: string
          branch_type: string
          brand_profile_id: string | null
          campus_slugs: string[]
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean
          map_url: string | null
          memo: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          branch_code?: string | null
          branch_key: string
          branch_type?: string
          brand_profile_id?: string | null
          campus_slugs?: string[]
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          map_url?: string | null
          memo?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          branch_code?: string | null
          branch_key?: string
          branch_type?: string
          brand_profile_id?: string | null
          campus_slugs?: string[]
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          map_url?: string | null
          memo?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_company_branches_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "partner_brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_favorites: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          partner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          partner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          partner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_favorites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_favorites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_metric_rollups: {
        Row: {
          bucket_local_date: string | null
          bucket_local_dow: number | null
          bucket_local_start: string | null
          bucket_timezone: string
          created_at: string | null
          granularity: string
          id: string
          metric_count: number
          metric_kind: string
          metric_name: string
          partner_id: string
          updated_at: string | null
        }
        Insert: {
          bucket_local_date?: string | null
          bucket_local_dow?: number | null
          bucket_local_start?: string | null
          bucket_timezone?: string
          created_at?: string | null
          granularity: string
          id?: string
          metric_count?: number
          metric_kind?: string
          metric_name: string
          partner_id: string
          updated_at?: string | null
        }
        Update: {
          bucket_local_date?: string | null
          bucket_local_dow?: number | null
          bucket_local_start?: string | null
          bucket_timezone?: string
          created_at?: string | null
          granularity?: string
          id?: string
          metric_count?: number
          metric_kind?: string
          metric_name?: string
          partner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_metric_rollups_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_metric_unique_visitors: {
        Row: {
          bucket_local_date: string | null
          bucket_local_dow: number | null
          bucket_local_start: string | null
          bucket_timezone: string
          created_at: string | null
          granularity: string
          id: string
          metric_name: string
          partner_id: string
          updated_at: string | null
          visitor_key: string
        }
        Insert: {
          bucket_local_date?: string | null
          bucket_local_dow?: number | null
          bucket_local_start?: string | null
          bucket_timezone?: string
          created_at?: string | null
          granularity: string
          id?: string
          metric_name: string
          partner_id: string
          updated_at?: string | null
          visitor_key: string
        }
        Update: {
          bucket_local_date?: string | null
          bucket_local_dow?: number | null
          bucket_local_start?: string | null
          bucket_timezone?: string
          created_at?: string | null
          granularity?: string
          id?: string
          metric_name?: string
          partner_id?: string
          updated_at?: string | null
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_metric_unique_visitors_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notification_deliveries: {
        Row: {
          account_id: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          notification_id: string
          status: string
        }
        Insert: {
          account_id?: string | null
          channel: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          status: string
        }
        Update: {
          account_id?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_notification_deliveries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "partner_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notification_preferences: {
        Row: {
          account_id: string
          created_at: string
          email_enabled: boolean
          enabled: boolean
          expiring_partner_enabled: boolean
          metrics_enabled: boolean
          plan_enabled: boolean
          portal_enabled: boolean
          push_enabled: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email_enabled?: boolean
          enabled?: boolean
          expiring_partner_enabled?: boolean
          metrics_enabled?: boolean
          plan_enabled?: boolean
          portal_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email_enabled?: boolean
          enabled?: boolean
          expiring_partner_enabled?: boolean
          metrics_enabled?: boolean
          plan_enabled?: boolean
          portal_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_notification_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notification_recipients: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          id: string
          notification_id: string
          read_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_notification_recipients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "partner_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notifications: {
        Row: {
          body: string
          company_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_url: string
          title: string
          type: string
        }
        Insert: {
          body: string
          company_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_url?: string
          title: string
          type: string
        }
        Update: {
          body?: string
          company_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_url?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_offer_branches: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          memo: string | null
          partner_id: string
          source: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          memo?: string | null
          partner_id: string
          source?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          memo?: string | null
          partner_id?: string
          source?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_offer_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "partner_company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_offer_branches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_plan_upgrade_requests: {
        Row: {
          admin_note: string
          billing_invoice_id: string | null
          company_id: string
          created_at: string
          current_plan_tier: string
          id: string
          memo: string
          partner_id: string | null
          payer_name: string
          payment_amount_krw: number
          requested_by_account_id: string
          requested_plan_tier: string
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string
          billing_invoice_id?: string | null
          company_id: string
          created_at?: string
          current_plan_tier: string
          id?: string
          memo?: string
          partner_id?: string | null
          payer_name?: string
          payment_amount_krw?: number
          requested_by_account_id: string
          requested_plan_tier: string
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string
          billing_invoice_id?: string | null
          company_id?: string
          created_at?: string
          current_plan_tier?: string
          id?: string
          memo?: string
          partner_id?: string | null
          payer_name?: string
          payment_amount_krw?: number
          requested_by_account_id?: string
          requested_plan_tier?: string
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_plan_upgrade_requests_billing_invoice_id_fkey"
            columns: ["billing_invoice_id"]
            isOneToOne: false
            referencedRelation: "partner_billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_plan_upgrade_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_plan_upgrade_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_plan_upgrade_requests_requested_by_account_id_fkey"
            columns: ["requested_by_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_plan_upgrade_requests_reviewed_by_admin_id_fkey"
            columns: ["reviewed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_preview_tokens: {
        Row: {
          created_at: string
          expires_at: string
          partner_id: string
          token_auth_tag: string | null
          token_ciphertext: string | null
          token_hash: string
          token_key_version: number | null
          token_nonce: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          partner_id: string
          token_auth_tag?: string | null
          token_ciphertext?: string | null
          token_hash: string
          token_key_version?: number | null
          token_nonce?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          partner_id?: string
          token_auth_tag?: string | null
          token_ciphertext?: string | null
          token_hash?: string
          token_key_version?: number | null
          token_nonce?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_preview_tokens_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_publication_notification_states: {
        Row: {
          new_partner_notification_processing_at: string | null
          new_partner_notification_sent_at: string | null
          partner_id: string
          updated_at: string
        }
        Insert: {
          new_partner_notification_processing_at?: string | null
          new_partner_notification_sent_at?: string | null
          partner_id: string
          updated_at?: string
        }
        Update: {
          new_partner_notification_processing_at?: string | null
          new_partner_notification_sent_at?: string | null
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_publication_notification_states_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_push_subscriptions: {
        Row: {
          account_id: string
          auth: string
          created_at: string
          endpoint: string
          expiration_time: string | null
          failure_reason: string | null
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          account_id: string
          auth: string
          created_at?: string
          endpoint: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_push_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_registration_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      partner_registration_benefit_groups: {
        Row: {
          benefit_action_link: string | null
          benefit_action_type: string
          benefits: string[]
          conditions: string[]
          created_at: string | null
          group_key: string
          id: string
          label: string
          period_end: string | null
          period_start: string | null
          registration_request_id: string
          tags: string[]
          updated_at: string | null
        }
        Insert: {
          benefit_action_link?: string | null
          benefit_action_type?: string
          benefits?: string[]
          conditions?: string[]
          created_at?: string | null
          group_key: string
          id?: string
          label: string
          period_end?: string | null
          period_start?: string | null
          registration_request_id: string
          tags?: string[]
          updated_at?: string | null
        }
        Update: {
          benefit_action_link?: string | null
          benefit_action_type?: string
          benefits?: string[]
          conditions?: string[]
          created_at?: string | null
          group_key?: string
          id?: string
          label?: string
          period_end?: string | null
          period_start?: string | null
          registration_request_id?: string
          tags?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_registration_benefit_group_registration_request_id_fkey"
            columns: ["registration_request_id"]
            isOneToOne: false
            referencedRelation: "partner_registration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_registration_branches: {
        Row: {
          address: string
          benefit_group_key: string
          branch_code: string | null
          branch_key: string
          branch_type: string
          campus_slugs: string[]
          created_at: string | null
          id: string
          map_url: string | null
          memo: string | null
          name: string
          phone: string | null
          registration_request_id: string
          updated_at: string | null
        }
        Insert: {
          address: string
          benefit_group_key?: string
          branch_code?: string | null
          branch_key: string
          branch_type?: string
          campus_slugs?: string[]
          created_at?: string | null
          id?: string
          map_url?: string | null
          memo?: string | null
          name: string
          phone?: string | null
          registration_request_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          benefit_group_key?: string
          branch_code?: string | null
          branch_key?: string
          branch_type?: string
          campus_slugs?: string[]
          created_at?: string | null
          id?: string
          map_url?: string | null
          memo?: string | null
          name?: string
          phone?: string | null
          registration_request_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_registration_branches_registration_request_id_fkey"
            columns: ["registration_request_id"]
            isOneToOne: false
            referencedRelation: "partner_registration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_registration_requests: {
        Row: {
          admin_note: string | null
          benefit_action_link: string | null
          benefit_action_type: string
          benefit_items: Json
          benefit_verification_pin_hash: string | null
          benefit_verification_pin_salt: string | null
          benefits: string[]
          branch_scope_note: string | null
          branch_scope_type: string
          brand_name: string
          brand_phone: string | null
          category_id: string | null
          category_label: string
          company_description: string | null
          company_id: string | null
          company_name: string
          conditions: string[]
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          detail_description: string | null
          id: string
          image_urls: string[]
          inquiry_link: string | null
          location: string
          map_url: string | null
          memo: string | null
          period_end: string | null
          period_start: string | null
          registration_mode: string
          requested_by_partner_account_id: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          service_mode: string
          site_link: string | null
          source: string
          status: string
          tags: string[]
          thumbnail_url: string | null
          updated_at: string | null
          visibility: string
        }
        Insert: {
          admin_note?: string | null
          benefit_action_link?: string | null
          benefit_action_type: string
          benefit_items?: Json
          benefit_verification_pin_hash?: string | null
          benefit_verification_pin_salt?: string | null
          benefits?: string[]
          branch_scope_note?: string | null
          branch_scope_type?: string
          brand_name: string
          brand_phone?: string | null
          category_id?: string | null
          category_label: string
          company_description?: string | null
          company_id?: string | null
          company_name: string
          conditions?: string[]
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          detail_description?: string | null
          id?: string
          image_urls?: string[]
          inquiry_link?: string | null
          location: string
          map_url?: string | null
          memo?: string | null
          period_end?: string | null
          period_start?: string | null
          registration_mode?: string
          requested_by_partner_account_id?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_mode: string
          site_link?: string | null
          source?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          admin_note?: string | null
          benefit_action_link?: string | null
          benefit_action_type?: string
          benefit_items?: Json
          benefit_verification_pin_hash?: string | null
          benefit_verification_pin_salt?: string | null
          benefits?: string[]
          branch_scope_note?: string | null
          branch_scope_type?: string
          brand_name?: string
          brand_phone?: string | null
          category_id?: string | null
          category_label?: string
          company_description?: string | null
          company_id?: string | null
          company_name?: string
          conditions?: string[]
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          detail_description?: string | null
          id?: string
          image_urls?: string[]
          inquiry_link?: string | null
          location?: string
          map_url?: string | null
          memo?: string | null
          period_end?: string | null
          period_start?: string | null
          registration_mode?: string
          requested_by_partner_account_id?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_mode?: string
          site_link?: string | null
          source?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_registration_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_registration_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_registration_requests_requested_by_partner_account_fkey"
            columns: ["requested_by_partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_review_reactions: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          reaction: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          reaction: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          reaction?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_review_reactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_review_reactions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "partner_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_reviews: {
        Row: {
          body: string
          created_at: string | null
          deleted_at: string | null
          deleted_by_member_id: string | null
          hidden_at: string | null
          hidden_by_admin_id: string | null
          hidden_by_partner_account_id: string | null
          id: string
          images: string[]
          member_id: string
          partner_id: string
          rating: number
          title: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_member_id?: string | null
          hidden_at?: string | null
          hidden_by_admin_id?: string | null
          hidden_by_partner_account_id?: string | null
          id?: string
          images?: string[]
          member_id: string
          partner_id: string
          rating: number
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_member_id?: string | null
          hidden_at?: string | null
          hidden_by_admin_id?: string | null
          hidden_by_partner_account_id?: string | null
          id?: string
          images?: string[]
          member_id?: string
          partner_id?: string
          rating?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_reviews_deleted_by_member_id_fkey"
            columns: ["deleted_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_reviews_hidden_by_partner_account_id_fkey"
            columns: ["hidden_by_partner_account_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_reviews_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_reviews_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tax_documents: {
        Row: {
          business_address: string
          business_item: string
          business_name: string
          business_registration_number: string
          business_type: string
          cancelled_at: string | null
          created_at: string
          external_document_id: string | null
          failure_reason: string | null
          id: string
          invoice_id: string
          issued_at: string | null
          issued_by_admin_id: string | null
          provider: string
          representative_name: string
          sent_at: string | null
          status: string
          tax_invoice_email: string
          type: string
          updated_at: string
        }
        Insert: {
          business_address: string
          business_item: string
          business_name: string
          business_registration_number: string
          business_type: string
          cancelled_at?: string | null
          created_at?: string
          external_document_id?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id: string
          issued_at?: string | null
          issued_by_admin_id?: string | null
          provider?: string
          representative_name: string
          sent_at?: string | null
          status?: string
          tax_invoice_email: string
          type?: string
          updated_at?: string
        }
        Update: {
          business_address?: string
          business_item?: string
          business_name?: string
          business_registration_number?: string
          business_type?: string
          cancelled_at?: string | null
          created_at?: string
          external_document_id?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          issued_at?: string | null
          issued_by_admin_id?: string | null
          provider?: string
          representative_name?: string
          sent_at?: string | null
          status?: string
          tax_invoice_email?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tax_documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "partner_billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tax_documents_issued_by_admin_id_fkey"
            columns: ["issued_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          applies_to: string[]
          benefit_action_link: string | null
          benefit_action_type: string
          benefit_verification_pin_hash: string | null
          benefit_verification_pin_salt: string | null
          benefit_visibility: string
          benefits: string[]
          branch_scope_note: string | null
          branch_scope_type: string
          brand_profile_id: string | null
          campus_slugs: string[]
          category_id: string
          company_id: string | null
          conditions: string[]
          created_at: string | null
          detail_description: string | null
          id: string
          images: string[]
          inquiry_link: string | null
          location: string
          managed_campus_slugs: string[]
          map_url: string | null
          name: string
          period_end: string | null
          period_start: string | null
          plan_expires_at: string | null
          plan_started_at: string | null
          plan_tier: string
          plan_updated_at: string
          reservation_link: string | null
          tags: string[]
          thumbnail: string | null
          updated_at: string | null
          visibility: string
        }
        Insert: {
          applies_to?: string[]
          benefit_action_link?: string | null
          benefit_action_type?: string
          benefit_verification_pin_hash?: string | null
          benefit_verification_pin_salt?: string | null
          benefit_visibility?: string
          benefits?: string[]
          branch_scope_note?: string | null
          branch_scope_type?: string
          brand_profile_id?: string | null
          campus_slugs?: string[]
          category_id: string
          company_id?: string | null
          conditions?: string[]
          created_at?: string | null
          detail_description?: string | null
          id?: string
          images?: string[]
          inquiry_link?: string | null
          location: string
          managed_campus_slugs?: string[]
          map_url?: string | null
          name: string
          period_end?: string | null
          period_start?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_tier?: string
          plan_updated_at?: string
          reservation_link?: string | null
          tags?: string[]
          thumbnail?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          applies_to?: string[]
          benefit_action_link?: string | null
          benefit_action_type?: string
          benefit_verification_pin_hash?: string | null
          benefit_verification_pin_salt?: string | null
          benefit_visibility?: string
          benefits?: string[]
          branch_scope_note?: string | null
          branch_scope_type?: string
          brand_profile_id?: string | null
          campus_slugs?: string[]
          category_id?: string
          company_id?: string | null
          conditions?: string[]
          created_at?: string | null
          detail_description?: string | null
          id?: string
          images?: string[]
          inquiry_link?: string | null
          location?: string
          managed_campus_slugs?: string[]
          map_url?: string | null
          name?: string
          period_end?: string | null
          period_start?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          plan_tier?: string
          plan_updated_at?: string
          reservation_link?: string | null
          tags?: string[]
          thumbnail?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "partner_brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      platform_active_identities: {
        Row: {
          activity_date: string
          created_at: string
          first_event_at: string
          identity_hash: string
          identity_kind: string
          last_event_at: string
          updated_at: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          first_event_at: string
          identity_hash: string
          identity_kind: string
          last_event_at: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          first_event_at?: string
          identity_hash?: string
          identity_kind?: string
          last_event_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_documents: {
        Row: {
          content: string
          created_at: string | null
          effective_at: string
          id: string
          is_active: boolean
          kind: string
          summary: string | null
          title: string
          updated_at: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind: string
          summary?: string | null
          title: string
          updated_at?: string | null
          version: number
        }
        Update: {
          content?: string
          created_at?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          summary?: string | null
          title?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      promotion_events: {
        Row: {
          conditions: Json
          created_at: string
          description: string
          ends_at: string
          hero_image_alt: string
          hero_image_src: string
          id: string
          is_active: boolean
          page_path: string
          period_label: string
          rules: Json
          short_title: string
          slug: string
          starts_at: string
          target_audiences: string[]
          title: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          description: string
          ends_at: string
          hero_image_alt: string
          hero_image_src: string
          id?: string
          is_active?: boolean
          page_path?: string
          period_label: string
          rules?: Json
          short_title: string
          slug: string
          starts_at: string
          target_audiences?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string
          ends_at?: string
          hero_image_alt?: string
          hero_image_src?: string
          id?: string
          is_active?: boolean
          page_path?: string
          period_label?: string
          rules?: Json
          short_title?: string
          slug?: string
          starts_at?: string
          target_audiences?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotion_slides: {
        Row: {
          ad_campaign_id: string | null
          allowed_campuses: string[]
          allowed_years: number[]
          audiences: string[]
          created_at: string
          display_order: number
          event_slug: string | null
          href: string
          id: string
          image_alt: string
          image_src: string
          is_active: boolean
          requires_login: boolean
          sponsor_label: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          ad_campaign_id?: string | null
          allowed_campuses?: string[]
          allowed_years?: number[]
          audiences?: string[]
          created_at?: string
          display_order: number
          event_slug?: string | null
          href: string
          id?: string
          image_alt: string
          image_src: string
          is_active?: boolean
          requires_login?: boolean
          sponsor_label?: string
          subtitle: string
          title: string
          updated_at?: string
        }
        Update: {
          ad_campaign_id?: string | null
          allowed_campuses?: string[]
          allowed_years?: number[]
          audiences?: string[]
          created_at?: string
          display_order?: number
          event_slug?: string | null
          href?: string
          id?: string
          image_alt?: string
          image_src?: string
          is_active?: boolean
          requires_login?: boolean
          sponsor_label?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_slides_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_slides_event_slug_fkey"
            columns: ["event_slug"]
            isOneToOne: false
            referencedRelation: "promotion_events"
            referencedColumns: ["slug"]
          },
        ]
      }
      public_cache_versions: {
        Row: {
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          scope: string
          updated_at?: string
          version?: number
        }
        Update: {
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      push_delivery_logs: {
        Row: {
          body: string
          created_at: string | null
          error_message: string | null
          id: string
          member_id: string | null
          message_log_id: string | null
          status: string
          subscription_id: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          message_log_id?: string | null
          status: string
          subscription_id?: string | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          message_log_id?: string | null
          status?: string
          subscription_id?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_delivery_logs_message_log_id_fkey"
            columns: ["message_log_id"]
            isOneToOne: false
            referencedRelation: "push_message_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_delivery_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_message_logs: {
        Row: {
          body: string
          completed_at: string | null
          created_at: string | null
          delivered: number
          failed: number
          id: string
          source: string
          status: string
          target_campus: string | null
          target_label: string
          target_member_id: string | null
          target_scope: string
          target_year: number | null
          targeted: number
          title: string
          type: string
          url: string | null
        }
        Insert: {
          body: string
          completed_at?: string | null
          created_at?: string | null
          delivered?: number
          failed?: number
          id?: string
          source?: string
          status?: string
          target_campus?: string | null
          target_label?: string
          target_member_id?: string | null
          target_scope?: string
          target_year?: number | null
          targeted?: number
          title: string
          type: string
          url?: string | null
        }
        Update: {
          body?: string
          completed_at?: string | null
          created_at?: string | null
          delivered?: number
          failed?: number
          id?: string
          source?: string
          status?: string
          target_campus?: string | null
          target_label?: string
          target_member_id?: string | null
          target_scope?: string
          target_year?: number | null
          targeted?: number
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_message_logs_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      push_preferences: {
        Row: {
          announcement_enabled: boolean
          created_at: string | null
          enabled: boolean
          expiring_partner_enabled: boolean
          marketing_enabled: boolean
          member_id: string
          mm_enabled: boolean
          new_partner_enabled: boolean
          review_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          announcement_enabled?: boolean
          created_at?: string | null
          enabled?: boolean
          expiring_partner_enabled?: boolean
          marketing_enabled?: boolean
          member_id: string
          mm_enabled?: boolean
          new_partner_enabled?: boolean
          review_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          announcement_enabled?: boolean
          created_at?: string | null
          enabled?: boolean
          expiring_partner_enabled?: boolean
          marketing_enabled?: boolean
          member_id?: string
          mm_enabled?: boolean
          new_partner_enabled?: boolean
          review_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          expiration_time: string | null
          failure_reason: string | null
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_success_at: string | null
          member_id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          member_id: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          expiration_time?: string | null
          failure_reason?: string | null
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_success_at?: string | null
          member_id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_candidate_exclusions: {
        Row: {
          candidate_group: string
          created_at: string
          event_id: string
          excluded_by_admin_id: string | null
          id: string
          member_id: string | null
          project_id: string | null
          reason: string
          restored_at: string | null
          restored_by_admin_id: string | null
        }
        Insert: {
          candidate_group: string
          created_at?: string
          event_id: string
          excluded_by_admin_id?: string | null
          id?: string
          member_id?: string | null
          project_id?: string | null
          reason: string
          restored_at?: string | null
          restored_by_admin_id?: string | null
        }
        Update: {
          candidate_group?: string
          created_at?: string
          event_id?: string
          excluded_by_admin_id?: string | null
          id?: string
          member_id?: string | null
          project_id?: string | null
          reason?: string
          restored_at?: string | null
          restored_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_candidate_exclusions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_candidate_exclusions_excluded_by_admin_id_fkey"
            columns: ["excluded_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_candidate_exclusions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_candidate_exclusions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_candidate_exclusions_restored_by_admin_id_fkey"
            columns: ["restored_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_draws: {
        Row: {
          admin_id: string | null
          candidate_count: number
          candidate_group: string
          created_at: string
          draw_kind: string
          event_id: string
          id: string
          replaces_winner_id: string | null
          requested_count: number
          ticket_count: number
        }
        Insert: {
          admin_id?: string | null
          candidate_count: number
          candidate_group: string
          created_at?: string
          draw_kind: string
          event_id: string
          id?: string
          replaces_winner_id?: string | null
          requested_count: number
          ticket_count: number
        }
        Update: {
          admin_id?: string | null
          candidate_count?: number
          candidate_group?: string
          created_at?: string
          draw_kind?: string
          event_id?: string
          id?: string
          replaces_winner_id?: string | null
          requested_count?: number
          ticket_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "showcase_draws_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_draws_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_draws_replaces_winner_fkey"
            columns: ["replaces_winner_id"]
            isOneToOne: false
            referencedRelation: "showcase_winners"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_events: {
        Row: {
          announcement_end_at: string | null
          announcement_start_at: string | null
          created_at: string
          description: string
          experience_end_at: string | null
          experience_start_at: string | null
          experiencer_selection_count: number
          hero_image_src: string
          id: string
          is_active: boolean
          purged_at: string | null
          settled_at: string | null
          settled_by_admin_id: string | null
          slug: string
          submission_end_at: string | null
          submission_start_at: string | null
          submitter_selection_count: number
          title: string
          updated_at: string
        }
        Insert: {
          announcement_end_at?: string | null
          announcement_start_at?: string | null
          created_at?: string
          description?: string
          experience_end_at?: string | null
          experience_start_at?: string | null
          experiencer_selection_count?: number
          hero_image_src?: string
          id?: string
          is_active?: boolean
          purged_at?: string | null
          settled_at?: string | null
          settled_by_admin_id?: string | null
          slug: string
          submission_end_at?: string | null
          submission_start_at?: string | null
          submitter_selection_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          announcement_end_at?: string | null
          announcement_start_at?: string | null
          created_at?: string
          description?: string
          experience_end_at?: string | null
          experience_start_at?: string | null
          experiencer_selection_count?: number
          hero_image_src?: string
          id?: string
          is_active?: boolean
          purged_at?: string | null
          settled_at?: string | null
          settled_by_admin_id?: string | null
          slug?: string
          submission_end_at?: string | null
          submission_start_at?: string | null
          submitter_selection_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_events_settled_by_admin_id_fkey"
            columns: ["settled_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_experiences: {
        Row: {
          event_id: string
          id: string
          member_id: string | null
          project_id: string
          started_at: string
        }
        Insert: {
          event_id: string
          id?: string
          member_id?: string | null
          project_id: string
          started_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          member_id?: string | null
          project_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_experiences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_experiences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_experiences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_feedback: {
        Row: {
          body: string
          created_at: string
          event_id: string
          hidden_at: string | null
          hidden_by_admin_id: string | null
          id: string
          member_id: string | null
          project_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          hidden_at?: string | null
          hidden_by_admin_id?: string | null
          id?: string
          member_id?: string | null
          project_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          hidden_at?: string | null
          hidden_by_admin_id?: string | null
          id?: string
          member_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_feedback_hidden_by_admin_id_fkey"
            columns: ["hidden_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_feedback_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_interests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          member_id: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          member_id?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_interests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_interests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_project_participants: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_owner: boolean
          name: string
          position: number
          project_id: string
          student_number: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_owner?: boolean
          name: string
          position: number
          project_id: string
          student_number: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_owner?: boolean
          name?: string
          position?: number
          project_id?: string
          student_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_project_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_project_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_project_views: {
        Row: {
          created_at: string
          event_id: string
          id: string
          member_id: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          member_id?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_project_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_project_views_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_project_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_projects: {
        Row: {
          allow_immediate_feedback: boolean
          announcement_consented_at: string
          created_at: string
          description: string
          event_id: string
          id: string
          image_upload_id: string | null
          image_url: string
          owner_member_id: string | null
          project_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          service_url: string
          status: string
          summary: string
          team_name: string | null
          title: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          allow_immediate_feedback?: boolean
          announcement_consented_at: string
          created_at?: string
          description: string
          event_id: string
          id?: string
          image_upload_id?: string | null
          image_url: string
          owner_member_id?: string | null
          project_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_url: string
          status?: string
          summary: string
          team_name?: string | null
          title: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          allow_immediate_feedback?: boolean
          announcement_consented_at?: string
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          image_upload_id?: string | null
          image_url?: string
          owner_member_id?: string | null
          project_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          service_url?: string
          status?: string
          summary?: string
          team_name?: string | null
          title?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_projects_image_upload_id_fkey"
            columns: ["image_upload_id"]
            isOneToOne: false
            referencedRelation: "image_upload_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_projects_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_projects_reviewed_by_admin_id_fkey"
            columns: ["reviewed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_registrations: {
        Row: {
          consented_at: string
          created_at: string
          event_id: string
          id: string
          member_id: string | null
          student_number: string | null
        }
        Insert: {
          consented_at: string
          created_at?: string
          event_id: string
          id?: string
          member_id?: string | null
          student_number?: string | null
        }
        Update: {
          consented_at?: string
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string | null
          student_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_winners: {
        Row: {
          candidate_group: string
          created_at: string
          delivered_at: string | null
          delivered_by_admin_id: string | null
          draw_id: string
          event_id: string
          id: string
          masked_name: string
          masked_student_number: string
          member_id: string | null
          position: number
          project_id: string | null
          project_title: string | null
          status: string
          void_reason: string | null
          voided_at: string | null
          voided_by_admin_id: string | null
        }
        Insert: {
          candidate_group: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_admin_id?: string | null
          draw_id: string
          event_id: string
          id?: string
          masked_name: string
          masked_student_number: string
          member_id?: string | null
          position: number
          project_id?: string | null
          project_title?: string | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_admin_id?: string | null
        }
        Update: {
          candidate_group?: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_admin_id?: string | null
          draw_id?: string
          event_id?: string
          id?: string
          masked_name?: string
          masked_student_number?: string
          member_id?: string | null
          position?: number
          project_id?: string | null
          project_title?: string | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_winners_delivered_by_admin_id_fkey"
            columns: ["delivered_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_winners_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "showcase_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_winners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_winners_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_winners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "showcase_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_winners_voided_by_admin_id_fkey"
            columns: ["voided_by_admin_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ssafy_cohort_card_themes: {
        Row: {
          accent_color: string
          background_from: string
          background_to: string
          background_via: string
          cohort_year: number
          created_at: string | null
          display_name: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color: string
          background_from: string
          background_to: string
          background_via: string
          cohort_year: number
          created_at?: string | null
          display_name?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string
          background_from?: string
          background_to?: string
          background_via?: string
          cohort_year?: number
          created_at?: string | null
          display_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ssafy_cycle_settings: {
        Row: {
          anchor_calendar_year: number
          anchor_month: number
          anchor_year: number
          created_at: string | null
          id: number
          manual_applied_at: string | null
          manual_current_year: number | null
          manual_member_mm_lookup_generations: number[]
          manual_reason: string | null
          updated_at: string | null
        }
        Insert: {
          anchor_calendar_year?: number
          anchor_month?: number
          anchor_year?: number
          created_at?: string | null
          id?: number
          manual_applied_at?: string | null
          manual_current_year?: number | null
          manual_member_mm_lookup_generations?: number[]
          manual_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          anchor_calendar_year?: number
          anchor_month?: number
          anchor_year?: number
          created_at?: string | null
          id?: number
          manual_applied_at?: string | null
          manual_current_year?: number | null
          manual_member_mm_lookup_generations?: number[]
          manual_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suggestion_attempts: {
        Row: {
          blocked_until: string | null
          count: number
          created_at: string | null
          first_attempt_at: string
          id: string
          identifier: string
        }
        Insert: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier: string
        }
        Update: {
          blocked_until?: string | null
          count?: number
          created_at?: string | null
          first_attempt_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_mattermost_sender_candidate_with_audit: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_ip_address: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_sender_mm_user_id: string
          p_sender_username_hint: string
          p_test_target_kind: string
          p_user_agent: string
        }
        Returns: string
      }
      admin_create_showcase_project: {
        Args: {
          p_admin_id: string
          p_allow_immediate_feedback: boolean
          p_description: string
          p_event_id: string
          p_image_upload_id: string
          p_image_url: string
          p_owner_member_id: string
          p_project_id: string
          p_project_type: string
          p_review_note: string
          p_service_url: string
          p_status: string
          p_summary: string
          p_team_name: string
          p_title: string
        }
        Returns: string
      }
      admin_delete_showcase_project: {
        Args: { p_admin_id: string; p_project_id: string }
        Returns: {
          event_id: string
          owner_member_id: string
          project_id: string
          project_type: string
          title: string
        }[]
      }
      admin_update_showcase_project: {
        Args: {
          p_admin_id: string
          p_allow_immediate_feedback: boolean
          p_description: string
          p_event_id: string
          p_image_upload_id: string
          p_image_url: string
          p_project_id: string
          p_project_type: string
          p_review_note: string
          p_service_url: string
          p_status: string
          p_summary: string
          p_team_name: string
          p_title: string
        }
        Returns: string
      }
      anonymize_deleted_member: {
        Args: { p_member_id: string }
        Returns: boolean
      }
      apply_partner_metric_event: {
        Args: {
          input_actor_id?: string
          input_actor_type: string
          input_created_at?: string
          input_event_name: string
          input_partner_id: string
          input_session_id?: string
        }
        Returns: undefined
      }
      apply_partner_metric_event_rollups: {
        Args: {
          input_actor_id: string
          input_actor_type: string
          input_created_at?: string
          input_event_name: string
          input_partner_id: string
          input_session_id: string
        }
        Returns: undefined
      }
      approve_graduate_verification:
        | {
            Args: {
              p_admin_id: string
              p_document_number_hmac: string
              p_request_id: string
              p_setup_expires_at: string
              p_setup_token_hash: string
            }
            Returns: string
          }
        | {
            Args: {
              p_admin_id: string
              p_document_number_hmac: string
              p_existing_member_id: string
              p_request_id: string
              p_setup_expires_at: string
              p_setup_token_hash: string
            }
            Returns: string
          }
      approve_member_profile_image_replacement: {
        Args: { p_admin_id: string; p_image_id: string }
        Returns: string
      }
      approve_member_signup_approval_request: {
        Args: {
          p_admin_id: string
          p_campus: string
          p_display_name: string
          p_generation: number
          p_request_id: string
        }
        Returns: Json
      }
      approve_partner_plan_upgrade_request: {
        Args: {
          p_admin_id: string
          p_admin_note?: string
          p_request_id: string
          p_reviewed_at?: string
        }
        Returns: Json
      }
      archive_expired_promotions_batch: {
        Args: { input_limit?: number; input_now?: string }
        Returns: {
          archived_event_slugs: string[]
          archived_slide_count: number
        }[]
      }
      attach_notification_audience: {
        Args: {
          p_campus: string
          p_generation: number
          p_notification_id: string
          p_recipient_member_ids: string[]
          p_scope: string
        }
        Returns: number
      }
      attach_notification_recipients: {
        Args: { p_notification_id: string; p_recipient_member_ids: string[] }
        Returns: number
      }
      begin_member_email_login_transition: {
        Args: {
          p_candidate_email: string
          p_email_reservation_hash: string
          p_expires_at: string
          p_initiated_by_admin_id: string
          p_member_id: string
          p_reason: string
          p_token_hash: string
        }
        Returns: string
      }
      bump_public_cache_version: {
        Args: { cache_scope: string }
        Returns: undefined
      }
      cancel_partner_plan_upgrade_billing: {
        Args: {
          p_admin_id?: string
          p_admin_note?: string
          p_cancelled_at: string
          p_next_request_status: string
          p_request_id: string
        }
        Returns: Json
      }
      checkpoint_manual_member_import_member: {
        Args: {
          p_batch_id: string
          p_campus: string
          p_display_name: string
          p_email: string
          p_email_normalized: string
          p_expected_row_updated_at: string
          p_generation: number
          p_mattermost_account_id: string
          p_row_id: string
          p_staff_source_generation: number
        }
        Returns: {
          member_id: string
          row_updated_at: string
        }[]
      }
      claim_notification_campaign: {
        Args: {
          p_body: string
          p_created_by_member_id: string
          p_idempotency_key: string
          p_lease_seconds: number
          p_metadata: Json
          p_recipient_member_ids: string[]
          p_target_url: string
          p_title: string
          p_type: string
        }
        Returns: Json
      }
      claim_notification_delivery: {
        Args: {
          p_channel: string
          p_lease_seconds: number
          p_member_id: string
          p_notification_id: string
          p_provider: string
          p_provider_campaign_id: string
          p_provider_idempotency_key: string
        }
        Returns: Json
      }
      cleanup_image_upload_quota_windows: {
        Args: { p_before: string; p_limit?: number }
        Returns: number
      }
      complete_graduate_password_action: {
        Args: {
          p_password_hash: string
          p_password_salt: string
          p_token_hash: string
        }
        Returns: string
      }
      complete_manual_member_password_action: {
        Args: {
          p_password_hash: string
          p_password_salt: string
          p_token_hash: string
        }
        Returns: string
      }
      complete_member_email_recovery: {
        Args: {
          p_code_hash: string
          p_email_normalized: string
          p_email_reservation_hash: string
          p_member_id: string
        }
        Returns: Json
      }
      complete_member_email_verification: {
        Args: {
          p_code_hash: string
          p_email_normalized: string
          p_email_reservation_hash: string
          p_member_id: string
        }
        Returns: Json
      }
      complete_member_password_action: {
        Args: {
          p_password_hash: string
          p_password_salt: string
          p_token_hash: string
        }
        Returns: string
      }
      complete_member_password_action_with_delivery: {
        Args: {
          p_password_hash: string
          p_password_salt: string
          p_token_hash: string
        }
        Returns: Json
      }
      confirm_partner_plan_bank_transfer_payment: {
        Args: {
          p_admin_id: string
          p_confirmed_at: string
          p_request_id: string
          p_tax_document_status: string
        }
        Returns: Json
      }
      consume_mattermost_verification_code: {
        Args: {
          p_challenge_hash: string
          p_code_hash: string
          p_purpose: string
        }
        Returns: {
          mm_user_id: string
          sender_generation: number
          subject_generation: number
          verified: boolean
        }[]
      }
      create_partner_billing_profile_atomically: {
        Args: {
          p_account_id: string
          p_business_address: string
          p_business_item: string
          p_business_name: string
          p_business_registration_number: string
          p_business_type: string
          p_company_id: string
          p_label: string
          p_make_default: boolean
          p_payer_name: string
          p_representative_name: string
          p_tax_invoice_email: string
        }
        Returns: Json
      }
      create_partner_plan_upgrade_billing: {
        Args: {
          p_account_id: string
          p_billing_policy: string
          p_billing_profile_id: string
          p_company_id: string
          p_due_at: string
          p_expected_current_plan_tier: string
          p_expected_plan_updated_at: string
          p_invoice_number: string
          p_memo: string
          p_partner_id: string
          p_payer_name: string
          p_remaining_days: number
          p_requested_plan_tier: string
          p_service_period_end: string
          p_service_period_start: string
          p_supply_amount_krw: number
          p_total_amount_krw: number
          p_vat_amount_krw: number
        }
        Returns: Json
      }
      create_showcase_candidate_exclusion: {
        Args: {
          p_admin_id: string
          p_candidate_group: string
          p_event_id: string
          p_member_id: string
          p_project_id: string
          p_reason: string
        }
        Returns: string
      }
      create_showcase_draw: {
        Args: {
          p_admin_id: string
          p_candidate_count: number
          p_candidate_group: string
          p_draw_kind: string
          p_event_id: string
          p_replaces_winner_id: string
          p_requested_count: number
          p_ticket_count: number
          p_winners: Json
        }
        Returns: string
      }
      create_showcase_project: {
        Args: {
          p_description: string
          p_event_id: string
          p_image_upload_id: string
          p_image_url: string
          p_owner_member_id: string
          p_owner_name: string
          p_owner_student_number?: string
          p_project_id: string
          p_project_type: string
          p_service_url: string
          p_summary: string
          p_team_name: string
          p_teammates?: Json
          p_title: string
        }
        Returns: string
      }
      delete_pending_member_email_recovery_challenge: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      delete_pending_member_email_verification_challenge: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      disable_generation_mattermost_logins: {
        Args: { p_generation: number }
        Returns: number
      }
      disable_mattermost_sender_with_audit: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_generation_confirmation: number
          p_ip_address: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_user_agent: string
        }
        Returns: string
      }
      disable_member_mattermost_login: {
        Args: { p_member_id: string; p_reason: string }
        Returns: string
      }
      expire_pending_mattermost_sender_candidates: {
        Args: never
        Returns: number
      }
      expire_pending_member_signup_approval_requests: {
        Args: { p_limit?: number; p_now?: string }
        Returns: Json
      }
      finalize_notification_campaign: {
        Args: {
          p_attempt_token: string
          p_metadata: Json
          p_notification_id: string
        }
        Returns: boolean
      }
      get_active_mattermost_sender_credentials: {
        Args: { p_generation: number }
        Returns: {
          encrypted_auth_tag: string
          encrypted_ciphertext: string
          encrypted_nonce: string
          generation: number
          id: string
          key_version: number
          sender_mm_user_id: string
          sender_username_hint: string
        }[]
      }
      get_admin_ad_campaign_rollups: {
        Args: { input_partner_id?: string }
        Returns: {
          ad_push_sends: number
          campaign_id: string
          coupon_copies: number
          coupon_intent_count: number
          coupon_redemption_counts: Json
          coupon_redemptions: number
          coupon_views: number
          home_banner_clicks: number
        }[]
      }
      get_admin_dashboard_counts: {
        Args: never
        Returns: {
          account_count: number
          active_push_subscription_count: number
          audit_log_count: number
          category_count: number
          company_count: number
          member_count: number
          partner_count: number
          product_log_count: number
          review_count: number
          security_log_count: number
        }[]
      }
      get_admin_dashboard_home_snapshot: {
        Args: {
          input_admin_id: string
          input_include_brand_queues?: boolean
          input_include_graduate_verifications?: boolean
          input_include_notifications?: boolean
          input_include_profile_photos?: boolean
          input_include_signup_requests?: boolean
          input_managed_campus_slugs?: string[]
        }
        Returns: {
          account_count: number
          active_push_subscription_count: number
          audit_log_count: number
          category_count: number
          change_request_pending_count: number
          company_count: number
          graduate_verification_pending_count: number
          member_count: number
          partner_count: number
          plan_request_pending_count: number
          product_log_count: number
          profile_photo_pending_count: number
          registration_pending_count: number
          review_count: number
          security_log_count: number
          signup_request_pending_count: number
          unread_notification_count: number
        }[]
      }
      get_admin_forward_activity_metrics: {
        Args: { p_anchor_date?: string }
        Returns: {
          as_of_date: string
          daily_series: Json
          history_start_date: string
          mau_observed_through: string
          member_dau: number
          member_mau: number
          member_wau: number
          today_date: string
          wau_observed_through: string
        }[]
      }
      get_admin_logs_cursor_scoped: {
        Args: {
          input_actor?: string
          input_allowed_groups?: string[]
          input_cursor_created_at?: string
          input_cursor_id?: string
          input_end: string
          input_group?: string
          input_include_pii?: boolean
          input_name?: string
          input_page_size: number
          input_search?: string
          input_start: string
          input_status?: string
        }
        Returns: {
          actor_id: string
          actor_mm_username: string
          actor_name: string
          actor_type: string
          created_at: string
          group_name: string
          id: string
          identifier: string
          ip_address: string
          name: string
          path: string
          properties: Json
          referrer: string
          status: string
          target_id: string
          target_type: string
          total_count: number
        }[]
      }
      get_admin_logs_page: {
        Args: {
          input_actor?: string
          input_end: string
          input_group?: string
          input_name?: string
          input_page: number
          input_page_size: number
          input_search?: string
          input_start: string
          input_status?: string
        }
        Returns: {
          actor_id: string
          actor_mm_username: string
          actor_name: string
          actor_type: string
          created_at: string
          group_name: string
          id: string
          identifier: string
          ip_address: string
          name: string
          path: string
          properties: Json
          referrer: string
          status: string
          target_id: string
          target_type: string
          total_count: number
        }[]
      }
      get_admin_logs_page_scoped: {
        Args: {
          input_actor?: string
          input_allowed_groups?: string[]
          input_end: string
          input_group?: string
          input_include_pii?: boolean
          input_name?: string
          input_page: number
          input_page_size: number
          input_search?: string
          input_start: string
          input_status?: string
        }
        Returns: {
          actor_id: string
          actor_mm_username: string
          actor_name: string
          actor_type: string
          created_at: string
          group_name: string
          id: string
          identifier: string
          ip_address: string
          name: string
          path: string
          properties: Json
          referrer: string
          status: string
          target_id: string
          target_type: string
          total_count: number
        }[]
      }
      get_admin_logs_summary: {
        Args: {
          input_bucket_ms: number
          input_end: string
          input_start: string
        }
        Returns: Json
      }
      get_admin_logs_summary_scoped: {
        Args: {
          input_allowed_groups?: string[]
          input_bucket_ms: number
          input_end: string
          input_include_pii?: boolean
          input_start: string
        }
        Returns: Json
      }
      get_admin_member_filter_options: {
        Args: never
        Returns: {
          campuses: string[]
          generations: number[]
        }[]
      }
      get_admin_member_list_page: {
        Args: {
          input_announcement_enabled?: string
          input_campus?: string
          input_expiring_partner_enabled?: string
          input_generation?: number
          input_marketing_consent?: string
          input_marketing_enabled?: string
          input_marketing_policy_id?: string
          input_mattermost_lifecycle?: string
          input_mm_enabled?: string
          input_new_partner_enabled?: string
          input_offset?: number
          input_page_size?: number
          input_password_status?: string
          input_privacy_consent?: string
          input_privacy_policy_id?: string
          input_push_enabled?: string
          input_review_enabled?: string
          input_search_pattern?: string
          input_service_consent?: string
          input_service_policy_id?: string
          input_sort?: string
          input_trend_limit?: number
        }
        Returns: {
          member_ids: string[]
          total_count: number
          trend_created_ats: string[]
        }[]
      }
      get_admin_partner_audit_logs: {
        Args: {
          input_company_property_id: string
          input_company_target_id: string
          input_partner_id: string
        }
        Returns: {
          action: string
          actor_id: string
          created_at: string
          id: string
          properties: Json
          target_id: string
          target_type: string
        }[]
      }
      get_admin_partner_registration_request_page: {
        Args: {
          input_managed_campus_slugs?: string[]
          input_page?: number
          input_page_size?: number
          input_search?: string
          input_sort?: string
          input_source?: string
          input_status?: string
          input_visibility?: string
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      get_admin_platform_activity_metrics: {
        Args: never
        Returns: {
          as_of_date: string
          daily_series: Json
          guest_session_dau: number
          guest_session_mau: number
          guest_session_wau: number
          history_start_date: string
          member_dau: number
          member_mau: number
          member_wau: number
        }[]
      }
      get_admin_prefetch_dimension_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          requested_count: number
          route_key: string
          used_count: number
          utilization_rate: number
          viewport: string
        }[]
      }
      get_admin_prefetch_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          requested_count: number
          route_key: string
          used_count: number
          utilization_rate: number
        }[]
      }
      get_admin_push_audience_facets: { Args: never; Returns: Json }
      get_admin_review_counts: {
        Args: never
        Returns: {
          hidden_count: number
          total_count: number
          visible_count: number
        }[]
      }
      get_admin_route_timing_dimension_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          complete_count: number
          error_count: number
          p75_duration_ms: number
          route_key: string
          sample_count: number
          unknown_count: number
          viewport: string
        }[]
      }
      get_admin_route_timing_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          complete_count: number
          error_count: number
          p75_duration_ms: number
          route_key: string
          sample_count: number
          unknown_count: number
        }[]
      }
      get_admin_session_snapshot: {
        Args: { p_member_id: string }
        Returns: Json
      }
      get_admin_task_inbox_counts: {
        Args: {
          input_admin_id: string
          input_include_brand_queues?: boolean
          input_include_graduate_verifications?: boolean
          input_include_notifications?: boolean
          input_include_profile_photos?: boolean
          input_include_signup_requests?: boolean
          input_managed_campus_slugs?: string[]
        }
        Returns: {
          change_request_pending_count: number
          graduate_verification_pending_count: number
          profile_photo_pending_count: number
          registration_pending_count: number
          signup_request_pending_count: number
          unread_notification_count: number
        }[]
      }
      get_admin_task_outcome_dimension_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          complete_count: number
          completion_rate: number
          p75_duration_ms: number
          recovery_count: number
          recovery_rate: number
          start_count: number
          task_key: string
          viewport: string
        }[]
      }
      get_admin_task_outcome_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          complete_count: number
          completion_rate: number
          p75_duration_ms: number
          recovery_count: number
          recovery_rate: number
          start_count: number
          task_key: string
        }[]
      }
      get_admin_web_vitals_dimension_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          good_count: number
          metric: string
          needs_improvement_count: number
          p75_value: number
          poor_count: number
          sample_count: number
          viewport: string
        }[]
      }
      get_admin_web_vitals_summary: {
        Args: { input_end: string; input_start: string }
        Returns: {
          good_count: number
          metric: string
          needs_improvement_count: number
          p75_value: number
          poor_count: number
          sample_count: number
        }[]
      }
      get_deleted_member_anonymization_storage_plan: {
        Args: { p_member_id: string }
        Returns: {
          certificate_paths: string[]
          profile_image_paths: string[]
        }[]
      }
      get_mattermost_sender_candidate_for_test: {
        Args: { p_candidate_id: string }
        Returns: {
          encrypted_auth_tag: string
          encrypted_ciphertext: string
          encrypted_nonce: string
          generation: number
          id: string
          key_version: number
          login_id_hint: string
          status: string
        }[]
      }
      get_mattermost_sender_test_context: {
        Args: { p_admin_member_id: string; p_generation: number }
        Returns: {
          previous_generation_sender_user_id: string
          super_admin_mattermost_user_id: string
        }[]
      }
      get_member_visible_review_count_in_range: {
        Args: {
          input_end: string
          input_member_id: string
          input_start: string
        }
        Returns: number
      }
      get_partner_engagement_counts: {
        Args: { input_partner_ids: string[] }
        Returns: {
          favorite_count: number
          partner_id: string
          review_count: number
        }[]
      }
      get_partner_favorite_counts: {
        Args: { input_partner_ids: string[] }
        Returns: {
          favorite_count: number
          partner_id: string
        }[]
      }
      get_partner_review_counts: {
        Args: { input_partner_ids: string[] }
        Returns: {
          partner_id: string
          review_count: number
        }[]
      }
      get_partner_review_summary: {
        Args: {
          input_images_only?: boolean
          input_partner_id: string
          input_rating?: number
        }
        Returns: {
          average_rating: number
          rating_1_count: number
          rating_2_count: number
          rating_3_count: number
          rating_4_count: number
          rating_5_count: number
          total_count: number
        }[]
      }
      get_partner_review_visibility_counts: {
        Args: { input_partner_id: string }
        Returns: {
          hidden_count: number
          total_count: number
          visible_count: number
        }[]
      }
      get_showcase_admin_metrics: {
        Args: { p_event_id: string }
        Returns: {
          active_winners: number
          completed_draws: number
          project_stats: Json
          registered_experiencers: number
          status_counts: Json
          total_experience_starts: number
          total_interests: number
          total_unique_views: number
          total_valid_experiences: number
          type_counts: Json
        }[]
      }
      get_showcase_project_counts: {
        Args: { p_event_id: string }
        Returns: {
          experience_count: number
          interest_count: number
          project_id: string
          valid_experience_count: number
          view_count: number
        }[]
      }
      infer_partner_campus_slugs: {
        Args: { input_location: string }
        Returns: string[]
      }
      ingest_product_event: {
        Args: {
          input_actor_id: string
          input_actor_type: string
          input_event_id: string
          input_event_name: string
          input_ip_address: string
          input_occurred_at: string
          input_path: string
          input_properties: Json
          input_referrer: string
          input_request_id: string
          input_schema_version: number
          input_session_id: string
          input_target_id: string
          input_target_type: string
          input_user_agent: string
        }
        Returns: boolean
      }
      is_partner_metric_event: {
        Args: { event_name: string }
        Returns: boolean
      }
      issue_ad_coupon: {
        Args: {
          p_coupon_id: string
          p_member_id: string
          p_session_id?: string
        }
        Returns: {
          assigned_code: string
          coupon_id: string
          description_snapshot: string
          discount_label_snapshot: string
          external_url_snapshot: string
          issue_id: string
          issued_at: string
          member_id: string
          redemption_type_snapshot: string
          terms_snapshot: string[]
          title_snapshot: string
          usage_ends_at: string
          usage_starts_at: string
        }[]
      }
      issue_admin_member_password_action: {
        Args: {
          p_delivery_channel: string
          p_expected_email: string
          p_expires_at: string
          p_member_id: string
          p_purpose: string
          p_token_hash: string
        }
        Returns: string
      }
      issue_graduate_password_reset: {
        Args: {
          p_challenge_id: string
          p_expires_at: string
          p_token_hash: string
        }
        Returns: string
      }
      issue_member_wallet_pass: {
        Args: {
          p_consent_version: number
          p_consented_at: string
          p_idempotency_key: string
          p_member_id: string
          p_platform: string
          p_request_fingerprint: string
          p_snapshot: Json
          p_snapshot_hash: string
        }
        Returns: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          installation_status: string
          is_new_pass: boolean
          is_new_revision: boolean
          issued_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          operation_created: boolean
          pass_id: string
          platform: string
          public_id: string
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      list_active_mattermost_sender_credentials_for_health_check: {
        Args: never
        Returns: {
          encrypted_auth_tag: string
          encrypted_ciphertext: string
          encrypted_nonce: string
          generation: number
          id: string
          key_version: number
          sender_mm_user_id: string
          sender_username_hint: string
        }[]
      }
      list_mattermost_sender_metadata: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          generation: number
          health_blocked_until: string
          health_checked_at: string
          health_failure_count: number
          health_last_error_code: string
          health_status: string
          id: string
          last_error_code: string
          last_test_target_kind: string
          last_tested_at: string
          login_id_hint: string
          sender_username_hint: string
          status: string
          updated_at: string
          verified_at: string
        }[]
      }
      list_showcase_admin_activity: {
        Args: {
          p_activity_type?: string
          p_before_at?: string
          p_before_id?: string
          p_event_id: string
          p_limit?: number
        }
        Returns: {
          activity_id: string
          activity_type: string
          actor_type: string
          details: Json
          occurred_at: string
          project_id: string
          project_title: string
        }[]
      }
      list_updated_apple_wallet_passes: {
        Args: {
          p_device_library_identifier_hash: string
          p_limit?: number
          p_updated_since?: string
        }
        Returns: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          installation_status: string
          issued_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          pass_id: string
          platform: string
          public_id: string
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      log_retention_hold_active: {
        Args: { p_log_group: string; p_recorded_at: string }
        Returns: boolean
      }
      mark_mattermost_verification_code_delivery: {
        Args: { p_code_id: string; p_error_code?: string; p_sent: boolean }
        Returns: boolean
      }
      mark_member_email_login_transition_sent: {
        Args: { p_token_id: string }
        Returns: undefined
      }
      mark_member_email_recovery_challenge_sent: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      mark_member_email_verification_challenge_sent: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      partner_metric_visitor_key: {
        Args: { actor_id: string; actor_type: string; session_id: string }
        Returns: string
      }
      platform_activity_identity_key: {
        Args: {
          input_actor_id: string
          input_actor_type: string
          input_session_id: string
        }
        Returns: {
          identity_hash: string
          identity_kind: string
        }[]
      }
      process_partner_billing_overdue_downgrades: {
        Args: { p_limit?: number; p_now: string }
        Returns: Json
      }
      purge_deleted_member_wallet_data_for_anonymization: {
        Args: { p_member_id: string }
        Returns: boolean
      }
      purge_expired_operational_logs: {
        Args: { input_cutoff?: string }
        Returns: Json
      }
      purge_showcase_personal_data: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      reconcile_member_wallet_pass_content: {
        Args: {
          p_action: string
          p_changed_at?: string
          p_pass_id: string
          p_snapshot?: Json
          p_snapshot_hash?: string
        }
        Returns: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          installation_status: string
          issued_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          pass_id: string
          platform: string
          public_id: string
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      reconcile_partner_metric_rollups: {
        Args: { input_partner_id: string }
        Returns: undefined
      }
      record_mattermost_sender_health_failure: {
        Args: { p_error_code: string; p_sender_id: string }
        Returns: undefined
      }
      record_mattermost_sender_health_success: {
        Args: { p_sender_id: string }
        Returns: undefined
      }
      record_mattermost_sender_test_failure_with_audit: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_error_code: string
          p_ip_address: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_user_agent: string
        }
        Returns: undefined
      }
      record_partner_benefit_usage: {
        Args: {
          p_benefit_id: string
          p_idempotency_key: string
          p_member_id: string
          p_metadata?: Json
          p_partner_id: string
          p_use_count: number
        }
        Returns: {
          benefit_id: string
          benefit_snapshot: string
          created_at: string
          is_new: boolean
          member_id: string
          partner_id: string
          usage_id: string
          use_count: number
          verified_at: string
        }[]
      }
      record_rate_limit_attempt: {
        Args: {
          p_block_ms: number
          p_identifier: string
          p_max_attempts: number
          p_success: boolean
          p_table_name: string
          p_window_ms: number
        }
        Returns: undefined
      }
      record_showcase_project_view: {
        Args: { p_member_id: string; p_project_id: string }
        Returns: boolean
      }
      redeem_ad_coupon_issue: {
        Args: {
          p_issue_id: string
          p_member_id: string
          p_metadata?: Json
          p_session_id?: string
          p_verified_onsite_password_hash?: string
        }
        Returns: {
          assigned_code: string
          coupon_id: string
          issue_id: string
        }[]
      }
      register_apple_wallet_device: {
        Args: {
          p_device_library_identifier_hash: string
          p_public_id: string
          p_push_token_auth_tag: string
          p_push_token_ciphertext: string
          p_push_token_iv: string
          p_push_token_key_version: number
        }
        Returns: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          device_library_identifier_hash: string
          installation_status: string
          is_new_registration: boolean
          issued_at: string
          last_registered_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          pass_id: string
          platform: string
          public_id: string
          push_token_auth_tag: string
          push_token_ciphertext: string
          push_token_iv: string
          push_token_key_version: number
          registration_created_at: string
          registration_id: string
          registration_updated_at: string
          removed_at: string
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      register_showcase_participant: {
        Args: {
          p_event_id: string
          p_member_id: string
          p_student_number?: string
        }
        Returns: undefined
      }
      reissue_graduate_initial_setup: {
        Args: {
          p_request_id: string
          p_setup_expires_at: string
          p_setup_token_hash: string
        }
        Returns: string
      }
      reissue_manual_member_initial_setup: {
        Args: {
          p_delivery_channel: string
          p_expires_at: string
          p_member_id: string
          p_token_hash: string
        }
        Returns: string
      }
      reject_member_active_profile_photo: {
        Args: { p_admin_id: string; p_member_id: string; p_reason: string }
        Returns: string
      }
      reject_member_profile_image_replacement: {
        Args: { p_admin_id: string; p_image_id: string; p_reason: string }
        Returns: string
      }
      reject_member_signup_approval_request: {
        Args: { p_admin_id: string; p_reason: string; p_request_id: string }
        Returns: Json
      }
      reserve_image_upload_sessions: {
        Args: {
          p_owner_id: string
          p_owner_kind: string
          p_purpose: string
          p_quota_identifiers: string[]
          p_sessions: Json
        }
        Returns: number
      }
      reserve_mattermost_verification_code: {
        Args: {
          p_challenge_hash: string
          p_code_hash: string
          p_expires_at: string
          p_mm_user_id: string
          p_purpose: string
          p_request_key_hash: string
          p_resend_available_at: string
          p_sender_generation: number
          p_subject_generation: number
        }
        Returns: {
          accepted: boolean
          code_id: string
        }[]
      }
      reserve_member_email_recovery_challenge: {
        Args: {
          p_code_hash: string
          p_email_normalized: string
          p_expires_at: string
          p_member_id: string
          p_resend_available_at: string
        }
        Returns: {
          accepted: boolean
          challenge_id: string
          retry_after_seconds: number
        }[]
      }
      reserve_member_email_verification_challenge: {
        Args: {
          p_code_hash: string
          p_email_normalized: string
          p_expires_at: string
          p_member_id: string
          p_resend_available_at: string
        }
        Returns: {
          accepted: boolean
          challenge_id: string
          retry_after_seconds: number
        }[]
      }
      resolve_partner_change_request_with_audit: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_admin_id: string
          p_change_request_id: string
          p_decision: string
          p_ip_address: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_user_agent: string
        }
        Returns: string
      }
      restore_showcase_candidate_exclusion: {
        Args: { p_admin_id: string; p_exclusion_id: string }
        Returns: undefined
      }
      review_showcase_project: {
        Args: {
          p_admin_id: string
          p_project_id: string
          p_review_note: string
          p_status: string
        }
        Returns: undefined
      }
      revoke_deleted_member_wallet_passes: {
        Args: { p_changed_at?: string; p_member_id: string }
        Returns: number
      }
      revoke_member_wallet_pass: {
        Args: {
          p_idempotency_key: string
          p_member_id: string
          p_platform: string
          p_reason: string
          p_request_fingerprint: string
        }
        Returns: {
          already_revoked: boolean
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          installation_status: string
          issued_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          operation_created: boolean
          pass_id: string
          platform: string
          public_id: string
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      save_mattermost_sender_candidate_with_audit: {
        Args: {
          p_actor_id: string
          p_auth_tag: string
          p_ciphertext: string
          p_generation: number
          p_ip_address: string
          p_key_version: number
          p_login_id_hint: string
          p_nonce: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_user_agent: string
        }
        Returns: string
      }
      set_partner_billing_profile_default: {
        Args: {
          p_account_id: string
          p_company_id: string
          p_profile_id: string
        }
        Returns: undefined
      }
      set_showcase_feedback_hidden: {
        Args: { p_admin_id: string; p_feedback_id: string; p_hidden: boolean }
        Returns: undefined
      }
      set_showcase_interest: {
        Args: {
          p_interested: boolean
          p_member_id: string
          p_project_id: string
        }
        Returns: boolean
      }
      set_showcase_project_immediate_feedback: {
        Args: { p_allowed: boolean; p_project_id: string }
        Returns: undefined
      }
      set_showcase_winner_delivered: {
        Args: { p_admin_id: string; p_delivered: boolean; p_winner_id: string }
        Returns: undefined
      }
      settle_showcase_event: {
        Args: { p_admin_id: string; p_event_id: string }
        Returns: string
      }
      showcase_assert_draw_open: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      showcase_assert_experience_open: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      showcase_assert_submission_open: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      showcase_open_project: {
        Args: { p_project_id: string }
        Returns: {
          allow_immediate_feedback: boolean
          announcement_consented_at: string
          created_at: string
          description: string
          event_id: string
          id: string
          image_upload_id: string | null
          image_url: string
          owner_member_id: string | null
          project_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          service_url: string
          status: string
          summary: string
          team_name: string | null
          title: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "showcase_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      showcase_replace_participants: {
        Args: {
          p_event_id: string
          p_owner_name: string
          p_owner_student_number: string
          p_project_id: string
          p_teammates: Json
        }
        Returns: undefined
      }
      soft_delete_member: {
        Args: { p_identifier_reservations: Json; p_member_id: string }
        Returns: boolean
      }
      start_showcase_experience: {
        Args: { p_member_id: string; p_project_id: string }
        Returns: string
      }
      submit_showcase_feedback: {
        Args: { p_body: string; p_member_id: string; p_project_id: string }
        Returns: undefined
      }
      transition_notification_delivery: {
        Args: {
          p_delivery_id: string
          p_error_message?: string
          p_transition: string
        }
        Returns: boolean
      }
      unregister_apple_wallet_device: {
        Args: { p_device_library_identifier_hash: string; p_public_id: string }
        Returns: {
          consent_version: number
          consented_at: string
          created_at: string
          credential_status: string
          current_revision: number
          current_snapshot: Json
          current_snapshot_hash: string
          installation_status: string
          issued_at: string
          last_sync_attempted_at: string
          last_sync_error_at: string
          last_sync_error_code: string
          last_synced_at: string
          member_id: string
          pass_id: string
          platform: string
          public_id: string
          removed: boolean
          revoked_at: string
          serial_number: string
          sync_status: string
          updated_at: string
        }[]
      }
      update_member_mattermost_password_credentials: {
        Args: {
          p_expected_mattermost_account_id: string
          p_expected_updated_at: string
          p_member_id: string
          p_password_hash: string
          p_password_salt: string
        }
        Returns: string
      }
      update_member_password_credentials: {
        Args: {
          p_member_id: string
          p_password_hash: string
          p_password_salt: string
        }
        Returns: string
      }
      update_member_push_preferences_atomic: {
        Args: {
          input_announcement_enabled: boolean
          input_enabled: boolean
          input_expiring_partner_enabled: boolean
          input_ip_address: string
          input_marketing_enabled: boolean
          input_member_id: string
          input_mm_enabled: boolean
          input_new_partner_enabled: boolean
          input_review_enabled: boolean
          input_user_agent: string
        }
        Returns: {
          announcement_enabled: boolean
          enabled: boolean
          expiring_partner_enabled: boolean
          marketing_enabled: boolean
          mm_enabled: boolean
          new_partner_enabled: boolean
          review_enabled: boolean
        }[]
      }
      update_partner_brand_plan_by_admin: {
        Args: {
          p_actor_admin_id?: string
          p_expected_plan_tier: string
          p_expected_plan_updated_at: string
          p_next_plan_tier: string
          p_note?: string
          p_partner_id: string
          p_plan_expires_at: string
          p_plan_started_at: string
          p_updated_at?: string
        }
        Returns: Json
      }
      update_partner_immediate_fields_with_audit: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_benefit_action_link: string
          p_benefit_action_type: string
          p_benefit_items: Json
          p_company_ids: string[]
          p_images: string[]
          p_inquiry_link: string
          p_ip_address: string
          p_partner_id: string
          p_path: string
          p_properties: Json
          p_request_id: string
          p_reservation_link: string
          p_tags: string[]
          p_thumbnail: string
          p_user_agent: string
        }
        Returns: {
          company_id: string
          previous_images: string[]
          previous_thumbnail: string
        }[]
      }
      update_partner_with_benefits_atomic: {
        Args: {
          p_benefits: Json
          p_expected_updated_at: string
          p_partner: Json
          p_partner_id: string
        }
        Returns: string
      }
      update_showcase_project: {
        Args: {
          p_description: string
          p_image_upload_id: string
          p_image_url: string
          p_owner_member_id: string
          p_owner_name: string
          p_owner_student_number?: string
          p_project_id: string
          p_project_type: string
          p_service_url: string
          p_summary: string
          p_team_name: string
          p_teammates?: Json
          p_title: string
        }
        Returns: undefined
      }
      void_showcase_winner: {
        Args: { p_admin_id: string; p_reason: string; p_winner_id: string }
        Returns: undefined
      }
      withdraw_showcase_project: {
        Args: { p_owner_member_id: string; p_project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

