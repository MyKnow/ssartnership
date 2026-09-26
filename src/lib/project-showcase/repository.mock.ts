import { randomUUID } from "node:crypto";
import { MOCK_MEMBER_ID } from "@/lib/mock/member";
import { ShowcaseDomainError } from "./errors";
import type {
  ProjectShowcaseRepository,
  ShowcaseAdminActivityLog,
  ShowcaseAdminActivityPage,
  ShowcaseAdminActivityType,
  ShowcaseAdminMetrics,
  ShowcaseAdminProject,
  ShowcaseEventScheduleInput,
  ShowcaseProjectFilters,
  ShowcaseProjectWriteInput,
} from "./repository";
import {
  canOwnerEditShowcaseProject,
  getShowcasePhase,
  PROJECT_SHOWCASE_SLUG,
  SHOWCASE_PROJECT_STATUSES,
  SHOWCASE_PROJECT_TYPES,
  type ShowcaseEvent,
  type ShowcaseOwnerProject,
  type ShowcaseProject,
  type ShowcaseProjectParticipant,
  type ShowcaseProjectStatus,
  type ShowcaseReviewStatus,
} from "./types";

type StoredProject = Omit<ShowcaseProject, "viewCount" | "experienceCount" | "validExperienceCount" | "interestCount"> & {
  participants: ShowcaseProjectParticipant[];
  reviewNote: string | null;
  updatedAt: string;
  withdrawnAt: string | null;
};

type ShowcaseMockStore = {
  event: ShowcaseEvent;
  memberNames: Map<string, string>;
  projects: StoredProject[];
  views: Array<{ id: string; projectId: string; memberId: string; createdAt: string }>;
  activities: ShowcaseAdminActivityLog[];
};

const scope = globalThis as typeof globalThis & { __projectShowcaseMockStore?: ShowcaseMockStore };
const DAY = 24 * 60 * 60 * 1000;

function seedProject(input: {
  id: string;
  ownerMemberId: string;
  ownerName: string;
  studentNumber: string;
  projectType: StoredProject["projectType"];
  title: string;
  summary: string;
  description: string;
  serviceUrl: string;
  createdAt: string;
}): StoredProject {
  return {
    id: input.id,
    eventId: "mock-project-showcase-event",
    ownerMemberId: input.ownerMemberId,
    projectType: input.projectType,
    title: input.title,
    teamName: null,
    summary: input.summary,
    description: input.description,
    imageUrl: "/ads/project-showcase-banner.png",
    serviceUrl: input.serviceUrl,
    status: "approved",
    createdAt: input.createdAt,
    participants: [{ name: input.ownerName, studentNumber: input.studentNumber, isOwner: true }],
    reviewNote: null,
    updatedAt: input.createdAt,
    withdrawnAt: null,
  };
}

function createStore(now = Date.now()): ShowcaseMockStore {
  return {
    event: {
      id: "mock-project-showcase-event",
      slug: PROJECT_SHOWCASE_SLUG,
      title: "내 프로젝트를 소개합니다!",
      description: "SSAFY 구성원이 직접 개발·배포한 서비스를 소개하고 함께 체험하는 이벤트예요.",
      heroImageSrc: "/ads/project-showcase-banner.png",
      submissionStartAt: new Date(now - DAY).toISOString(),
      submissionEndAt: new Date(now + 6 * DAY).toISOString(),
      experienceStartAt: new Date(now + 7 * DAY).toISOString(),
      experienceEndAt: new Date(now + 14 * DAY).toISOString(),
      announcementStartAt: new Date(now + 16 * DAY).toISOString(),
      announcementEndAt: new Date(now + 30 * DAY).toISOString(),
      submitterSelectionCount: 20,
      experiencerSelectionCount: 25,
      isActive: true,
    },
    memberNames: new Map([
      [MOCK_MEMBER_ID, "정민호"],
      ["mock-member-green-route", "이두리"],
      ["mock-member-pixel-quest", "박세모"],
    ]),
    projects: [
      {
        ...seedProject({
          id: "mock-showcase-study-buddy",
          ownerMemberId: MOCK_MEMBER_ID,
          ownerName: "정민호",
          studentNumber: "1500001",
          projectType: "web",
          title: "Study Buddy",
          summary: "팀 프로젝트에 필요한 학습 기록과 일정 관리를 한곳에 모았어요.",
          description: "학습 일정과 회고를 나눠 관리하는 웹 서비스입니다.\n\n팀원과 오늘의 목표를 공유하고 다음 작업을 함께 정리할 수 있어요.",
          serviceUrl: "https://example.com/study-buddy",
          createdAt: new Date(now - DAY / 2).toISOString(),
        }),
        teamName: "스터디버디",
        status: "changes_requested",
        reviewNote: "체험 주소가 열리지 않아요. 배포된 주소로 바꿔 다시 제출해 주세요.",
        participants: [
          { name: "정민호", studentNumber: "1500001", isOwner: true },
          { name: "천창현", studentNumber: "1500004", isOwner: false },
        ],
      },
      seedProject({
        id: "mock-showcase-green-route",
        ownerMemberId: "mock-member-green-route",
        ownerName: "이두리",
        studentNumber: "1500002",
        projectType: "app",
        title: "Green Route",
        summary: "걷기 좋은 길과 캠퍼스 주변의 작은 쉼터를 추천해요.",
        description: "걸어서 이동하는 구성원을 위해 주변 길과 쉼터를 정리한 모바일 앱입니다.",
        serviceUrl: "https://play.google.com/store/apps",
        createdAt: new Date(now - 2 * DAY).toISOString(),
      }),
      seedProject({
        id: "mock-showcase-pixel-quest",
        ownerMemberId: "mock-member-pixel-quest",
        ownerName: "박세모",
        studentNumber: "1600003",
        projectType: "game",
        title: "Pixel Quest",
        summary: "점심시간 5분 안에 끝나는 협동 퍼즐 웹 게임이에요.",
        description: "두 명이 같은 화면을 나눠 보며 퍼즐을 푸는 웹 게임입니다. 모바일 브라우저에서도 동작합니다.",
        serviceUrl: "https://example.com/pixel-quest",
        createdAt: new Date(now - 3 * DAY).toISOString(),
      }),
    ],
    views: [],
    activities: [],
  };
}

function getStore() {
  scope.__projectShowcaseMockStore ??= createStore();
  return scope.__projectShowcaseMockStore;
}

/** Test/demo helper: reset the in-memory store and optionally adjust the event. */
export function resetProjectShowcaseMockStore(input: {
  now?: number;
  event?: Partial<ShowcaseEvent>;
  memberNames?: Record<string, string>;
} = {}) {
  const store = createStore(input.now);
  Object.assign(store.event, input.event);
  for (const [memberId, name] of Object.entries(input.memberNames ?? {})) store.memberNames.set(memberId, name);
  scope.__projectShowcaseMockStore = store;
  return store;
}

function countsFor(store: ShowcaseMockStore, projectId: string) {
  return {
    viewCount: store.views.filter((view) => view.projectId === projectId).length,
    experienceCount: 0,
    validExperienceCount: 0,
    interestCount: 0,
  };
}

function toProject(store: ShowcaseMockStore, project: StoredProject): ShowcaseProject {
  return {
    id: project.id,
    eventId: project.eventId,
    ownerMemberId: project.ownerMemberId,
    projectType: project.projectType,
    title: project.title,
    teamName: project.teamName,
    summary: project.summary,
    description: project.description,
    imageUrl: project.imageUrl,
    serviceUrl: project.serviceUrl,
    status: project.status,
    createdAt: project.createdAt,
    ...countsFor(store, project.id),
  };
}

function toOwnerProject(store: ShowcaseMockStore, project: StoredProject): ShowcaseOwnerProject {
  return {
    ...toProject(store, project),
    participants: project.participants.map((participant) => ({ ...participant })),
    reviewNote: project.reviewNote,
    updatedAt: project.updatedAt,
  };
}

function buildParticipants(input: ShowcaseProjectWriteInput): ShowcaseProjectParticipant[] {
  return [
    { name: input.ownerName.trim(), studentNumber: input.submission.ownerStudentNumber, isOwner: true },
    ...input.submission.teammates.map((teammate) => ({
      name: teammate.name.trim(),
      studentNumber: teammate.studentNumber,
      isOwner: false,
    })),
  ];
}

function assertSubmissionOpen(store: ShowcaseMockStore) {
  if (getShowcasePhase(store.event) !== "submission") throw new ShowcaseDomainError("submission_closed");
}

/** Mirrors the DB unique index on (event_id, student_number): withdrawn rosters are deleted. */
function assertStudentNumbersFree(store: ShowcaseMockStore, participants: ShowcaseProjectParticipant[], exceptProjectId?: string) {
  const taken = new Set(store.projects
    .filter((project) => project.id !== exceptProjectId && project.status !== "withdrawn")
    .flatMap((project) => project.participants.map((participant) => participant.studentNumber)));
  if (participants.some((participant) => taken.has(participant.studentNumber))) {
    throw new ShowcaseDomainError("student_number_taken");
  }
}

function pushActivity(store: ShowcaseMockStore, activity: Omit<ShowcaseAdminActivityLog, "id" | "occurredAt">) {
  store.activities.push({ id: randomUUID(), occurredAt: new Date().toISOString(), ...activity });
}

export class MockProjectShowcaseRepository implements ProjectShowcaseRepository {
  async getEvent() {
    return { ...getStore().event };
  }

  async getMemberDisplayName(memberId: string) {
    return getStore().memberNames.get(memberId) ?? null;
  }

  async listPublicProjects(filters: ShowcaseProjectFilters = {}) {
    const store = getStore();
    if (getShowcasePhase(store.event) !== "experience") return [];
    const search = filters.query?.trim().toLocaleLowerCase("ko-KR");
    const projects = store.projects
      .filter((project) => project.status === "approved")
      .filter((project) => !filters.type || project.projectType === filters.type)
      .filter((project) => !search
        || `${project.title} ${project.teamName ?? ""} ${project.summary} ${project.description}`
          .toLocaleLowerCase("ko-KR").includes(search))
      .map((project) => toProject(store, project));
    return projects.sort((left, right) => filters.sort === "title"
      ? left.title.localeCompare(right.title, "ko-KR")
      : right.createdAt.localeCompare(left.createdAt));
  }

  async getPublicProject(id: string) {
    const store = getStore();
    if (getShowcasePhase(store.event) !== "experience") return null;
    const project = store.projects.find((item) => item.id === id && item.status === "approved");
    return project ? toProject(store, project) : null;
  }

  async recordUniqueView(projectId: string, memberId: string) {
    const store = getStore();
    const project = store.projects.find((item) => item.id === projectId && item.status === "approved");
    if (!project || project.ownerMemberId === memberId || getShowcasePhase(store.event) !== "experience") return;
    if (store.views.some((view) => view.projectId === projectId && view.memberId === memberId)) return;
    const view = { id: randomUUID(), projectId, memberId, createdAt: new Date().toISOString() };
    store.views.push(view);
    store.activities.push({
      id: view.id,
      occurredAt: view.createdAt,
      type: "project_viewed",
      projectId,
      projectTitle: project.title,
      actorType: "member",
      details: {},
    });
  }

  async getActiveOwnerProject(memberId: string) {
    const store = getStore();
    const project = store.projects.find((item) => item.ownerMemberId === memberId && item.status !== "withdrawn");
    return project ? toOwnerProject(store, project) : null;
  }

  async getOwnerProject(memberId: string, projectId: string) {
    const store = getStore();
    const project = store.projects.find((item) => item.id === projectId && item.ownerMemberId === memberId);
    return project ? toOwnerProject(store, project) : null;
  }

  async createProject(input: ShowcaseProjectWriteInput & { eventId: string }) {
    const store = getStore();
    assertSubmissionOpen(store);
    if (!input.imageUrl) throw new ShowcaseDomainError("image_unavailable");
    if (store.projects.some((project) => project.ownerMemberId === input.ownerMemberId && project.status !== "withdrawn")) {
      throw new ShowcaseDomainError("owner_already_submitted");
    }
    const participants = buildParticipants(input);
    assertStudentNumbersFree(store, participants);
    const now = new Date().toISOString();
    store.projects.unshift({
      id: input.projectId,
      eventId: input.eventId,
      ownerMemberId: input.ownerMemberId,
      projectType: input.submission.projectType,
      title: input.submission.title,
      teamName: input.submission.teamName,
      summary: input.submission.summary,
      description: input.submission.description,
      imageUrl: input.imageUrl,
      serviceUrl: input.submission.serviceUrl,
      status: "pending",
      createdAt: now,
      participants,
      reviewNote: null,
      updatedAt: now,
      withdrawnAt: null,
    });
    store.memberNames.set(input.ownerMemberId, input.ownerName);
  }

  async updateProject(input: ShowcaseProjectWriteInput) {
    const store = getStore();
    const project = store.projects.find((item) => item.id === input.projectId && item.ownerMemberId === input.ownerMemberId);
    if (!project) throw new ShowcaseDomainError("project_not_found");
    assertSubmissionOpen(store);
    if (!canOwnerEditShowcaseProject(project.status, getShowcasePhase(store.event))) {
      throw new ShowcaseDomainError("project_not_editable");
    }
    const participants = buildParticipants(input);
    assertStudentNumbersFree(store, participants, project.id);
    Object.assign(project, {
      projectType: input.submission.projectType,
      title: input.submission.title,
      teamName: input.submission.teamName,
      summary: input.submission.summary,
      description: input.submission.description,
      serviceUrl: input.submission.serviceUrl,
      imageUrl: input.imageUrl ?? project.imageUrl,
      status: "pending" satisfies ShowcaseProjectStatus,
      participants,
      updatedAt: new Date().toISOString(),
    });
  }

  async withdrawProject(input: { projectId: string; ownerMemberId: string }) {
    const store = getStore();
    const project = store.projects.find((item) => item.id === input.projectId && item.ownerMemberId === input.ownerMemberId);
    if (!project) throw new ShowcaseDomainError("project_not_found");
    assertSubmissionOpen(store);
    if (project.status === "withdrawn") throw new ShowcaseDomainError("project_not_editable");
    const now = new Date().toISOString();
    Object.assign(project, { status: "withdrawn", withdrawnAt: now, updatedAt: now, participants: [] });
    pushActivity(store, { type: "project_withdrawn", projectId: project.id, projectTitle: project.title, actorType: "member", details: {} });
  }

  async getAdminMetrics(): Promise<ShowcaseAdminMetrics> {
    const store = getStore();
    const statusCounts = Object.fromEntries(SHOWCASE_PROJECT_STATUSES.map((status) => [status, 0])) as ShowcaseAdminMetrics["statusCounts"];
    const projectTypeCounts = Object.fromEntries(SHOWCASE_PROJECT_TYPES.map((type) => [type, 0])) as ShowcaseAdminMetrics["projectTypeCounts"];
    for (const project of store.projects) {
      statusCounts[project.status] += 1;
      if (project.status !== "withdrawn") projectTypeCounts[project.projectType] += 1;
    }
    return {
      statusCounts,
      projectTypeCounts,
      totalUniqueViews: store.views.length,
      totalExperienceStarts: 0,
      totalValidExperiences: 0,
      totalInterests: 0,
      registeredExperiencers: 0,
      completedDraws: 0,
      activeWinners: 0,
      projectStats: store.projects
        .filter((project) => project.status === "approved")
        .sort((left, right) => left.title.localeCompare(right.title, "ko-KR"))
        .map((project) => {
          const { id, title, projectType, viewCount, experienceCount, validExperienceCount, interestCount } = toProject(store, project);
          return { id, title, projectType, viewCount, experienceCount, validExperienceCount, interestCount };
        }),
    };
  }

  async listAdminActivity(input: {
    limit: number;
    before?: { occurredAt: string; id: string } | null;
    type?: ShowcaseAdminActivityType | null;
  }): Promise<ShowcaseAdminActivityPage> {
    const store = getStore();
    const submissions: ShowcaseAdminActivityLog[] = store.projects.map((project) => ({
      id: project.id,
      occurredAt: project.createdAt,
      type: "project_submitted",
      projectId: project.id,
      projectTitle: project.title,
      actorType: "member",
      details: { projectType: project.projectType },
    }));
    const filtered = [...submissions, ...store.activities]
      .filter((activity) => !input.type || activity.type === input.type)
      .filter((activity) => !input.before
        || activity.occurredAt < input.before.occurredAt
        || (activity.occurredAt === input.before.occurredAt && activity.id < input.before.id))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id));
    const items = filtered.slice(0, input.limit);
    const lastItem = items.at(-1);
    return {
      items,
      nextCursor: filtered.length > input.limit && lastItem ? { occurredAt: lastItem.occurredAt, id: lastItem.id } : null,
    };
  }

  async listAdminProjects(status?: ShowcaseProjectStatus): Promise<ShowcaseAdminProject[]> {
    const store = getStore();
    return store.projects
      .filter((project) => !status || project.status === status)
      .map((project) => ({
        ...toProject(store, project),
        ownerDisplayName: store.memberNames.get(project.ownerMemberId) ?? "회원",
        participants: project.participants.map((participant) => ({ ...participant })),
        reviewNote: project.reviewNote,
      }));
  }

  async updateEventSchedule(input: ShowcaseEventScheduleInput) {
    const store = getStore();
    Object.assign(store.event, input);
    pushActivity(store, {
      type: "event_settings_updated",
      projectId: null,
      projectTitle: store.event.title,
      actorType: "admin",
      details: { isActive: input.isActive },
    });
  }

  async reviewProject(input: {
    projectId: string;
    adminId: string;
    status: ShowcaseReviewStatus;
    reviewNote: string;
  }) {
    const store = getStore();
    const project = store.projects.find((item) => item.id === input.projectId && item.status !== "withdrawn");
    if (!project) throw new ShowcaseDomainError("project_not_found");
    project.status = input.status;
    project.reviewNote = input.reviewNote.trim() || null;
    project.updatedAt = new Date().toISOString();
    pushActivity(store, {
      type: "project_reviewed",
      projectId: project.id,
      projectTitle: project.title,
      actorType: "admin",
      details: { status: input.status },
    });
  }
}
