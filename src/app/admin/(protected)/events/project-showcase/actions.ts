"use server";

import { revalidatePath } from "next/cache";
import { logAdminAudit } from "@/lib/activity-logs";
import { requireAdminPermission } from "@/lib/admin-access";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { ShowcaseDomainError, toShowcaseFailure } from "@/lib/project-showcase/errors";
import { PROJECT_SHOWCASE_SLUG } from "@/lib/project-showcase/types";
import {
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
