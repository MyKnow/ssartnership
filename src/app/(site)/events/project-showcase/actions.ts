"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { resolveImageUploadActorForServerAction } from "@/lib/image-upload/auth.server";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { ShowcaseDomainError, toShowcaseFailure } from "@/lib/project-showcase/errors";
import { getShowcasePhase, PROJECT_SHOWCASE_SLUG } from "@/lib/project-showcase/types";
import {
  parseShowcaseFeedback,
  parseShowcaseProjectSubmission,
  parseShowcaseRegistration,
} from "@/lib/project-showcase/validation";
import { getSignedUserSession } from "@/lib/user-auth";

const EVENT_PATH = `/events/${PROJECT_SHOWCASE_SLUG}`;
const ADMIN_PATH = "/admin/events/project-showcase";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseSubmissionForm(formData: FormData, requireImage: boolean) {
  return parseShowcaseProjectSubmission({
    projectType: readString(formData, "projectType"),
    title: readString(formData, "title"),
    teamName: readString(formData, "teamName"),
    summary: readString(formData, "summary"),
    description: readString(formData, "description"),
    serviceUrl: readString(formData, "serviceUrl"),
    imageUploadId: readString(formData, "imageUploadId") || null,
    announcementConsent: readString(formData, "announcementConsent") === "true",
  }, { requireImage });
}

async function attachCoverImage(projectId: string, uploadId: string) {
  try {
    const actor = await resolveImageUploadActorForServerAction("showcase-project", "member");
    const attached = await getImageUploadRepository().attach({
      actor,
      purpose: "showcase-project",
      uploadId,
      role: "image",
      policy: resolveImageTransformPolicy("showcase-project", "image"),
      destination: {
        bucket: "showcase-projects",
        path: `project-showcase/${projectId}/${uploadId}.webp`,
        isPublic: true,
        cacheControl: "31536000",
      },
      resource: { type: "showcase_project", id: projectId },
    });
    if (!attached.url) throw new ShowcaseDomainError("image_unavailable");
    return attached.url;
  } catch (error) {
    if (error instanceof ShowcaseDomainError) throw error;
    console.error("[project-showcase/image]", error instanceof Error ? error.message : "unknown");
    throw new ShowcaseDomainError("image_unavailable");
  }
}

function revalidateShowcase(projectId?: string) {
  revalidatePath(EVENT_PATH);
  revalidatePath(`${EVENT_PATH}/my`);
  if (projectId) revalidatePath(`${EVENT_PATH}/my/projects/${projectId}`);
  revalidatePath(ADMIN_PATH);
}

async function requireOwner() {
  const session = await getSignedUserSession();
  if (!session?.userId) return null;
  const ownerName = await projectShowcaseRepository.getMemberDisplayName(session.userId);
  return { memberId: session.userId, ownerName };
}

function logUnexpected(scope: string, error: unknown) {
  if (error instanceof ShowcaseDomainError) return;
  console.error(`[project-showcase/${scope}]`, error instanceof Error ? error.message : "unknown");
}

export async function submitShowcaseProject(formData: FormData) {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const, message: "로그인 후 프로젝트를 출품해 주세요.", field: null };
  if (!owner.ownerName) return toShowcaseFailure(new ShowcaseDomainError("owner_name_unavailable"));

  const event = await projectShowcaseRepository.getEvent();
  if (!event || getShowcasePhase(event) !== "submission") {
    return toShowcaseFailure(new ShowcaseDomainError("submission_closed"));
  }
  const parsed = parseSubmissionForm(formData, true);
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };

  const projectId = randomUUID();
  try {
    const imageUrl = await attachCoverImage(projectId, parsed.data.imageUploadId!);
    await projectShowcaseRepository.createProject({
      eventId: event.id,
      projectId,
      ownerMemberId: owner.memberId,
      ownerName: owner.ownerName,
      submission: parsed.data,
      imageUrl,
    });
    revalidateShowcase(projectId);
    return { ok: true as const, projectId, message: "출품을 접수했어요. 운영진 확인 후 결과를 알려 드릴게요." };
  } catch (error) {
    logUnexpected("submit", error);
    return toShowcaseFailure(error);
  }
}

export async function updateShowcaseProject(formData: FormData) {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const, message: "로그인 후 다시 시도해 주세요.", field: null };
  if (!owner.ownerName) return toShowcaseFailure(new ShowcaseDomainError("owner_name_unavailable"));
  const projectId = readString(formData, "projectId");
  if (!projectId || projectId.length > 128) return toShowcaseFailure(new ShowcaseDomainError("project_not_found"));

  const parsed = parseSubmissionForm(formData, false);
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  try {
    const imageUrl = parsed.data.imageUploadId ? await attachCoverImage(projectId, parsed.data.imageUploadId) : null;
    await projectShowcaseRepository.updateProject({
      projectId,
      ownerMemberId: owner.memberId,
      ownerName: owner.ownerName,
      submission: parsed.data,
      imageUrl,
    });
    revalidateShowcase(projectId);
    return { ok: true as const, projectId, message: "수정한 내용으로 다시 제출했어요. 운영진이 다시 확인할게요." };
  } catch (error) {
    logUnexpected("update", error);
    return toShowcaseFailure(error);
  }
}

export async function withdrawShowcaseProject(projectId: string) {
  const owner = await requireOwner();
  if (!owner) return { ok: false as const, message: "로그인 후 다시 시도해 주세요.", field: null };
  if (typeof projectId !== "string" || !projectId || projectId.length > 128) {
    return toShowcaseFailure(new ShowcaseDomainError("project_not_found"));
  }
  try {
    await projectShowcaseRepository.withdrawProject({ projectId, ownerMemberId: owner.memberId });
    revalidateShowcase(projectId);
    return { ok: true as const, message: "출품을 취소했어요. 모집 기간 안에는 다시 출품할 수 있어요." };
  } catch (error) {
    logUnexpected("withdraw", error);
    return toShowcaseFailure(error);
  }
}

export async function recordShowcaseProjectView(projectId: string) {
  if (typeof projectId !== "string" || !projectId || projectId.length > 128) return { ok: false as const };
  const session = await getSignedUserSession();
  if (!session?.userId || await getAdminSession()) return { ok: false as const };
  try {
    await projectShowcaseRepository.recordUniqueView(projectId, session.userId);
    return { ok: true as const };
  } catch (error) {
    logUnexpected("view", error);
    return { ok: false as const };
  }
}

function readProjectId(projectId: unknown) {
  return typeof projectId === "string" && projectId.length > 0 && projectId.length <= 128 ? projectId : null;
}

async function requireMember() {
  const session = await getSignedUserSession();
  return session?.userId ?? null;
}

export async function registerShowcaseParticipant(input: {
  announcementConsent: boolean;
}) {
  const memberId = await requireMember();
  if (!memberId) return { ok: false as const, message: "로그인 후 참여 등록을 해 주세요.", field: null };
  const parsed = parseShowcaseRegistration(input);
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  try {
    await projectShowcaseRepository.registerParticipant({ memberId });
    revalidatePath(`${EVENT_PATH}/my`);
    return { ok: true as const, message: "참여 등록을 마쳤어요. 이제 체험을 시작할 수 있어요." };
  } catch (error) {
    logUnexpected("register", error);
    const failure = toShowcaseFailure(error);
    return failure;
  }
}

export async function startShowcaseExperience(projectId: string) {
  const id = readProjectId(projectId);
  const memberId = await requireMember();
  if (!memberId) return { ok: false as const, message: "로그인 후 체험해 주세요.", field: null };
  if (!id) return toShowcaseFailure(new ShowcaseDomainError("project_not_found"));
  try {
    const project = await projectShowcaseRepository.getPublicProject(id);
    if (!project) throw new ShowcaseDomainError("project_not_found");
    const { startedAt } = await projectShowcaseRepository.startExperience({ projectId: id, memberId });
    revalidatePath(`${EVENT_PATH}/my`);
    return { ok: true as const, destination: project.serviceUrl, startedAt, serverNow: new Date().toISOString() };
  } catch (error) {
    logUnexpected("experience", error);
    return toShowcaseFailure(error);
  }
}

export async function submitShowcaseFeedback(projectId: string, body: string) {
  const id = readProjectId(projectId);
  const memberId = await requireMember();
  if (!memberId) return { ok: false as const, message: "로그인 후 피드백을 남겨 주세요.", field: null };
  if (!id) return toShowcaseFailure(new ShowcaseDomainError("project_not_found"));
  const parsed = parseShowcaseFeedback(body);
  if (!parsed.success) return { ok: false as const, message: parsed.message, field: parsed.field };
  try {
    await projectShowcaseRepository.submitFeedback({ projectId: id, memberId, body: parsed.data.body });
    revalidatePath(EVENT_PATH);
    revalidatePath(`${EVENT_PATH}/my`);
    return { ok: true as const, message: "피드백을 남겼어요. 추첨권 1장을 받았어요." };
  } catch (error) {
    logUnexpected("feedback", error);
    return toShowcaseFailure(error);
  }
}

export async function setShowcaseInterest(projectId: string, interested: boolean) {
  const id = readProjectId(projectId);
  const memberId = await requireMember();
  if (!memberId) return { ok: false as const, message: "로그인 후 관심 표시를 해 주세요.", field: null };
  if (!id || typeof interested !== "boolean") return toShowcaseFailure(new ShowcaseDomainError("project_not_found"));
  try {
    await projectShowcaseRepository.setInterest({ projectId: id, memberId, interested });
    return { ok: true as const, interested };
  } catch (error) {
    logUnexpected("interest", error);
    return toShowcaseFailure(error);
  }
}
