export type MockPreviewMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  year: number;
  staff_source_year?: number | null;
  campus: string | null;
  must_change_password: boolean;
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
