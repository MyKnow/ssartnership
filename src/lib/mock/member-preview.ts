export type MockPreviewMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  year: number;
  campus: string | null;
  class_number: number | null;
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
    display_name: "손병찬강사(서울13반)",
    year: 0,
    campus: "서울",
    class_number: 13,
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
    display_name: "장나현(교육프로)",
    year: 0,
    campus: null,
    class_number: null,
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
    display_name: "이준태[취업]운영프로",
    year: 0,
    campus: null,
    class_number: null,
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
    display_name: "주진하[서울_7,8반]교육프로",
    year: 0,
    campus: "서울",
    class_number: null,
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
    display_name: "김민재08[구미_1반_D104]팀원",
    year: 15,
    campus: "구미",
    class_number: 1,
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
    display_name: "최현진[서울/대전_2반(S2)_S203]팀원",
    year: 14,
    campus: "서울",
    class_number: 2,
    must_change_password: false,
    avatar_content_type: null,
    avatar_base64: null,
    created_at: "2026-04-02T02:00:00.000Z",
    updated_at: "2026-04-07T02:20:00.000Z",
  },
];

export const mockPreviewCertificationMembers = {
  withClass: mockPreviewMembers[0],
  noCampus: mockPreviewMembers[1],
} as const;
