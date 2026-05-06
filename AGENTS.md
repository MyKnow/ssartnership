# SSAFY Partnership Agent Instructions

나는 SSAFY 15기 지역대표로서, 15기 구성원들을 위한 서울 캠퍼스(역삼역 인근) 제휴 서비스를 운영한다. 이 프로젝트는 제휴처 탐색, 구성원 인증, 제휴 혜택 안내, 이벤트 운영을 빠르게 출시하고 안정적으로 개선하기 위한 Next.js 애플리케이션이다.

## Product Direction

- 빠른 MVP 출시와 낮은 운영 비용을 우선한다.
- 기본 스택은 Next.js App Router, Supabase, Vercel, Tailwind CSS다.
- UI는 TDS처럼 깔끔하고 일관된 디자인을 지향한다.
- 로직은 확장성과 교체 가능성을 우선한다.
- 데이터 접근은 Repository 패턴으로 감싸고 mock/Supabase 전환이 쉬워야 한다.

## Working Rules

- 기존 구조와 컴포넌트를 먼저 확인하고, 필요한 범위만 작게 수정한다.
- 파일은 기능/도메인 기준으로 응집도 있게 나눈다.
- 사용자 입력, API route, server action 경계에서는 반드시 검증한다.
- 폼 입력을 추가하거나 수정할 때는 FE 제출 전 검증과 BE route/server action/API 검증이 같은 helper/schema 또는 같은 규칙 모듈을 사용해야 한다.
- FE 검증은 UX용 사전 차단이고, BE 검증은 신뢰 경계의 필수 방어선이다. 둘 중 하나만 추가하지 않는다.
- 검증 에러 코드는 가능한 공용 메시지 매핑에 연결하고, 첫 오류 필드 focus/field error 표시를 함께 설계한다.
- Supabase service role key 같은 비밀 값은 서버 전용 코드에서만 사용한다.
- hardcoded secret, 불필요한 공개 env, 민감 정보가 담긴 에러 메시지를 남기지 않는다.
- 변경 후에는 가능한 한 집중 검증을 실행한다.

## Project Structure

```txt
src/app/                  Next.js App Router routes, layouts, loading/error states
src/components/           UI primitives and feature components
src/hooks/                Client hooks
src/lib/                  Domain logic, repositories, adapters, shared helpers
src/lib/repositories/     Repository interfaces plus mock/Supabase implementations
src/lib/supabase/         Supabase server clients
supabase/migrations/      Database migrations
supabase/schema.sql       Current schema snapshot
tests/                    Node test files for domain logic and helpers
.agents/skills/           Project-local agent skills
.codex/agents/            Codex sub-agent role definitions
```

## Repository Pattern

- UI and routes depend on services or repository interfaces, not raw Supabase queries.
- Mock and Supabase implementations must expose the same API surface.
- Repository methods should return domain models, not raw database rows.
- Mapping between Supabase rows and domain models belongs near the repository implementation.
- Business rules such as visibility, authorization, validation, and state transitions should be in service/domain helpers when they grow beyond simple mapping.

## Skills

Use the minimal relevant skill for the task:

- `ssartnership-patterns`: repository-specific Next.js, Supabase, Tailwind, Repository pattern, validation conventions
- `frontend-patterns`, `frontend-design`, `design-system`: React, Next.js UI, TDS-like visual consistency
- `backend-patterns`, `api-design`: API routes, service/repository layering, response design
- `postgres-patterns`, `database-migrations`: Supabase/PostgreSQL schema and migration work
- `security-review`: auth, secrets, input validation, RLS, sensitive endpoints
- `tdd-workflow`, `e2e-testing`, `browser-qa`, `verification-loop`: tests and release verification
- `documentation-lookup`, `nextjs-turbopack`: current framework behavior and Next.js 16+ details
- `deployment-patterns`, `git-workflow`: Vercel release and commit/PR workflow
- `market-research`, `deep-research`, `exa-search`, `content-engine`, `seo`: partnership research, public content, SEO work
- `coding-standards`, `search-first`: baseline coding quality and research-before-build workflow

## Verification

Prefer focused checks over broad expensive runs:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --test tests/<focused-test>.test.mts
```

Run `next build` only when the change touches build/runtime behavior broadly or the user asks for production verification.

## Supabase Migration Naming

- New files under `supabase/migrations/` must remain forward-only and lexicographically increasing.
- Use the actual current local time for new migration prefixes in `YYYYMMDDHHMMSS_name.sql` format.
- Before creating a migration, run `date '+%Y%m%d%H%M%S'` and use that exact timestamp as the prefix.
- The previous temporary `202605010120xx_*` sequencing convention was only for speed while the repo had future-dated migrations around May 1, 2026. Do not continue that convention for new migrations now that real time is later.
- If the generated real-time prefix would not be lexicographically greater than the latest migration already present, stop and ask before creating the file instead of inventing an artificial old prefix.
- Do not rename or edit previously applied migration files just to match real clock time.

## Git

- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.
- Write the commit description in Korean. Example: `perf: 관리자 로그 페이지네이션 쿼리 최적화`
- When a commit includes many changes, add a short Korean bullet list in the commit body. Example:
  ```text
  feat: A 기능 구현

  - A 기능 의존성 개선
  - A 기능의 B 변수 수정
  ```
- When the user asks to commit and push, use `npm run release` by default instead of manual `git add`, `git commit`, and `git push`. This keeps version bumping, Storybook build/test gates, commit formatting, and push behavior consistent.
- If `npm run release` is blocked by a non-script environment issue after it already performed part of the release flow, inspect the partial state first, then complete only the remaining equivalent steps with the same Korean conventional commit message.
- Do not revert user changes.
- Review `git diff` before staging or committing.

### Branch Strategy

- `main` is connected to Vercel Production and Supabase Production. Treat it as the production deployment branch.
- `dev` is connected to Vercel Preview and Supabase Preview. Treat it as the integration and pre-production validation branch.
- Start all planned work from `dev`, then create a typed work branch such as `feat/*`, `fix/*`, `refactor/*`, `perf/*`, `chore/*`, `docs/*`, `test/*`, or `ci/*`.
- For urgent production fixes, create `hotfix/*` branches directly from `main`.
- Complete the task and run local verification inside the typed work branch before merging it into `dev`.
- When every task for an Issue has been merged into `dev`, run Preview/integration testing from `dev`.
- Merge `dev` into `main` only after the Preview/integration test is clean and the change is ready for Production.
- For urgent production fixes, start from `main` and create a `hotfix/*` branch. After local verification, merge the hotfix into `main` first for Production recovery, then back-merge or cherry-pick the same fix into `dev` so Preview does not drift from Production.

### Issue / PR Workflow

- For planned work, create or identify a GitHub Issue before changing code.
- Treat a change as planned work whenever it touches any database migration/schema, multiple app surfaces, repository/domain contracts, admin/partner auth flows, or more than a small single-file fix. In that case, stop before implementation and create the Issue/PR plan first.
- Record scope, PR split plan, verification plan, and target branch flow in the Issue.
- Open task PRs from typed work branches into `dev`, not `main`.
- Create one focused PR per independently reviewable change.
- If one Issue needs multiple PRs, link each PR with `Refs #<issue-number>`.
- Use `Closes #<issue-number>` only when a single PR fully resolves the Issue, or when the final promotion PR intentionally closes it.
- PR descriptions must include Summary, Related Issue, Branch Flow, Changes, Test Plan, and Checklist.
- Before opening or updating a PR, review the diff and run focused verification appropriate to the changed files.
- Close the Issue only after all related work is merged into `dev`, Preview/integration verification passes, and the change has either been promoted to `main` or explicitly accepted as Preview-only.
- If implementation accidentally starts before Issue/PR setup, create the Issue immediately, document the sequencing miss in the PR, and update this workflow documentation in the same branch before review.
