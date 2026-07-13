import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type {
  PartnerNotificationCategory,
  PartnerNotificationEntry,
  PartnerNotificationStatus,
} from "@/lib/partner-notifications";

export type PartnerNotificationPurpose = "action" | "information";

export type PartnerNotificationPriority = "critical" | "high" | "medium" | "low";

export type PartnerNotificationReadState = "read" | "unread";

export type PartnerNotificationUiType =
  | "payment"
  | "review"
  | "plan"
  | "store"
  | "settlement"
  | "notice";

export type PartnerNotificationProgressStep = {
  label: string;
  state: "done" | "current" | "next" | "blocked";
};

export type PartnerNotificationUiModel = {
  item: PartnerNotificationEntry;
  purpose: PartnerNotificationPurpose;
  purposeLabel: string;
  type: PartnerNotificationUiType;
  typeLabel: string;
  statusLabel: string;
  priority: PartnerNotificationPriority;
  priorityLabel: string;
  readState: PartnerNotificationReadState;
  ctaLabel: string;
  targetLabel: string;
  avatarLabel: string;
  currentStepLabel: string;
  nextStepLabel: string;
  progressSteps: PartnerNotificationProgressStep[];
  relativeTime: string;
  absoluteTime: string;
  searchableText: string;
};

export type PartnerNotificationUiFilters = {
  category: PartnerNotificationCategory | "all";
  type: PartnerNotificationUiType | "all";
  purpose: PartnerNotificationPurpose | "all";
  priority: PartnerNotificationPriority | "all";
  status: PartnerNotificationStatus | "all";
  readState: PartnerNotificationReadState | "all";
  companyId: string | "global" | "all";
  period: "all" | "today" | "7d" | "30d";
  searchQuery: string;
};

export type PartnerNotificationUiSummary = {
  totalCount: number;
  actionCount: number;
  unreadCount: number;
  pendingCount: number;
  rejectedCount: number;
  completedTodayCount: number;
  highPriorityCount: number;
};

export const PARTNER_NOTIFICATION_PURPOSE_LABELS: Record<
  PartnerNotificationPurpose,
  string
> = {
  action: "처리 필요",
  information: "상태 안내",
};

export const PARTNER_NOTIFICATION_PRIORITY_LABELS: Record<
  PartnerNotificationPriority,
  string
> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PARTNER_NOTIFICATION_STATUS_LABELS: Record<
  PartnerNotificationStatus,
  string
> = {
  pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  cancelled: "취소",
  created: "접수 완료",
  updated: "업데이트",
  deleted: "삭제",
  hidden: "숨김 처리",
  restored: "복구",
  granted: "권한 부여",
  notified: "안내",
};

const COMPLETED_STATUSES = new Set<PartnerNotificationStatus>([
  "approved",
  "granted",
  "restored",
  "notified",
]);

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getCombinedText(item: PartnerNotificationEntry) {
  return normalizeText(
    [
      item.badgeLabel,
      item.title,
      item.body,
      item.companyName,
      item.partnerName ?? "",
    ].join(" "),
  );
}

function getNotificationPurpose(item: PartnerNotificationEntry): PartnerNotificationPurpose {
  const text = getCombinedText(item);

  if (item.status === "rejected" || item.status === "hidden") {
    return "action";
  }

  if (item.category === "review" && item.status === "created") {
    return "action";
  }

  if (item.category === "request" && item.status === "pending") {
    return "action";
  }

  if (includesAny(text, ["수정 필요", "다시 제출", "답변 필요", "추가 정보", "정산 정보 수정"])) {
    return "action";
  }

  return "information";
}

function getNotificationType(item: PartnerNotificationEntry): {
  type: PartnerNotificationUiType;
  label: string;
} {
  const text = getCombinedText(item);

  if (item.category === "review") {
    return { type: "review", label: "리뷰" };
  }

  if (item.category === "request") {
    return { type: "store", label: "매장" };
  }

  if (item.category === "plan") {
    if (includesAny(text, ["입금", "결제", "세금계산서", "증빙"])) {
      return { type: "payment", label: "결제" };
    }
    return { type: "plan", label: "플랜" };
  }

  if (includesAny(text, ["정산", "세금계산서", "증빙", "입금자"])) {
    return { type: "settlement", label: "정산" };
  }

  return { type: "notice", label: "공지" };
}

function getNotificationPriority(
  item: PartnerNotificationEntry,
  purpose: PartnerNotificationPurpose,
): PartnerNotificationPriority {
  if (item.tone === "danger" || item.status === "rejected") {
    return "critical";
  }

  if (purpose === "action") {
    return "high";
  }

  if (item.tone === "warning" || item.status === "pending") {
    return "medium";
  }

  return "low";
}

function getNotificationReadState(item: PartnerNotificationEntry): PartnerNotificationReadState {
  if (typeof item.isUnread === "boolean") {
    return item.isUnread ? "unread" : "read";
  }

  if (item.readAt !== undefined) {
    return item.readAt ? "read" : "unread";
  }

  if (!item.notificationId) {
    return "read";
  }

  if (item.badgeLabel.includes("확인됨")) {
    return "read";
  }

  if (item.badgeLabel.includes("새") || item.tone === "primary") {
    return "unread";
  }

  return item.tone === "neutral" ? "read" : "unread";
}

function getTargetLabel(item: PartnerNotificationEntry) {
  const labels = [item.companyName?.trim(), item.partnerName?.trim()].filter(
    (value): value is string => Boolean(value),
  );
  return labels.length > 0 ? labels.join(" · ") : "미지정";
}

function getAvatarLabel(item: PartnerNotificationEntry) {
  const source = (item.partnerName ?? item.companyName ?? "알림").replace(/\s+/g, "");
  return Array.from(source).slice(0, 2).join("");
}

function getCtaLabel(
  item: PartnerNotificationEntry,
  purpose: PartnerNotificationPurpose,
  type: PartnerNotificationUiType,
) {
  if (purpose === "information") {
    return type === "payment" || type === "plan" ? "진행 상황 보기" : "상세 보기";
  }

  if (item.status === "rejected") {
    return "다시 제출";
  }

  if (item.category === "review") {
    return "리뷰 확인";
  }

  if (item.category === "request") {
    return "요청 확인";
  }

  return "처리하기";
}

function createProgressSteps(labels: string[], currentIndex: number) {
  return labels.map((label, index): PartnerNotificationProgressStep => {
    if (index < currentIndex) {
      return { label, state: "done" };
    }
    if (index === currentIndex) {
      return { label, state: "current" };
    }
    return { label, state: "next" };
  });
}

function getProgressModel(item: PartnerNotificationEntry): {
  currentStepLabel: string;
  nextStepLabel: string;
  progressSteps: PartnerNotificationProgressStep[];
} {
  if (item.category === "plan") {
    if (item.status === "rejected" || item.status === "cancelled") {
      return {
        currentStepLabel: item.status === "rejected" ? "요청 반려" : "요청 취소",
        nextStepLabel: "필요하면 플랜 관리에서 새 업그레이드 요청을 다시 접수할 수 있습니다.",
        progressSteps: [
          { label: "요청 완료", state: "done" },
          { label: "입금 확인", state: "done" },
          { label: "승인 보류", state: "blocked" },
          { label: "플랜 적용", state: "next" },
        ],
      };
    }

    const currentIndex =
      item.status === "approved" || item.status === "granted"
        ? 3
        : item.status === "notified"
          ? 2
          : 1;
    return {
      currentStepLabel:
        currentIndex >= 3
          ? "플랜 적용 완료"
          : currentIndex === 2
            ? "관리자 승인 대기"
            : "관리자 입금 확인 중",
      nextStepLabel:
        currentIndex >= 3
          ? "새 플랜 기준으로 접근 가능한 지표와 광고 기능이 반영되었습니다."
          : "입금 확인과 관리자 승인이 끝나면 플랜이 자동으로 적용됩니다.",
      progressSteps: createProgressSteps(
        ["요청 완료", "입금 확인", "승인 대기", "플랜 적용"],
        currentIndex,
      ),
    };
  }

  if (item.category === "request") {
    if (item.status === "rejected") {
      return {
        currentStepLabel: "수정 요청 반려",
        nextStepLabel: "반려 사유를 확인하고 수정 요청을 다시 제출해 주세요.",
        progressSteps: [
          { label: "요청 접수", state: "done" },
          { label: "관리자 검토", state: "done" },
          { label: "반려 안내", state: "blocked" },
        ],
      };
    }

    const currentIndex = item.status === "approved" ? 2 : 1;
    return {
      currentStepLabel: currentIndex >= 2 ? "변경 반영 완료" : "관리자 검토 중",
      nextStepLabel:
        currentIndex >= 2
          ? "제휴처 상세 화면에서 반영된 정보를 확인할 수 있습니다."
          : "검토가 완료되면 승인 또는 반려 결과를 다시 알려드립니다.",
      progressSteps: createProgressSteps(["요청 접수", "관리자 검토", "결과 안내"], currentIndex),
    };
  }

  if (item.category === "review") {
    return {
      currentStepLabel: "리뷰 확인 필요",
      nextStepLabel: "별점과 사진 포함 여부를 확인하고 필요한 운영 조치를 진행하세요.",
      progressSteps: [
        { label: "리뷰 등록", state: "done" },
        { label: "운영 확인", state: "current" },
      ],
    };
  }

  return {
    currentStepLabel: "운영 안내",
    nextStepLabel: "상세 화면에서 관련 정보와 다음 조치를 확인할 수 있습니다.",
    progressSteps: [
      { label: "안내 발송", state: "done" },
      { label: "내용 확인", state: "current" },
    ],
  };
}

export function formatRelativeKoreanTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return "방금 전";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "어제";
  }
  if (diffDays < 30) {
    return `${diffDays}일 전`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}개월 전`;
  }

  return `${Math.floor(diffMonths / 12)}년 전`;
}

export function derivePartnerNotificationUiModel(
  item: PartnerNotificationEntry,
  now = new Date(),
): PartnerNotificationUiModel {
  const purpose = getNotificationPurpose(item);
  const notificationType = getNotificationType(item);
  const priority = getNotificationPriority(item, purpose);
  const progress = getProgressModel(item);
  const targetLabel = getTargetLabel(item);
  const statusLabel = PARTNER_NOTIFICATION_STATUS_LABELS[item.status];
  const absoluteTime = formatKoreanDateTimeToMinute(item.createdAt);
  const relativeTime = formatRelativeKoreanTime(item.createdAt, now);
  const readState = getNotificationReadState(item);

  return {
    item,
    purpose,
    purposeLabel: PARTNER_NOTIFICATION_PURPOSE_LABELS[purpose],
    type: notificationType.type,
    typeLabel: notificationType.label,
    statusLabel,
    priority,
    priorityLabel: PARTNER_NOTIFICATION_PRIORITY_LABELS[priority],
    readState,
    ctaLabel: getCtaLabel(item, purpose, notificationType.type),
    targetLabel,
    avatarLabel: getAvatarLabel(item),
    currentStepLabel: progress.currentStepLabel,
    nextStepLabel: progress.nextStepLabel,
    progressSteps: progress.progressSteps,
    relativeTime,
    absoluteTime,
    searchableText: normalizeText(
      [
        item.title,
        item.body,
        item.badgeLabel,
        item.companyName,
        item.partnerName ?? "",
        notificationType.label,
        statusLabel,
        PARTNER_NOTIFICATION_PURPOSE_LABELS[purpose],
        PARTNER_NOTIFICATION_PRIORITY_LABELS[priority],
        targetLabel,
      ].join(" "),
    ),
  };
}

export function filterPartnerNotificationUiModels(
  models: PartnerNotificationUiModel[],
  filters: PartnerNotificationUiFilters,
  now = new Date(),
) {
  const searchQuery = normalizeText(filters.searchQuery);
  const todayKey = getKoreanDateKey(now);

  return models.filter((model) => {
    if (filters.category !== "all" && model.item.category !== filters.category) {
      return false;
    }

    if (filters.type !== "all" && model.type !== filters.type) {
      return false;
    }

    if (filters.purpose !== "all" && model.purpose !== filters.purpose) {
      return false;
    }

    if (filters.priority !== "all" && model.priority !== filters.priority) {
      return false;
    }

    if (filters.status !== "all" && model.item.status !== filters.status) {
      return false;
    }

    if (filters.readState !== "all" && model.readState !== filters.readState) {
      return false;
    }

    if (filters.companyId !== "all") {
      const modelCompanyId = model.item.companyId ?? "global";
      if (modelCompanyId !== filters.companyId) {
        return false;
      }
    }

    if (filters.period !== "all") {
      const createdAt = new Date(model.item.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (filters.period === "today" && getKoreanDateKey(createdAt) !== todayKey) {
        return false;
      }

      if (filters.period === "7d" || filters.period === "30d") {
        const maxDays = filters.period === "7d" ? 7 : 30;
        const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);
        if (diffDays < 0 || diffDays > maxDays) {
          return false;
        }
      }
    }

    return !searchQuery || model.searchableText.includes(searchQuery);
  });
}

function getKoreanDateKey(value: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function summarizePartnerNotificationUiModels(
  models: PartnerNotificationUiModel[],
  now = new Date(),
): PartnerNotificationUiSummary {
  const todayKey = getKoreanDateKey(now);

  return models.reduce<PartnerNotificationUiSummary>(
    (summary, model) => {
      const itemDate = new Date(model.item.createdAt);
      const completedToday =
        !Number.isNaN(itemDate.getTime()) &&
        COMPLETED_STATUSES.has(model.item.status) &&
        getKoreanDateKey(itemDate) === todayKey;

      return {
        totalCount: summary.totalCount + 1,
        actionCount: summary.actionCount + (model.purpose === "action" ? 1 : 0),
        unreadCount: summary.unreadCount + (model.readState === "unread" ? 1 : 0),
        pendingCount: summary.pendingCount + (model.item.status === "pending" ? 1 : 0),
        rejectedCount: summary.rejectedCount + (model.item.status === "rejected" ? 1 : 0),
        completedTodayCount: summary.completedTodayCount + (completedToday ? 1 : 0),
        highPriorityCount:
          summary.highPriorityCount +
          (model.priority === "critical" || model.priority === "high" ? 1 : 0),
      };
    },
    {
      totalCount: 0,
      actionCount: 0,
      unreadCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      completedTodayCount: 0,
      highPriorityCount: 0,
    },
  );
}
