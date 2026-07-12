import type { ComponentType, SVGProps } from "react";
import {
  BellAlertIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClockIcon,
  HomeIcon,
  MegaphoneIcon,
  QueueListIcon,
  ShieldCheckIcon,
  StarIcon,
  TagIcon,
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
  | "bell"
  | "building"
  | "chart"
  | "clock"
  | "home"
  | "megaphone"
  | "queue"
  | "shield"
  | "star"
  | "tag"
  | "userGroup"
  | "users";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  iconKey: AdminNavIconKey;
  permission: {
    resource: AdminPermissionResource;
  };
  globalOnly?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_ICON_BY_KEY: Record<AdminNavIconKey, AdminNavIcon> = {
  bell: BellAlertIcon,
  building: BuildingOffice2Icon,
  chart: ChartBarSquareIcon,
  clock: ClockIcon,
  home: HomeIcon,
  megaphone: MegaphoneIcon,
  queue: QueueListIcon,
  shield: ShieldCheckIcon,
  star: StarIcon,
  tag: TagIcon,
  userGroup: UserGroupIcon,
  users: UsersIcon,
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "개요",
    items: [
      {
        href: "/admin",
        label: "관리 홈",
        description: "운영 요약과 빠른 진입",
        iconKey: "home",
        permission: { resource: "members" },
      },
    ],
  },
  {
    label: "사용자/권한",
    items: [
      {
        href: "/admin/members",
        label: "회원 관리",
        description: "회원 검색, 수정, 추가",
        iconKey: "users",
        permission: { resource: "members" },
      },
      {
        href: "/admin/graduate-verifications",
        label: "수료생 인증",
        description: "수료증과 교육 이수 정보 검토",
        iconKey: "shield",
        permission: { resource: "graduate_verifications" },
      },
      {
        href: "/admin/profile-photos",
        label: "프로필 사진",
        description: "사진 변경과 기존 사진 점검",
        iconKey: "users",
        permission: { resource: "profile_images" },
      },
      {
        href: "/admin/reviews",
        label: "리뷰 관리",
        description: "리뷰 검수와 공개 상태",
        iconKey: "star",
        permission: { resource: "reviews" },
      },
      {
        href: "/admin/logs",
        label: "로그 조회",
        description: "운영 로그 탐색",
        iconKey: "queue",
        permission: { resource: "logs" },
      },
    ],
  },
  {
    label: "제휴 운영",
    items: [
      {
        href: "/admin/partners",
        label: "제휴처",
        description: "노출 카드와 혜택 정보",
        iconKey: "tag",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/partner-requests",
        label: "변경 요청",
        description: "제휴처 변경 승인 큐",
        iconKey: "queue",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/categories",
        label: "카테고리",
        description: "제휴처 분류 체계",
        iconKey: "tag",
        permission: { resource: "brands" },
        globalOnly: true,
      },
      {
        href: "/admin/partner-registrations",
        label: "등록 신청",
        description: "공개 신청 검토 큐",
        iconKey: "queue",
        permission: { resource: "brands" },
      },
      {
        href: "/admin/companies",
        label: "파트너사/계정",
        description: "회사와 담당 계정 연결",
        iconKey: "building",
        permission: { resource: "companies" },
      },
    ],
  },
  {
    label: "메시지/노출",
    items: [
      {
        href: "/admin/notifications",
        label: "내 알림",
        description: "관리자 수신함과 수신 설정",
        iconKey: "bell",
        permission: { resource: "notifications" },
      },
      {
        href: "/admin/push",
        label: "발송 관리",
        description: "메시지 발송과 로그 확인",
        iconKey: "megaphone",
        permission: { resource: "notifications" },
      },
      {
        href: "/admin/advertisement",
        label: "홈 광고 관리",
        description: "캐러셀 카드 편집",
        iconKey: "chart",
        permission: { resource: "home_ads" },
      },
      {
        href: "/admin/event",
        label: "이벤트 관리",
        description: "이벤트 게시와 운영",
        iconKey: "clock",
        permission: { resource: "events" },
      },
    ],
  },
  {
    label: "설정",
    items: [
      {
        href: "/admin/cycle",
        label: "기수 관리",
        description: "현재 기수 계산 기준",
        iconKey: "userGroup",
        permission: { resource: "cycles" },
      },
      {
        href: "/admin/admins",
        label: "관리자 관리",
        description: "계정과 권한 템플릿",
        iconKey: "shield",
        permission: { resource: "admin_management" },
      },
    ],
  },
];

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
          (item.href === "/admin" ||
            canAdmin(permissions, item.permission.resource, "read")),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
