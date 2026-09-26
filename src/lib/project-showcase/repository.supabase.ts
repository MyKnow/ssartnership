import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ShowcaseDomainError, showcaseErrorCodeFromDatabase } from "./errors";
import {
  SHOWCASE_ADMIN_ACTIVITY_TYPES,
  type ProjectShowcaseRepository,
  type ShowcaseAdminActivityCursor,
  type ShowcaseAdminActivityDetails,
  type ShowcaseAdminActivityLog,
  type ShowcaseAdminActivityPage,
  type ShowcaseAdminActivityType,
  type ShowcaseAdminMetrics,
  type ShowcaseAdminProject,
  type ShowcaseEventScheduleInput,
  type ShowcaseProjectFilters,
  type ShowcaseProjectWriteInput,
} from "./repository";
import {
  countShowcaseTickets,
  getShowcasePhase,
  isShowcaseProjectStatus,
  isShowcaseProjectType,
  maskShowcaseStudentNumber,
  PROJECT_SHOWCASE_SLUG,
  SHOWCASE_PROJECT_STATUSES,
  SHOWCASE_PROJECT_TYPES,
  type ShowcaseAdminFeedback,
  type ShowcaseEvent,
  type ShowcaseMemberParticipation,
  type ShowcaseMemberProjectState,
  type ShowcaseOwnerFeedback,
  type ShowcaseOwnerProject,
  type ShowcaseProject,
  type ShowcaseProjectCounts,
  type ShowcaseProjectParticipant,
  type ShowcaseProjectStatus,
  type ShowcaseReviewStatus,
} from "./types";

const EVENT_COLUMNS = "id,slug,title,description,hero_image_src,submission_start_at,submission_end_at,experience_start_at,experience_end_at,announcement_start_at,announcement_end_at,submitter_selection_count,experiencer_selection_count,is_active";
const PROJECT_COLUMNS = "id,event_id,owner_member_id,project_type,title,team_name,summary,description,image_url,service_url,status,review_note,created_at,updated_at";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  hero_image_src: string;
  submission_start_at: string | null;
  submission_end_at: string | null;
  experience_start_at: string | null;
  experience_end_at: string | null;
  announcement_start_at: string | null;
  announcement_end_at: string | null;
  submitter_selection_count: number;
  experiencer_selection_count: number;
  is_active: boolean;
};

type ProjectRow = {
  id: string;
  event_id: string;
  owner_member_id: string | null;
  project_type: string;
  title: string;
  team_name: string | null;
  summary: string;
  description: string;
  image_url: string;
  service_url: string;
  status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

type ParticipantRow = {
  project_id: string;
  name: string;
  student_number: string;
  is_owner: boolean;
  position: number;
};

const EMPTY_COUNTS: ShowcaseProjectCounts = {
  viewCount: 0,
  experienceCount: 0,
  validExperienceCount: 0,
  interestCount: 0,
};

function mapEvent(row: EventRow): ShowcaseEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    heroImageSrc: row.hero_image_src,
    submissionStartAt: row.submission_start_at,
    submissionEndAt: row.submission_end_at,
    experienceStartAt: row.experience_start_at,
    experienceEndAt: row.experience_end_at,
    announcementStartAt: row.announcement_start_at,
    announcementEndAt: row.announcement_end_at,
    submitterSelectionCount: Number(row.submitter_selection_count ?? 0),
    experiencerSelectionCount: Number(row.experiencer_selection_count ?? 0),
    isActive: row.is_active,
  };
}

function mapProject(row: ProjectRow, counts: ShowcaseProjectCounts = EMPTY_COUNTS): ShowcaseProject {
  return {
    id: row.id,
    eventId: row.event_id,
    ownerMemberId: row.owner_member_id ?? "",
    projectType: isShowcaseProjectType(row.project_type) ? row.project_type : "web",
    title: row.title,
    teamName: row.team_name,
    summary: row.summary,
    description: row.description,
    imageUrl: row.image_url,
    serviceUrl: row.service_url,
    status: isShowcaseProjectStatus(row.status) ? row.status : "hidden",
    createdAt: row.created_at,
    ...counts,
  };
}

function mapParticipants(rows: ParticipantRow[]): ShowcaseProjectParticipant[] {
  return [...rows]
    .sort((left, right) => left.position - right.position)
    .map((row) => ({ name: row.name, studentNumber: row.student_number, isOwner: row.is_owner }));
}

function mapActivityDetails(value: unknown): ShowcaseAdminActivityDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const details: ShowcaseAdminActivityDetails = {};
  if (isShowcaseProjectType(raw.project_type)) details.projectType = raw.project_type;
  if (isShowcaseProjectStatus(raw.status)) details.status = raw.status;
  if (raw.candidate_group === "submitter" || raw.candidate_group === "experiencer") {
    details.candidateGroup = raw.candidate_group;
  }
  for (const [sourceKey, targetKey] of [["candidate_count", "candidateCount"], ["selected_count", "selectedCount"]] as const) {
    const count = Number(raw[sourceKey]);
    if (Number.isSafeInteger(count) && count >= 0) details[targetKey] = count;
  }
  if (typeof raw.is_active === "boolean") details.isActive = raw.is_active;
  return details;
}

function countRecord<T extends string>(keys: readonly T[], value: unknown): Record<T, number> {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(keys.map((key) => [key, Number(raw[key] ?? 0)])) as Record<T, number>;
}

function sortProjects(projects: ShowcaseProject[], sort: ShowcaseProjectFilters["sort"]) {
  return projects.sort((left, right) => sort === "title"
    ? left.title.localeCompare(right.title, "ko-KR")
    : right.createdAt.localeCompare(left.createdAt));
}

function throwDomain(error: { message?: string } | null, fallback: string): never {
  const code = showcaseErrorCodeFromDatabase(error?.message);
  if (code !== "unknown") throw new ShowcaseDomainError(code);
  throw new Error(fallback);
}

export class SupabaseProjectShowcaseRepository implements ProjectShowcaseRepository {
  private client() {
    return getSupabaseAdminClient();
  }

  async getEvent() {
    const { data, error } = await this.client()
      .from("showcase_events")
      .select(EVENT_COLUMNS)
      .eq("slug", PROJECT_SHOWCASE_SLUG)
      .maybeSingle();
    if (error) throw new Error("쇼케이스 운영 정보를 불러오지 못했습니다.");
    return data ? mapEvent(data as EventRow) : null;
  }

  async getMemberDisplayName(memberId: string) {
    const { data, error } = await this.client()
      .from("members")
      .select("display_name")
      .eq("id", memberId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return null;
    const name = typeof data.display_name === "string" ? data.display_name.trim() : "";
    return name || null;
  }

  private async getCounts(eventId: string) {
    const { data, error } = await this.client().rpc("get_showcase_project_counts", { p_event_id: eventId });
    if (error) throw new Error("쇼케이스 통계를 불러오지 못했습니다.");
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
    return new Map<string, ShowcaseProjectCounts>(rows.map((row) => [String(row.project_id), {
      viewCount: Number(row.view_count ?? 0),
      experienceCount: Number(row.experience_count ?? 0),
      validExperienceCount: Number(row.valid_experience_count ?? 0),
      interestCount: Number(row.interest_count ?? 0),
    }]));
  }

  private async getParticipants(projectIds: string[]) {
    const byProject = new Map<string, ParticipantRow[]>();
    if (projectIds.length === 0) return byProject;
    const { data, error } = await this.client()
      .from("showcase_project_participants")
      .select("project_id,name,student_number,is_owner,position")
      .in("project_id", projectIds);
    if (error) throw new Error("프로젝트 참여자 정보를 불러오지 못했습니다.");
    for (const row of (data ?? []) as ParticipantRow[]) {
      byProject.set(row.project_id, [...(byProject.get(row.project_id) ?? []), row]);
    }
    return byProject;
  }

  private async toOwnerProject(row: ProjectRow): Promise<ShowcaseOwnerProject> {
    const [counts, participants] = await Promise.all([
      this.getCounts(row.event_id),
      this.getParticipants([row.id]),
    ]);
    return {
      ...mapProject(row, counts.get(row.id)),
      participants: mapParticipants(participants.get(row.id) ?? []),
      reviewNote: row.review_note,
      updatedAt: row.updated_at,
    };
  }

  async listPublicProjects(filters: ShowcaseProjectFilters = {}) {
    const event = await this.getEvent();
    if (!event || getShowcasePhase(event) !== "experience") return [];
    let query = this.client()
      .from("showcase_projects")
      .select(PROJECT_COLUMNS)
      .eq("event_id", event.id)
      .eq("status", "approved")
      .limit(1000);
    if (isShowcaseProjectType(filters.type)) query = query.eq("project_type", filters.type);
    const { data, error } = await query;
    if (error) throw new Error("프로젝트 목록을 불러오지 못했습니다.");
    const counts = await this.getCounts(event.id);
    const search = filters.query?.trim().toLocaleLowerCase("ko-KR");
    const projects = ((data ?? []) as ProjectRow[])
      .map((row) => mapProject(row, counts.get(row.id)))
      .filter((project) => !search
        || `${project.title} ${project.teamName ?? ""} ${project.summary} ${project.description}`
          .toLocaleLowerCase("ko-KR").includes(search));
    return sortProjects(projects, filters.sort);
  }

  async getPublicProject(id: string) {
    const event = await this.getEvent();
    if (!event || getShowcasePhase(event) !== "experience") return null;
    const { data, error } = await this.client()
      .from("showcase_projects")
      .select(PROJECT_COLUMNS)
      .eq("event_id", event.id)
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error("프로젝트 정보를 불러오지 못했습니다.");
    if (!data) return null;
    const counts = await this.getCounts(event.id);
    return mapProject(data as ProjectRow, counts.get(id));
  }

  async recordUniqueView(projectId: string, memberId: string) {
    const { error } = await this.client().rpc("record_showcase_project_view", {
      p_project_id: projectId,
      p_member_id: memberId,
    });
    if (error) throw new Error("프로젝트 조회를 기록하지 못했습니다.");
  }

  async getActiveOwnerProject(memberId: string) {
    const event = await this.getEvent();
    if (!event || !memberId) return null;
    const { data, error } = await this.client()
      .from("showcase_projects")
      .select(PROJECT_COLUMNS)
      .eq("event_id", event.id)
      .eq("owner_member_id", memberId)
      .neq("status", "withdrawn")
      .maybeSingle();
    if (error) throw new Error("내 프로젝트를 불러오지 못했습니다.");
    return data ? this.toOwnerProject(data as ProjectRow) : null;
  }

  async getOwnerProject(memberId: string, projectId: string) {
    if (!memberId || !projectId) return null;
    const { data, error } = await this.client()
      .from("showcase_projects")
      .select(PROJECT_COLUMNS)
      .eq("id", projectId)
      .eq("owner_member_id", memberId)
      .maybeSingle();
    if (error) throw new Error("내 프로젝트를 불러오지 못했습니다.");
    return data ? this.toOwnerProject(data as ProjectRow) : null;
  }

  private writeArgs(input: ShowcaseProjectWriteInput) {
    const { submission } = input;
    return {
      p_owner_member_id: input.ownerMemberId,
      p_owner_name: input.ownerName,
      p_project_type: submission.projectType,
      p_title: submission.title,
      p_team_name: submission.teamName,
      p_summary: submission.summary,
      p_description: submission.description,
      p_service_url: submission.serviceUrl,
      p_image_url: input.imageUrl,
      p_image_upload_id: input.imageUrl ? submission.imageUploadId : null,
      p_owner_student_number: submission.ownerStudentNumber,
      p_teammates: submission.teammates.map((teammate) => ({
        name: teammate.name,
        student_number: teammate.studentNumber,
      })),
    };
  }

  async createProject(input: ShowcaseProjectWriteInput & { eventId: string }) {
    if (!input.imageUrl) throw new ShowcaseDomainError("image_unavailable");
    const { data, error } = await this.client().rpc("create_showcase_project", {
      p_event_id: input.eventId,
      p_project_id: input.projectId,
      ...this.writeArgs(input),
    });
    if (error || data !== input.projectId) throwDomain(error, "프로젝트를 등록하지 못했습니다.");
  }

  async updateProject(input: ShowcaseProjectWriteInput) {
    const { error } = await this.client().rpc("update_showcase_project", {
      p_project_id: input.projectId,
      ...this.writeArgs(input),
    });
    if (error) throwDomain(error, "프로젝트를 수정하지 못했습니다.");
  }

  async withdrawProject(input: { projectId: string; ownerMemberId: string }) {
    const { error } = await this.client().rpc("withdraw_showcase_project", {
      p_project_id: input.projectId,
      p_owner_member_id: input.ownerMemberId,
    });
    if (error) throwDomain(error, "출품을 취소하지 못했습니다.");
  }

  private async requireEvent() {
    const event = await this.getEvent();
    if (!event) throw new ShowcaseDomainError("experience_closed");
    return event;
  }

  async registerParticipant(input: { memberId: string; studentNumber: string }) {
    const event = await this.requireEvent();
    const { error } = await this.client().rpc("register_showcase_participant", {
      p_event_id: event.id,
      p_member_id: input.memberId,
      p_student_number: input.studentNumber,
    });
    if (error) throwDomain(error, "참여 등록을 저장하지 못했습니다.");
  }

  async getMemberProjectState(projectId: string, memberId: string): Promise<ShowcaseMemberProjectState> {
    const event = await this.getEvent();
    if (!event || !memberId) return { registered: false, startedAt: null, feedbackSubmitted: false, interested: false };
    const client = this.client();
    const [registration, experience, feedback, interest] = await Promise.all([
      client.from("showcase_registrations").select("id").eq("event_id", event.id).eq("member_id", memberId).maybeSingle(),
      client.from("showcase_experiences").select("started_at").eq("project_id", projectId).eq("member_id", memberId).maybeSingle(),
      client.from("showcase_feedback").select("id").eq("project_id", projectId).eq("member_id", memberId).maybeSingle(),
      client.from("showcase_interests").select("id").eq("project_id", projectId).eq("member_id", memberId).maybeSingle(),
    ]);
    if (registration.error || experience.error || feedback.error || interest.error) {
      throw new Error("체험 상태를 불러오지 못했습니다.");
    }
    return {
      registered: Boolean(registration.data),
      startedAt: experience.data?.started_at ?? null,
      feedbackSubmitted: Boolean(feedback.data),
      interested: Boolean(interest.data),
    };
  }

  async startExperience(input: { projectId: string; memberId: string }) {
    const { data, error } = await this.client().rpc("start_showcase_experience", {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
    });
    if (error || typeof data !== "string") throwDomain(error, "체험 시작을 기록하지 못했습니다.");
    return { startedAt: data };
  }

  async submitFeedback(input: { projectId: string; memberId: string; body: string }) {
    const { error } = await this.client().rpc("submit_showcase_feedback", {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_body: input.body,
    });
    if (error) throwDomain(error, "피드백을 저장하지 못했습니다.");
  }

  async setInterest(input: { projectId: string; memberId: string; interested: boolean }) {
    const { error } = await this.client().rpc("set_showcase_interest", {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_interested: input.interested,
    });
    if (error) throwDomain(error, "관심 표시를 저장하지 못했습니다.");
  }

  async getMemberParticipation(memberId: string): Promise<ShowcaseMemberParticipation> {
    const event = await this.getEvent();
    if (!event || !memberId) return { registration: null, experiences: [], ticketCount: 0 };
    const client = this.client();
    const [registration, experiences, feedback] = await Promise.all([
      client.from("showcase_registrations").select("student_number,created_at").eq("event_id", event.id).eq("member_id", memberId).maybeSingle(),
      client.from("showcase_experiences").select("project_id,started_at").eq("event_id", event.id).eq("member_id", memberId).order("started_at", { ascending: false }),
      client.from("showcase_feedback").select("project_id").eq("event_id", event.id).eq("member_id", memberId),
    ]);
    if (registration.error || experiences.error || feedback.error) throw new Error("참여 현황을 불러오지 못했습니다.");
    const projectIds = (experiences.data ?? []).map((row) => row.project_id as string);
    const titles = new Map<string, string>();
    if (projectIds.length > 0) {
      const projects = await client.from("showcase_projects").select("id,title").in("id", projectIds);
      if (projects.error) throw new Error("참여 현황을 불러오지 못했습니다.");
      for (const row of projects.data ?? []) titles.set(row.id as string, row.title as string);
    }
    const completed = new Set((feedback.data ?? []).map((row) => row.project_id as string));
    const items = (experiences.data ?? []).map((row) => ({
      projectId: row.project_id as string,
      projectTitle: titles.get(row.project_id as string) ?? "프로젝트",
      startedAt: row.started_at as string,
      feedbackSubmitted: completed.has(row.project_id as string),
    }));
    return {
      registration: registration.data?.student_number
        ? {
          maskedStudentNumber: maskShowcaseStudentNumber(registration.data.student_number as string),
          registeredAt: registration.data.created_at as string,
        }
        : null,
      experiences: items,
      ticketCount: countShowcaseTickets(items),
    };
  }

  async listMemberCompletedProjectIds(memberId: string) {
    const event = await this.getEvent();
    if (!event || !memberId) return [];
    const { data, error } = await this.client()
      .from("showcase_feedback")
      .select("project_id")
      .eq("event_id", event.id)
      .eq("member_id", memberId);
    if (error) throw new Error("체험 기록을 불러오지 못했습니다.");
    return (data ?? []).map((row) => row.project_id as string);
  }

  async listOwnerFeedback(memberId: string, projectId: string): Promise<ShowcaseOwnerFeedback[]> {
    const owned = await this.client()
      .from("showcase_projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_member_id", memberId)
      .maybeSingle();
    if (owned.error) throw new Error("피드백을 불러오지 못했습니다.");
    if (!owned.data) return [];
    // Only the body leaves the database: no author, no timestamp.
    const { data, error } = await this.client()
      .from("showcase_feedback")
      .select("id,body")
      .eq("project_id", projectId)
      .is("hidden_at", null)
      .order("id", { ascending: true })
      .limit(1000);
    if (error) throw new Error("피드백을 불러오지 못했습니다.");
    return (data ?? []).map((row) => ({ id: row.id as string, body: row.body as string }));
  }

  async listAdminFeedback(input: { hidden?: boolean } = {}): Promise<ShowcaseAdminFeedback[]> {
    const event = await this.getEvent();
    if (!event) return [];
    let query = this.client()
      .from("showcase_feedback")
      .select("id,project_id,body,hidden_at,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (input.hidden === true) query = query.not("hidden_at", "is", null);
    if (input.hidden === false) query = query.is("hidden_at", null);
    const { data, error } = await query;
    if (error) throw new Error("피드백 목록을 불러오지 못했습니다.");
    const rows = data ?? [];
    const projectIds = [...new Set(rows.map((row) => row.project_id as string))];
    const titles = new Map<string, string>();
    if (projectIds.length > 0) {
      const projects = await this.client().from("showcase_projects").select("id,title").in("id", projectIds);
      if (projects.error) throw new Error("피드백 목록을 불러오지 못했습니다.");
      for (const row of projects.data ?? []) titles.set(row.id as string, row.title as string);
    }
    return rows.map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      projectTitle: titles.get(row.project_id as string) ?? "프로젝트",
      body: row.body as string,
      hidden: Boolean(row.hidden_at),
      createdAt: row.created_at as string,
    }));
  }

  async setFeedbackHidden(input: { feedbackId: string; adminId: string; hidden: boolean }) {
    const { error } = await this.client().rpc("set_showcase_feedback_hidden", {
      p_feedback_id: input.feedbackId,
      p_admin_id: input.adminId,
      p_hidden: input.hidden,
    });
    if (error) throwDomain(error, "피드백 공개 상태를 바꾸지 못했습니다.");
  }

  async getAdminMetrics(): Promise<ShowcaseAdminMetrics | null> {
    const event = await this.getEvent();
    if (!event) return null;
    const { data, error } = await this.client().rpc("get_showcase_admin_metrics", { p_event_id: event.id });
    if (error) throw new Error("쇼케이스 집계를 불러오지 못했습니다.");
    const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
    if (!row) return null;
    const count = (key: string) => Number(row[key] ?? 0);
    const projectStats = (Array.isArray(row.project_stats) ? row.project_stats : []).flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const project = value as Record<string, unknown>;
      if (typeof project.id !== "string" || typeof project.title !== "string" || !isShowcaseProjectType(project.project_type)) {
        return [];
      }
      return [{
        id: project.id,
        title: project.title,
        projectType: project.project_type,
        viewCount: Number(project.view_count ?? 0),
        experienceCount: Number(project.experience_count ?? 0),
        validExperienceCount: Number(project.valid_experience_count ?? 0),
        interestCount: Number(project.interest_count ?? 0),
      }];
    });
    return {
      statusCounts: countRecord(SHOWCASE_PROJECT_STATUSES, row.status_counts),
      projectTypeCounts: countRecord(SHOWCASE_PROJECT_TYPES, row.type_counts),
      totalUniqueViews: count("total_unique_views"),
      totalExperienceStarts: count("total_experience_starts"),
      totalValidExperiences: count("total_valid_experiences"),
      totalInterests: count("total_interests"),
      registeredExperiencers: count("registered_experiencers"),
      completedDraws: count("completed_draws"),
      activeWinners: count("active_winners"),
      projectStats,
    };
  }

  async listAdminActivity(input: {
    limit: number;
    before?: ShowcaseAdminActivityCursor | null;
    type?: ShowcaseAdminActivityType | null;
  }): Promise<ShowcaseAdminActivityPage> {
    const event = await this.getEvent();
    if (!event) return { items: [], nextCursor: null };
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new Error("로그 페이지 크기가 올바르지 않습니다.");
    }
    if (input.type && !SHOWCASE_ADMIN_ACTIVITY_TYPES.includes(input.type)) {
      throw new Error("로그 유형이 올바르지 않습니다.");
    }
    const { data, error } = await this.client().rpc("list_showcase_admin_activity", {
      p_event_id: event.id,
      p_limit: input.limit + 1,
      p_before_at: input.before?.occurredAt ?? null,
      p_before_id: input.before?.id ?? null,
      p_activity_type: input.type ?? null,
    });
    if (error) throw new Error("쇼케이스 이벤트 로그를 불러오지 못했습니다.");
    const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    const items: ShowcaseAdminActivityLog[] = rows.slice(0, input.limit).flatMap((row) => {
      const type = row.activity_type as ShowcaseAdminActivityType;
      if (!SHOWCASE_ADMIN_ACTIVITY_TYPES.includes(type)) return [];
      return [{
        id: String(row.activity_id),
        occurredAt: String(row.occurred_at),
        type,
        projectId: typeof row.project_id === "string" ? row.project_id : null,
        projectTitle: String(row.project_title ?? ""),
        actorType: row.actor_type === "admin" ? "admin" : "member",
        details: mapActivityDetails(row.details),
      }];
    });
    const lastItem = items.at(-1);
    return {
      items,
      nextCursor: rows.length > input.limit && lastItem ? { occurredAt: lastItem.occurredAt, id: lastItem.id } : null,
    };
  }

  async listAdminProjects(status?: ShowcaseProjectStatus): Promise<ShowcaseAdminProject[]> {
    const event = await this.getEvent();
    if (!event) return [];
    let query = this.client()
      .from("showcase_projects")
      .select(PROJECT_COLUMNS)
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error("출품 목록을 불러오지 못했습니다.");
    const rows = (data ?? []) as ProjectRow[];
    if (rows.length === 0) return [];
    const ownerIds = [...new Set(rows.flatMap((row) => row.owner_member_id ? [row.owner_member_id] : []))];
    const [counts, participants, membersResult] = await Promise.all([
      this.getCounts(event.id),
      this.getParticipants(rows.map((row) => row.id)),
      this.client().from("members").select("id,display_name").in("id", ownerIds),
    ]);
    if (membersResult.error) throw new Error("출품자 정보를 불러오지 못했습니다.");
    const names = new Map((membersResult.data ?? []).map((member: { id: string; display_name: string | null }) => [
      member.id,
      member.display_name ?? "회원",
    ]));
    return rows.map((row) => ({
      ...mapProject(row, counts.get(row.id)),
      ownerDisplayName: (row.owner_member_id && names.get(row.owner_member_id)) || "회원",
      participants: mapParticipants(participants.get(row.id) ?? []),
      reviewNote: row.review_note,
    }));
  }

  async updateEventSchedule(input: ShowcaseEventScheduleInput) {
    const { error } = await this.client()
      .from("showcase_events")
      .update({
        submission_start_at: input.submissionStartAt,
        submission_end_at: input.submissionEndAt,
        experience_start_at: input.experienceStartAt,
        experience_end_at: input.experienceEndAt,
        announcement_start_at: input.announcementStartAt,
        announcement_end_at: input.announcementEndAt,
        submitter_selection_count: input.submitterSelectionCount,
        experiencer_selection_count: input.experiencerSelectionCount,
        is_active: input.isActive,
      })
      .eq("slug", PROJECT_SHOWCASE_SLUG);
    if (error) throw new Error("이벤트 운영 설정을 저장하지 못했습니다.");
  }

  async reviewProject(input: {
    projectId: string;
    adminId: string;
    status: ShowcaseReviewStatus;
    reviewNote: string;
  }) {
    const { error } = await this.client().rpc("review_showcase_project", {
      p_project_id: input.projectId,
      p_admin_id: input.adminId,
      p_status: input.status,
      p_review_note: input.reviewNote,
    });
    if (error) throwDomain(error, "프로젝트 검수 결과를 저장하지 못했습니다.");
  }
}
