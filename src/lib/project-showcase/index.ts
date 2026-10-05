import { cache } from "react";
import {
  createUnavailableDataAccessProxy,
  selectRuntimeDataAccess,
} from "@/lib/runtime-data-access";
import { MockProjectShowcaseRepository } from "./repository.mock";
import { SupabaseProjectShowcaseRepository } from "./repository.supabase";
import type { ProjectShowcaseRepository } from "./repository";

const dataAccess = selectRuntimeDataAccess({ capability: "admin" });

/**
 * `generateMetadata`, the page and shared helpers (home carousel visibility)
 * read the same event and project during one render. Memoize those two public
 * reads per request; React `cache` is a pass-through outside rendering, so
 * server actions still read fresh rows after a mutation.
 */
export function withRequestScopedShowcaseReads(
  repository: ProjectShowcaseRepository,
): ProjectShowcaseRepository {
  const getEvent = cache(() => repository.getEvent());
  const getPublicProject = cache((projectId: string) =>
    repository.getPublicProject(projectId),
  );

  return new Proxy(repository, {
    get(target, property) {
      if (property === "getEvent") {
        return getEvent;
      }
      if (property === "getPublicProject") {
        return getPublicProject;
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const projectShowcaseRepository: ProjectShowcaseRepository = withRequestScopedShowcaseReads(
  dataAccess.source === "mock"
    ? new MockProjectShowcaseRepository()
    : dataAccess.source === "supabase"
      ? new SupabaseProjectShowcaseRepository()
      : createUnavailableDataAccessProxy<ProjectShowcaseRepository>(
        dataAccess,
        "프로젝트 쇼케이스 데이터 저장소를 사용할 수 없습니다.",
      ),
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
