import type { ComponentType, SVGProps } from "react";
import {
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

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: AdminNavIcon;
  permission: {
    resource: AdminPermissionResource;
  };
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "개요",
    items: [
      {
        href: "/admin",
        label: "관리 홈",
        description: "운영 요약과 빠른 진입",
        icon: HomeIcon,
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
        icon: UsersIcon,
        permission: { resource: "members" },
      },
      {
        href: "/admin/reviews",
        label: "리뷰 관리",
        description: "리뷰 검수와 공개 상태",
        icon: StarIcon,
        permission: { resource: "reviews" },
      },
      {
        href: "/admin/logs",
        label: "로그 조회",
        description: "운영 로그 탐색",
        icon: QueueListIcon,
        permission: { resource: "logs" },
      },
    ],
  },
  {
    label: "제휴 운영",
    items: [
      {
        href: "/admin/partners",
        label: "브랜드 관리",
        description: "브랜드와 카테고리 운영",
        icon: TagIcon,
        permission: { resource: "brands" },
      },
      {
        href: "/admin/companies",
        label: "협력사 관리",
        description: "협력사와 계정 연결",
        icon: BuildingOffice2Icon,
        permission: { resource: "companies" },
      },
    ],
  },
  {
    label: "메시지/노출",
    items: [
      {
        href: "/admin/push",
        label: "알림 운영",
        description: "발송과 운영 로그 확인",
        icon: MegaphoneIcon,
        permission: { resource: "notifications" },
      },
      {
        href: "/admin/advertisement",
        label: "홈 광고 관리",
        description: "캐러셀 카드 편집",
        icon: ChartBarSquareIcon,
        permission: { resource: "home_ads" },
      },
      {
        href: "/admin/event",
        label: "이벤트 관리",
        description: "이벤트 게시와 운영",
        icon: ClockIcon,
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
        icon: UserGroupIcon,
        permission: { resource: "cycles" },
      },
      {
        href: "/admin/admins",
        label: "어드민 관리",
        description: "계정과 권한 템플릿",
        icon: ShieldCheckIcon,
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
) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.href === "/admin" ||
          canAdmin(permissions, item.permission.resource, "read"),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
