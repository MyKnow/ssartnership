import type { ComponentType, SVGProps } from "react";
import {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClockIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  HomeIcon,
  MegaphoneIcon,
  PhotoIcon,
  QueueListIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  StarIcon,
  TagIcon,
  UserPlusIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  type AdminPermissionMatrix,
  type AdminPermissionResource,
  canAdmin,
} from "@/lib/admin-permissions";

export type AdminNavIcon = ComponentType<SVGProps<SVGSVGElement>>;
export type AdminNavIconKey =
  | "academicCap"
  | "adjustments"
  | "arrowsRightLeft"
  | "bell"
  | "building"
  | "calendar"
  | "chart"
  | "clock"
  | "documentPlus"
  | "documentText"
  | "home"
  | "megaphone"
  | "photo"
  | "queue"
  | "rectangleStack"
  | "shield"
  | "star"
  | "tag"
  | "userPlus"
  | "userGroup"
  | "users";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  keywords?: readonly string[];
  iconKey: AdminNavIconKey;
  permission: {
    resource: AdminPermissionResource;
  };
  globalOnly?: boolean;
  alwaysVisible?: boolean;
};

export type AdminNavGroup = {
  label: string;
  description: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_ICON_BY_KEY: Record<AdminNavIconKey, AdminNavIcon> = {
  academicCap: AcademicCapIcon,
  adjustments: AdjustmentsHorizontalIcon,
  arrowsRightLeft: ArrowsRightLeftIcon,
  bell: BellAlertIcon,
  building: BuildingOffice2Icon,
  calendar: CalendarDaysIcon,
  chart: ChartBarSquareIcon,
  clock: ClockIcon,
  documentPlus: DocumentPlusIcon,
  documentText: DocumentTextIcon,
  home: HomeIcon,
  megaphone: MegaphoneIcon,
  photo: PhotoIcon,
  queue: QueueListIcon,
  rectangleStack: RectangleStackIcon,
  shield: ShieldCheckIcon,
  star: StarIcon,
  tag: TagIcon,
  userPlus: UserPlusIcon,
  userGroup: UserGroupIcon,
  users: UsersIcon,
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "홈",
    description: "오늘의 운영 상태와 바로 처리할 작업",
    items: [
      {
        href: "/admin",
        label: "관리 홈",
        description: "오늘의 운영 상태와 다음 작업",
        keywords: ["대시보드", "현황", "오늘", "홈"],
        iconKey: "home",
        permission: { resource: "members" },
        alwaysVisible: true,
      },
    ],
  },
  {
    label: "작업함",
    description: "승인·검토·예외 처리가 필요한 항목",
    items: [
      {
        href: "/admin/tasks",
        label: "작업함",
        description: "처리 대기 항목을 우선순위로 확인",
        keywords: ["처리", "대기", "승인", "검토", "큐", "할 일"],
        iconKey: "queue",
        permission: { resource: "members" },
        alwaysVisible: true,
      },
      {
        href: "/admin/member-signup-requests",
        label: "가입 승인",
        description: "Mattermost 프로필 파싱 실패 회원 검토",
        keywords: ["가입", "회원가입", "승인", "파싱"],
        iconKey: "userPlus",
        permission: { resource: "member_signup_requests" },
      },
      {
        href: "/admin/graduate-verifications",
        label: "수료생 인증",
        description: "수료증과 교육 이수 정보 검토",
        keywords: ["졸업", "수료", "인증", "증명서"],
        iconKey: "academicCap",
        permission: { resource: "graduate_verifications" },
      },
      {
        href: "/admin/profile-photos",
        label: "프로필 사진",
        description: "사진 변경 요청 검토",
        keywords: ["사진", "이미지", "검수", "프로필"],
        iconKey: "photo",
        permission: { resource: "profile_images" },
      },
      {
        href: "/admin/partner-registrations",
        label: "등록 신청",
        description: "공개 신청 검토 큐",
        keywords: ["제휴처 신청", "신청", "등록", "검토"],
        iconKey: "documentPlus",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/partner-requests",
        label: "변경 요청",
        description: "제휴처 변경 승인 큐",
        keywords: ["제휴처 변경", "승인", "검토", "수정 요청"],
        iconKey: "arrowsRightLeft",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/reviews",
        label: "리뷰 관리",
        description: "리뷰 검수와 공개 상태",
        keywords: ["후기", "평점", "검수", "댓글"],
        iconKey: "star",
        permission: { resource: "reviews" },
      },
      {
        href: "/admin/notifications",
        label: "내 알림",
        description: "운영 알림을 읽고 후속 작업으로 이동",
        keywords: ["알림", "읽음", "통지", "메시지"],
        iconKey: "bell",
        permission: { resource: "notifications" },
      },
    ],
  },
  {
    label: "데이터",
    description: "회원·제휴처·파트너사 정보를 찾고 관리",
    items: [
      {
        href: "/admin/members",
        label: "회원 관리",
        description: "회원 검색, 수정, 추가",
        keywords: ["사람", "계정", "검색", "추가", "회원"],
        iconKey: "users",
        permission: { resource: "members" },
      },
      {
        href: "/admin/partners",
        label: "제휴처",
        description: "노출 카드와 혜택 정보",
        keywords: [
          ["업", "체"].join(""),
          ["가", "게"].join(""),
          ["매", "장"].join(""),
          "제휴",
          "혜택",
        ],
        iconKey: "tag",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/companies",
        label: "파트너사/계정",
        description: "회사와 담당 계정 연결",
        keywords: ["파트너", "회사", `${["업", "체"].join("")} 계정`, "담당자"],
        iconKey: "building",
        permission: { resource: "companies" },
      },
      {
        href: "/admin/categories",
        label: "카테고리",
        description: "제휴처 분류 체계",
        keywords: ["분류", "태그", "종류"],
        iconKey: "adjustments",
        permission: { resource: "brands" },
        globalOnly: true,
      },
    ],
  },
  {
    label: "리포트",
    description: "운영 기록과 서비스 상태를 확인",
    items: [
      {
        href: "/admin/logs",
        label: "운영 로그",
        description: "제품·감사·보안 기록과 성능 지표를 탐색",
        keywords: ["기록", "감사", "보안", "이력", "로그", "지표"],
        iconKey: "chart",
        permission: { resource: "logs" },
      },
    ],
  },
  {
    label: "자동화",
    description: "발송·광고·이벤트 운영을 실행",
    items: [
      {
        href: "/admin/push",
        label: "발송 관리",
        description: "메시지 발송과 로그 확인",
        keywords: ["메시지", "문자", "푸시", "발송", "보내기"],
        iconKey: "megaphone",
        permission: { resource: "notifications" },
      },
      {
        href: "/admin/notification-templates",
        label: "알림 템플릿",
        description: "채널별 자동 알림 문구 관리",
        keywords: ["자동화", "문구", "양식", "채널"],
        iconKey: "documentText",
        permission: { resource: "notification_templates" },
      },
      {
        href: "/admin/advertisement",
        label: "홈 광고 관리",
        description: "캐러셀 카드 편집",
        keywords: ["배너", "광고", "캐러셀", "홈 화면"],
        iconKey: "rectangleStack",
        permission: { resource: "home_ads" },
      },
      {
        href: "/admin/event",
        label: "이벤트 관리",
        description: "이벤트 게시와 운영",
        keywords: ["행사", "프로모션", "게시"],
        iconKey: "calendar",
        permission: { resource: "events" },
      },
    ],
  },
  {
    label: "설정",
    description: "기수·관리자 계정과 권한을 관리",
    items: [
      {
        href: "/admin/cycle",
        label: "기수 관리",
        description: "현재 기수 계산 기준",
        keywords: ["기수", "SSAFY", "인증 카드"],
        iconKey: "userGroup",
        permission: { resource: "cycles" },
      },
      {
        href: "/admin/admins",
        label: "관리자 관리",
        description: "계정과 권한 템플릿",
        keywords: ["권한", "관리자 계정", "역할", "초대"],
        iconKey: "shield",
        permission: { resource: "admin_management" },
      },
    ],
  },
];

export const ADMIN_TASK_HREFS = [
  "/admin/partner-registrations",
  "/admin/partner-requests",
  "/admin/member-signup-requests",
  "/admin/graduate-verifications",
  "/admin/profile-photos",
  "/admin/notifications",
] as const;

export function getAdminTaskItems(groups: AdminNavGroup[]) {
  const taskHrefs = new Set<string>(ADMIN_TASK_HREFS);
  return groups
    .flatMap((group) => group.items)
    .filter((item) => taskHrefs.has(item.href));
}

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavItem(pathname: string) {
  return ADMIN_NAV_ITEMS.find((item) => isAdminNavActive(pathname, item.href)) ?? null;
}

export function findAdminNavItems(query: string, groups: AdminNavGroup[]) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const items = groups.flatMap((group) => group.items);

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    [item.label, item.description, ...(item.keywords ?? [])]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery),
  );
}

export function filterAdminNavGroupsByPermissions(
  groups: AdminNavGroup[],
  permissions: AdminPermissionMatrix,
  options: { includeGlobalItems?: boolean } = {},
) {
  const includeGlobalItems = options.includeGlobalItems ?? true;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (includeGlobalItems || !item.globalOnly) &&
          (item.alwaysVisible ||
            canAdmin(permissions, item.permission.resource, "read")),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
