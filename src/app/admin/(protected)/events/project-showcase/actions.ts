"use server";

import { revalidatePath } from "next/cache";
import { logAdminAudit } from "@/lib/activity-logs";
import { requireAdminPermission } from "@/lib/admin-access";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { ShowcaseDomainError, toShowcaseFailure } from "@/lib/project-showcase/errors";
import {
  PROJECT_SHOWCASE_SLUG,
  SHOWCASE_VOID_REASONS,
  type ShowcaseCandidateGroup,
  type ShowcaseVoidReason,
} from "@/lib/project-showcase/types";
import {
  parseShowcaseExclusionReason,
  parseShowcaseReview,
  parseShowcaseSchedule,
  SHOWCASE_SCHEDULE_FIELDS,
} from "@/lib/project-showcase/validation";

const EVENT_PATH = `/events/${PROJECT_SHOWCASE_SLUG}`;
const ADMIN_PATH = "/admin/events/project-showcase";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateShowcaseSchedule(formData: FormData) {
  await requireAdminPermission("events", "update", { path: ADMIN_PATH });
  const fields = [...SHOWCASE_SCHEDULE_FIELDS, "submitterSelectionCount", "experiencerSelectionCount", "isActive"];
  const parsed = parseShowcaseSchedule(Object.fromEntries(fields.map((field) => [field, readString(formData, field)])));
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  try {
    await projectShowcaseRepository.updateEventSchedule(parsed.data);
    await logAdminAudit({
      action: "showcase_event_settings_update",
      targetType: "showcase_event",
      targetId: PROJECT_SHOWCASE_SLUG,
      path: ADMIN_PATH,
      properties: { is_active: parsed.data.isActive },
    });
    revalidatePath(EVENT_PATH);
    revalidatePath(ADMIN_PATH);
    return { ok: true as const, message: "이벤트 일정을 저장했어요." };
  } catch (error) {
    console.error("[project-showcase/schedule]", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, message: "이벤트 일정을 저장하지 못했어요.", field: null };
  }
}

export async function reviewShowcaseProject(formData: FormData) {
  const admin = await requireAdminPermission("events", "update", { path: ADMIN_PATH });
  const projectId = readString(formData, "projectId");
  if (!projectId || projectId.length > 128) {
    return { ok: false as const, message: "검수할 프로젝트를 찾을 수 없어요.", field: null };
  }
  const parsed = parseShowcaseReview({ status: readString(formData, "status"), reviewNote: readString(formData, "reviewNote") });
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  const { status, reviewNote } = parsed.data;
  try {
    await projectShowcaseRepository.reviewProject({ projectId, adminId: admin.adminId, status, reviewNote });
    await logAdminAudit({
      action: "showcase_project_review",
      targetType: "showcase_project",
      targetId: projectId,
      path: ADMIN_PATH,
      properties: { status },
    });
    revalidatePath(EVENT_PATH);
    revalidatePath(ADMIN_PATH);
    return { ok: true as const, message: "검수 결과를 저장했어요." };
  } catch (error) {
    if (!(error instanceof ShowcaseDomainError)) {
      console.error("[project-showcase/review]", error instanceof Error ? error.message : "unknown");
    }
    return toShowcaseFailure(error);
  }
}

export async function setShowcaseFeedbackHidden(feedbackId: string, hidden: boolean) {
  const admin = await requireAdminPermission("events", "update", { path: `${ADMIN_PATH}/feedback` });
  if (typeof feedbackId !== "string" || !feedbackId || feedbackId.length > 128 || typeof hidden !== "boolean") {
    return { ok: false as const, message: "피드백을 찾을 수 없어요.", field: null };
  }
  try {
    await projectShowcaseRepository.setFeedbackHidden({ feedbackId, adminId: admin.adminId, hidden });
    await logAdminAudit({
      action: "showcase_feedback_visibility_update",
      targetType: "showcase_feedback",
      targetId: feedbackId,
      path: `${ADMIN_PATH}/feedback`,
      properties: { hidden },
    });
    revalidatePath(`${ADMIN_PATH}/feedback`);
    revalidatePath(`${EVENT_PATH}/my`, "layout");
    return { ok: true as const, message: hidden ? "피드백을 숨겼어요." : "피드백을 다시 공개했어요." };
  } catch (error) {
    if (!(error instanceof ShowcaseDomainError)) {
      console.error("[project-showcase/feedback-visibility]", error instanceof Error ? error.message : "unknown");
    }
    return toShowcaseFailure(error);
  }
}

const DRAW_PATH = `${ADMIN_PATH}/draw`;

function revalidateDraw() {
  revalidatePath(DRAW_PATH);
  revalidatePath(EVENT_PATH);
  revalidatePath(`${EVENT_PATH}/my`);
}

function drawFailure(scope: string, error: unknown) {
  if (!(error instanceof ShowcaseDomainError)) {
    console.error(`[project-showcase/${scope}]`, error instanceof Error ? error.message : "unknown");
  }
  return toShowcaseFailure(error);
}

function isCandidateGroup(value: unknown): value is ShowcaseCandidateGroup {
  return value === "submitter" || value === "experiencer";
}

function isShortId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

export async function excludeShowcaseCandidate(input: { group: ShowcaseCandidateGroup; targetId: string; reason: string }) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isCandidateGroup(input?.group) || !isShortId(input?.targetId)) {
    return { ok: false as const, message: "제외할 후보를 찾을 수 없어요.", field: null };
  }
  const parsed = parseShowcaseExclusionReason(input.reason);
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  try {
    await projectShowcaseRepository.excludeCandidate({
      group: input.group,
      projectId: input.group === "submitter" ? input.targetId : undefined,
      memberId: input.group === "experiencer" ? input.targetId : undefined,
      reason: parsed.data.reason,
      adminId: admin.adminId,
    });
    await logAdminAudit({
      action: "showcase_candidate_exclusion_update",
      targetType: "showcase_event",
      targetId: PROJECT_SHOWCASE_SLUG,
      path: DRAW_PATH,
      properties: { candidate_group: input.group, excluded: true },
    });
    revalidateDraw();
    return { ok: true as const, message: "후보에서 제외했어요." };
  } catch (error) {
    return drawFailure("exclude", error);
  }
}

export async function restoreShowcaseCandidate(exclusionId: string) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isShortId(exclusionId)) return { ok: false as const, message: "제외 기록을 찾을 수 없어요.", field: null };
  try {
    await projectShowcaseRepository.restoreCandidate({ exclusionId, adminId: admin.adminId });
    await logAdminAudit({
      action: "showcase_candidate_exclusion_update",
      targetType: "showcase_event",
      targetId: PROJECT_SHOWCASE_SLUG,
      path: DRAW_PATH,
      properties: { excluded: false },
    });
    revalidateDraw();
    return { ok: true as const, message: "후보로 복구했어요." };
  } catch (error) {
    return drawFailure("restore", error);
  }
}

export async function runShowcaseDraw(group: ShowcaseCandidateGroup) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isCandidateGroup(group)) return { ok: false as const, message: "추첨 분야를 다시 선택해 주세요.", field: null };
  try {
    const receipt = await projectShowcaseRepository.runDraw({ group, adminId: admin.adminId });
    await logAdminAudit({
      action: "showcase_public_draw",
      targetType: "showcase_event",
      targetId: PROJECT_SHOWCASE_SLUG,
      path: DRAW_PATH,
      properties: {
        candidate_group: group,
        candidate_count: receipt.candidateCount,
        ticket_count: receipt.ticketCount,
        selected_count: receipt.selectedCount,
      },
    });
    revalidateDraw();
    return {
      ok: true as const,
      message: `후보 ${receipt.candidateCount}${group === "submitter" ? "건" : `명(추첨권 ${receipt.ticketCount}장)`} 중 ${receipt.selectedCount}${group === "submitter" ? "건" : "명"}을 선정했어요.`,
    };
  } catch (error) {
    return drawFailure("draw", error);
  }
}

export async function voidShowcaseWinner(winnerId: string, reason: ShowcaseVoidReason) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isShortId(winnerId)) return { ok: false as const, message: "당첨 기록을 찾을 수 없어요.", field: null };
  if (!SHOWCASE_VOID_REASONS.includes(reason)) return { ok: false as const, message: "무효 사유를 선택해 주세요.", field: "reason" };
  try {
    await projectShowcaseRepository.voidWinner({ winnerId, adminId: admin.adminId, reason });
    await logAdminAudit({
      action: "showcase_winner_update",
      targetType: "showcase_winner",
      targetId: winnerId,
      path: DRAW_PATH,
      properties: { status: "voided", void_reason: reason },
    });
    revalidateDraw();
    return { ok: true as const, message: "당첨을 무효 처리했어요. 필요하면 재추첨해 주세요." };
  } catch (error) {
    return drawFailure("void", error);
  }
}

export async function redrawShowcaseWinner(winnerId: string) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isShortId(winnerId)) return { ok: false as const, message: "당첨 기록을 찾을 수 없어요.", field: null };
  try {
    const receipt = await projectShowcaseRepository.redrawWinner({ winnerId, adminId: admin.adminId });
    await logAdminAudit({
      action: "showcase_public_draw",
      targetType: "showcase_winner",
      targetId: winnerId,
      path: DRAW_PATH,
      properties: { candidate_group: receipt.candidateGroup, candidate_count: receipt.candidateCount, selected_count: receipt.selectedCount, redraw: true },
    });
    revalidateDraw();
    return {
      ok: true as const,
      message: receipt.selectedCount > 0 ? "1명을 재추첨했어요." : "재추첨할 후보가 없어 이 경품은 미집행으로 남아요.",
    };
  } catch (error) {
    return drawFailure("redraw", error);
  }
}

export async function setShowcaseWinnerDelivered(winnerId: string, delivered: boolean) {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  if (!isShortId(winnerId) || typeof delivered !== "boolean") {
    return { ok: false as const, message: "당첨 기록을 찾을 수 없어요.", field: null };
  }
  try {
    await projectShowcaseRepository.setWinnerDelivered({ winnerId, adminId: admin.adminId, delivered });
    await logAdminAudit({
      action: "showcase_winner_update",
      targetType: "showcase_winner",
      targetId: winnerId,
      path: DRAW_PATH,
      properties: { delivered },
    });
    revalidateDraw();
    return { ok: true as const, message: delivered ? "발송 완료로 기록했어요." : "발송 완료 표시를 취소했어요." };
  } catch (error) {
    return drawFailure("deliver", error);
  }
}

export async function settleShowcaseEvent() {
  const admin = await requireAdminPermission("events", "update", { path: DRAW_PATH });
  try {
    await projectShowcaseRepository.settleEvent(admin.adminId);
    await logAdminAudit({
      action: "showcase_event_settle",
      targetType: "showcase_event",
      targetId: PROJECT_SHOWCASE_SLUG,
      path: DRAW_PATH,
      properties: {},
    });
    revalidateDraw();
    return { ok: true as const, message: "정산 완료로 기록했어요. 30일 뒤 개인정보가 자동 파기돼요." };
  } catch (error) {
    return drawFailure("settle", error);
  }
}
