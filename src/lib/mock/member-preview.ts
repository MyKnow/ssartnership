export type MockPreviewMember = {
  id: string;
  mattermostUserId: string;
  mattermostUsername: string;
  displayName: string;
  generation: number;
  staffSourceGeneration?: number | null;
  campus: string | null;
  mustChangePassword: boolean;
  graduateVerifiedAt?: string | null;
};

export const mockPreviewMembers: MockPreviewMember[] = [
  {
    id: "mock-staff-1",
    mattermostUserId: "mm-staff-1",
    mattermostUsername: "byeongchan.son",
    displayName: "손병찬",
    generation: 0,
    staffSourceGeneration: 15,
    campus: "서울",
    mustChangePassword: false,
  },
  {
    id: "mock-staff-2",
    mattermostUserId: "mm-staff-2",
    mattermostUsername: "nahyeon.jang",
    displayName: "장나현",
    generation: 0,
    staffSourceGeneration: 14,
    campus: null,
    mustChangePassword: false,
  },
  {
    id: "mock-staff-3",
    mattermostUserId: "mm-staff-3",
    mattermostUsername: "juntae.lee",
    displayName: "이준태",
    generation: 0,
    staffSourceGeneration: 15,
    campus: null,
    mustChangePassword: true,
  },
  {
    id: "mock-staff-4",
    mattermostUserId: "mm-staff-4",
    mattermostUsername: "jinha.ju",
    displayName: "주진하",
    generation: 0,
    staffSourceGeneration: 14,
    campus: "서울",
    mustChangePassword: false,
  },
  {
    id: "mock-student-15",
    mattermostUserId: "mm-student-15",
    mattermostUsername: "minjae.kim08",
    displayName: "김민재08",
    generation: 15,
    campus: "구미",
    mustChangePassword: false,
  },
  {
    id: "mock-student-16",
    mattermostUserId: "mm-student-16",
    mattermostUsername: "seoha.park16",
    displayName: "박서하16",
    generation: 16,
    campus: "서울",
    mustChangePassword: false,
  },
  {
    id: "mock-student-14",
    mattermostUserId: "mm-student-14",
    mattermostUsername: "hyunjin.choi",
    displayName: "최현진",
    generation: 14,
    campus: "서울",
    mustChangePassword: false,
    graduateVerifiedAt: "2026-04-02T02:00:00.000Z",
  },
];

export const mockPreviewCertificationMembers = {
  staff: mockPreviewMembers[0],
  year15: mockPreviewMembers[4],
  year16: mockPreviewMembers[5],
  year14: mockPreviewMembers[6],
} as const;
