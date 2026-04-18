export type MockPreviewMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  year: number;
  staff_source_year?: number | null;
  campus: string | null;
  must_change_password: boolean;
  service_policy_version?: number | null;
  service_policy_consented_at?: string | null;
  privacy_policy_version?: number | null;
  privacy_policy_consented_at?: string | null;
  marketing_policy_version?: number | null;
  marketing_policy_consented_at?: string | null;
  notification_preferences?: {
    enabled: boolean;
    announcementEnabled: boolean;
    newPartnerEnabled: boolean;
    expiringPartnerEnabled: boolean;
    reviewEnabled: boolean;
    mmEnabled: boolean;
    marketingEnabled: boolean;
    activeDeviceCount?: number;
  };
  consent_history?: Array<{
    kind: "service" | "privacy" | "marketing";
    version: number;
    agreed_at: string;
    title?: string | null;
    effective_at?: string | null;
  }>;
  avatar_content_type: string | null;
  avatar_base64: string | null;
  created_at: string;
  updated_at: string;
};

export const mockPreviewMembers: MockPreviewMember[] = [
  {
    id: "mock-staff-1",
    mm_user_id: "mm-staff-1",
    mm_username: "byeongchan.son",
    display_name: "손병찬",
    year: 0,
    staff_source_year: 15,
    campus: "서울",
    must_change_password: false,
    service_policy_version: 2,
    service_policy_consented_at: "2026-04-02T00:30:00.000Z",
    privacy_policy_version: 2,
    privacy_policy_consented_at: "2026-04-02T00:30:00.000Z",
    marketing_policy_version: 1,
    marketing_policy_consented_at: "2026-04-05T08:10:00.000Z",
    notification_preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: true,
      reviewEnabled: true,
      mmEnabled: true,
      marketingEnabled: true,
      activeDeviceCount: 2,
    },
    consent_history: [
      {
        kind: "marketing",
        version: 1,
        agreed_at: "2026-04-05T08:10:00.000Z",
        title: "마케팅 정보 수신 동의",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
      {
        kind: "service",
        version: 2,
        agreed_at: "2026-04-02T00:30:00.000Z",
        title: "서비스 이용약관",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
      {
        kind: "privacy",
        version: 2,
        agreed_at: "2026-04-02T00:30:00.000Z",
        title: "개인정보 처리방침",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
    ],
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-07T08:30:00.000Z",
  },
  {
    id: "mock-staff-2",
    mm_user_id: "mm-staff-2",
    mm_username: "nahyeon.jang",
    display_name: "장나현",
    year: 0,
    staff_source_year: 14,
    campus: null,
    must_change_password: false,
    service_policy_version: 1,
    service_policy_consented_at: "2026-03-20T02:00:00.000Z",
    privacy_policy_version: 1,
    privacy_policy_consented_at: "2026-03-20T02:00:00.000Z",
    marketing_policy_version: null,
    marketing_policy_consented_at: null,
    notification_preferences: {
      enabled: false,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: false,
      reviewEnabled: true,
      mmEnabled: true,
      marketingEnabled: false,
      activeDeviceCount: 0,
    },
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-01T09:10:00.000Z",
    updated_at: "2026-04-07T08:35:00.000Z",
  },
  {
    id: "mock-staff-3",
    mm_user_id: "mm-staff-3",
    mm_username: "juntae.lee",
    display_name: "이준태",
    year: 0,
    staff_source_year: 15,
    campus: null,
    must_change_password: true,
    service_policy_version: null,
    service_policy_consented_at: null,
    privacy_policy_version: null,
    privacy_policy_consented_at: null,
    marketing_policy_version: null,
    marketing_policy_consented_at: null,
    notification_preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: false,
      expiringPartnerEnabled: false,
      reviewEnabled: false,
      mmEnabled: true,
      marketingEnabled: false,
      activeDeviceCount: 1,
    },
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-01T09:20:00.000Z",
    updated_at: "2026-04-07T08:40:00.000Z",
  },
  {
    id: "mock-staff-4",
    mm_user_id: "mm-staff-4",
    mm_username: "jinha.ju",
    display_name: "주진하",
    year: 0,
    staff_source_year: 14,
    campus: "서울",
    must_change_password: false,
    service_policy_version: 2,
    service_policy_consented_at: "2026-04-03T09:00:00.000Z",
    privacy_policy_version: 2,
    privacy_policy_consented_at: "2026-04-03T09:00:00.000Z",
    marketing_policy_version: null,
    marketing_policy_consented_at: null,
    notification_preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: true,
      reviewEnabled: true,
      mmEnabled: false,
      marketingEnabled: false,
      activeDeviceCount: 1,
    },
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-01T09:30:00.000Z",
    updated_at: "2026-04-07T08:45:00.000Z",
  },
  {
    id: "mock-student-15",
    mm_user_id: "mm-student-15",
    mm_username: "minjae.kim08",
    display_name: "김민재08",
    year: 15,
    campus: "구미",
    must_change_password: false,
    service_policy_version: 2,
    service_policy_consented_at: "2026-04-04T03:20:00.000Z",
    privacy_policy_version: 2,
    privacy_policy_consented_at: "2026-04-04T03:20:00.000Z",
    marketing_policy_version: 1,
    marketing_policy_consented_at: "2026-04-06T05:00:00.000Z",
    notification_preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: true,
      reviewEnabled: true,
      mmEnabled: true,
      marketingEnabled: true,
      activeDeviceCount: 3,
    },
    consent_history: [
      {
        kind: "marketing",
        version: 1,
        agreed_at: "2026-04-06T05:00:00.000Z",
        title: "마케팅 정보 수신 동의",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
      {
        kind: "service",
        version: 2,
        agreed_at: "2026-04-04T03:20:00.000Z",
        title: "서비스 이용약관",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
      {
        kind: "privacy",
        version: 2,
        agreed_at: "2026-04-04T03:20:00.000Z",
        title: "개인정보 처리방침",
        effective_at: "2026-04-18T00:00:00.000Z",
      },
    ],
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-02T01:00:00.000Z",
    updated_at: "2026-04-07T01:20:00.000Z",
  },
  {
    id: "mock-student-14",
    mm_user_id: "mm-student-14",
    mm_username: "hyunjin.choi",
    display_name: "최현진",
    year: 14,
    campus: "서울",
    must_change_password: false,
    service_policy_version: 1,
    service_policy_consented_at: "2026-03-28T11:00:00.000Z",
    privacy_policy_version: 1,
    privacy_policy_consented_at: "2026-03-28T11:00:00.000Z",
    marketing_policy_version: null,
    marketing_policy_consented_at: null,
    notification_preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: false,
      expiringPartnerEnabled: true,
      reviewEnabled: true,
      mmEnabled: false,
      marketingEnabled: false,
      activeDeviceCount: 1,
    },
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-02T02:00:00.000Z",
    updated_at: "2026-04-07T02:20:00.000Z",
  },
];

export const mockPreviewCertificationMembers = {
  staff: mockPreviewMembers[0],
  year15: mockPreviewMembers[4],
  year14: mockPreviewMembers[5],
} as const;
