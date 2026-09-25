import {
  createUnavailableDataAccessProxy,
  selectRuntimeDataAccess,
} from "@/lib/runtime-data-access";
import { MockProjectShowcaseRepository } from "./repository.mock";
import { SupabaseProjectShowcaseRepository } from "./repository.supabase";
import type { ProjectShowcaseRepository } from "./repository";

const dataAccess = selectRuntimeDataAccess({ capability: "admin" });

export const projectShowcaseRepository: ProjectShowcaseRepository = dataAccess.source === "mock"
  ? new MockProjectShowcaseRepository()
  : dataAccess.source === "supabase"
    ? new SupabaseProjectShowcaseRepository()
    : createUnavailableDataAccessProxy<ProjectShowcaseRepository>(
      dataAccess,
      "프로젝트 쇼케이스 데이터 저장소를 사용할 수 없습니다.",
    );

export type {
  ShowcaseCandidateGroup,
  ShowcaseEvent,
  ShowcaseOwnerProject,
  ShowcasePhase,
  ShowcaseProject,
  ShowcaseProjectStatus,
  ShowcaseProjectType,
} from "./types";
export { getShowcaseNextMilestone, getShowcasePhase, PROJECT_SHOWCASE_SLUG } from "./types";
