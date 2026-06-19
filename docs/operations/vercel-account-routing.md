# Vercel Account Routing

`ssartnership` is owned by a different Vercel account than some local companion projects. Do not run project-changing Vercel CLI commands through the global `vercel` login in this repo.

## Required Local Env

Store these values in a gitignored env file such as `.env.local` or the existing local `.env`:

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
node scripts/vercel-ssartnership.mjs env pull .env.production.local --environment=production --yes
node scripts/vercel-ssartnership.mjs deploy --prod
```

The wrapper loads local env files, injects `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, and passes the project-specific token to the Vercel CLI. It blocks `vercel link`, `vercel project`, `--scope`, and manual `--token` arguments so the command cannot silently fall back to another account.

## Recovery

If a global Vercel login creates a duplicate project, delete only that duplicate project from the account where it was accidentally created, then remove the local `.vercel` directory. The production project should remain the one configured with the `ssartnership.myknow.xyz` domain.
