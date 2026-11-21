---
title: Vercel Account Routing
type: history
status: archived
authority: evidence
---

# Vercel Account Routing

> 역사 기록: 2026-10 PVE 자체 호스팅 이전 뒤 Vercel 배포와 프로젝트 설정 작업은 운영 경로에서 빠졌다. 이 절차를 현재 runbook으로 실행하지 않는다. 현재 배포는 [자체 호스팅 격리 CI·배포·유지보수](../../operations/runbooks/self-host-ci-maintenance.md)를, 기본 결정은 [2026-10 리팩토링·개선 프로그램](../../plans/active/refactor-program-2026-10.md)을 따른다.

`ssartnership` is owned by a different Vercel account than some local companion projects. Do not run project-changing Vercel CLI commands through the global `vercel` login in this repo.

## Required Local Env

Store these values in the single gitignored local `.env` file. Keep `.env.example` limited to variable names and non-secret examples:

```bash
SSARTNERSHIP_VERCEL_TOKEN=vercel_token_for_the_ssartnership_account
SSARTNERSHIP_VERCEL_ORG_ID=team_or_user_id_for_the_ssartnership_project
SSARTNERSHIP_VERCEL_PROJECT_ID=prj_id_for_ssartnership
```

Do not use `VERCEL_TOKEN` as the project selector for local work. The generic name is too easy to reuse across projects.

## Safe CLI Entry

Run Vercel commands through the project wrapper:

```bash
node scripts/vercel-ssartnership.mjs env ls production
node scripts/vercel-ssartnership.mjs env ls preview
node scripts/vercel-ssartnership.mjs deploy --prod
```

The wrapper loads only `.env`, injects `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and a child-process-only `VERCEL_TOKEN` for the Vercel CLI. It blocks `vercel link`, `vercel project`, `--scope`, and manual `--token` arguments so the command cannot silently fall back to another account.

## Recovery

If a global Vercel login creates a duplicate project, delete only that duplicate project from the account where it was accidentally created, then remove the local `.vercel` directory. The production project should remain the one configured with the `ssartnership.myknow.xyz` domain.
