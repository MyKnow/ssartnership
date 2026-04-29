import type { ComponentType, SVGProps } from "react";
import {
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClockIcon,
  HomeIcon,
  MegaphoneIcon,
  QueueListIcon,
  StarIcon,
  TagIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

export type AdminNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: AdminNavIcon;
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
      },
      {
        href: "/admin/reviews",
        label: "리뷰 관리",
        description: "리뷰 검수와 공개 상태",
        icon: StarIcon,
      },
      {
        href: "/admin/logs",
        label: "로그 조회",
        description: "운영 로그 탐색",
        icon: QueueListIcon,
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
      },
      {
        href: "/admin/companies",
        label: "협력사 관리",
        description: "협력사와 계정 연결",
        icon: BuildingOffice2Icon,
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
      },
      {
        href: "/admin/advertisement",
        label: "홈 광고 관리",
        description: "캐러셀 카드 편집",
        icon: ChartBarSquareIcon,
      },
      {
        href: "/admin/event",
        label: "이벤트 관리",
        description: "이벤트 게시와 운영",
        icon: ClockIcon,
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
