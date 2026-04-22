import type { LogGroup, LogRangePreset } from '@/lib/log-insights';
import {
  formatKoreanDateTime,
  formatKoreanDateTimeLocalValue,
  toIsoFromKoreanDateTimeLocalValue,
} from "@/lib/datetime";

export const RANGE_PRESET_OPTIONS: Array<{ value: LogRangePreset; label: string }> = [
  { value: '1h', label: '1시간' },
  { value: '12h', label: '12시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '일주일' },
  { value: '30d', label: '한달' },
  { value: 'custom', label: '사용자 지정' },
];

const productLabels: Record<string, string> = {
  page_view: '페이지 조회',
  partner_detail_view: '파트너 상세 조회',
  partner_card_click: '파트너 카드 클릭',
  category_filter_change: '카테고리 필터 변경',
  search_execute: '검색 실행',
  sort_change: '정렬 변경',
  partner_map_click: '지도 클릭',
  reservation_click: '예약 클릭',
  inquiry_click: '문의 클릭',
  share_link_copy: '공유 링크 복사',
  push_settings_view: '알림 설정 조회',
  push_subscribe: '푸시 구독',
  push_unsubscribe_device: '현재 기기 알림 해제',
  push_unsubscribe_all: '모든 기기 알림 해제',
  push_preference_change: '푸시 설정 변경',
  suggest_submit: '협력사 제안 제출',
  pwa_install_click: 'PWA 설치 클릭',
  certification_view: '내 프로필 조회',
  certification_qr_open: '교육생 QR 열기',
  certification_qr_verify: '교육생 QR 검증',
};

const auditLabels: Record<string, string> = {
  login: '관리자 로그인',
  logout: '관리자 로그아웃',
  category_create: '카테고리 생성',
  category_update: '카테고리 수정',
  category_delete: '카테고리 삭제',
  partner_company_create: '협력사 생성',
  partner_company_update: '협력사 수정',
  partner_company_delete: '협력사 삭제',
  partner_create: '브랜드 생성',
  partner_update: '브랜드 수정',
  partner_delete: '브랜드 삭제',
  partner_change_request_approve: '브랜드 변경 요청 승인',
  partner_change_request_reject: '브랜드 변경 요청 거절',
  member_update: '회원 수정',
  member_directory_sync: '회원 디렉토리 동기화',
  member_sync: '회원 정보 동기화',
  member_manual_add: '회원 수동 추가',
  member_delete: '회원 삭제',
  cycle_settings_update: '기수 기준 수정',
  cycle_settings_early_start: '기수 조기 시작',
  cycle_settings_restore: '기수 기준 복구',
  push_send: '푸시 발송',
  push_log_delete: '푸시 로그 삭제',
  partner_account_update: '협력사 포털 계정 수정',
  partner_account_create: '협력사 포털 계정 추가',
  partner_account_company_update: '협력사 포털 연결 수정',
  partner_account_initial_setup_link_generate: '협력사 포털 초기설정 URL 생성',
  partner_account_initial_setup_link_send: '협력사 포털 초기설정 URL 전송',
};

const securityLabels: Record<string, string> = {
  member_login: '회원 로그인',
  member_logout: '회원 로그아웃',
  member_signup_code_request: '회원가입 인증코드 요청',
  member_signup_complete: '회원가입 완료',
  member_policy_consent: '약관 동의',
  member_password_reset_request: '비밀번호 재설정 인증번호 요청',
  member_password_reset_verify: '비밀번호 재설정 인증번호 확인',
  member_password_reset_complete: '비밀번호 재설정 완료',
  member_password_reset: '비밀번호 재설정',
  member_password_change: '비밀번호 변경',
  member_delete: '회원 탈퇴',
  admin_login: '관리자 로그인',
  admin_access: '관리자 접근 제어',
  partner_login: '협력사 포털 로그인',
  partner_logout: '협력사 포털 로그아웃',
  partner_password_reset: '협력사 포털 비밀번호 재설정',
  partner_password_change: '협력사 포털 비밀번호 변경',
};

export function formatDateTime(value: string) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocalValue(value: string) {
  return formatKoreanDateTimeLocalValue(value);
}

export function toIsoFromLocalValue(value: string) {
  return toIsoFromKoreanDateTimeLocalValue(value);
}

export function getPropertyEntries(properties: Record<string, unknown> | null) {
  return Object.entries(properties ?? {}).filter(([, value]) => {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  });
}

export function stringifyForSearch(properties: Record<string, unknown> | null) {
  try {
    return JSON.stringify(properties ?? {});
  } catch {
    return '';
  }
}

export function getGroupBadgeClass(group: LogGroup) {
  switch (group) {
    case 'product':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'audit':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'security':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    default:
      return 'bg-surface-muted text-muted-foreground';
  }
}

export function getStatusBadgeClass(status: string | null) {
  if (status === 'success') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'failure') {
    return 'bg-danger/15 text-danger';
  }
  if (status === 'blocked') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }
  return 'bg-surface-muted text-muted-foreground';
}

export function getActorSearchLabel(log: {
  actorType: string | null;
  actorMmUsername: string | null;
  actorName: string | null;
  actorId: string | null;
  identifier: string | null;
}) {
  if (log.actorMmUsername) {
    return `@${log.actorMmUsername}`;
  }
  if (log.actorName) {
    return log.actorName;
  }
  if (log.identifier) {
    return log.identifier;
  }
  if (log.actorId) {
    return log.actorId;
  }
  if (log.actorType === 'guest') {
    return '비로그인 사용자';
  }
  return '알 수 없음';
}

export function getLogLabel(group: LogGroup, name: string) {
  if (group === 'product') {
    return productLabels[name] ?? name;
  }
  if (group === 'audit') {
    return auditLabels[name] ?? name;
  }
  return securityLabels[name] ?? name;
}
