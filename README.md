# AI Content Production Studio

A modular, free-tier-first AI-assisted content production workspace. AI generation is optional; the foundation is designed to keep project planning, scripts, media organization, subtitles, export, and publishing workflows usable without a mandatory paid AI provider.

## Principles
- Provider-agnostic adapters; no provider is mandatory.
- Manual media export remains available.
- Official social platform APIs only; no browser automation to bypass platform controls.
- Secrets stay in deployment environment variables, never in source control.
- Development database branch is isolated from production.
- Original project code is MIT licensed; third-party dependencies retain their own licenses and require review.

## Architecture
- `apps/web`: Next.js + TypeScript static frontend.
- `apps/api`: Hono HTTP API deployed as a Neon Function.
- `workers/media`: Python media-processing jobs (implementation in progress).
- `packages/contracts`: shared API contracts and validation.
- `packages/shared`: shared utilities.
- `database/migrations`: versioned PostgreSQL migrations.
- `database/tests`: rollback-only database security acceptance tests.
- `.github/workflows`: CI, GitHub Pages build/deploy, and Neon development deployment.

## Current development status

- Neon Auth browser integration: email/password sign-in and registration UI added; live browser sign-up/session acceptance remains outstanding.
- API: health, authenticated identity, workspace/project list-create, and project-scoped script list/create/update endpoints.
- Database: migration `0002_api_runtime_rls` applied to Neon development; RLS enabled on all 18 public tables.
- Tenant security: owner/viewer/outsider isolation tests passed against Neon development; viewer write denial verified for project and script operations.
- CI: frontend/API build and typecheck pass; script contract tests are rerunning after an empty-patch validation edge case was fixed.
- Neon Function: development deployment ID 3 completed; health, database security readiness, unauthenticated rejection, and invalid-token rejection smoke tests passed.
- Production: intentionally untouched; no `studioapi` function deployed to the production branch.

## Not yet production-ready

AI provider adapters and job execution, media worker, script/research/asset/subtitle/SEO workflows, real-user browser acceptance, audit-log read views, invitation/role-management flows, operational monitoring, cost controls, backup/restore rehearsal, and production deployment remain to be completed. Do not promote `development` to production until the acceptance gates in `docs/NEON-API-DEPLOYMENT.md` pass.
