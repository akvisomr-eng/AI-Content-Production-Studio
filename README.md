# AI Content Production Studio

A modular, free-tier-first AI-assisted content production workspace. AI generation is optional; core project, script, media, subtitle, export, and publishing-planning workflows must remain usable without paid AI providers.

## Principles
- Provider-agnostic adapters; no provider is mandatory.
- Manual media export always remains available.
- Official social platform APIs only; no browser automation to bypass platform controls.
- Secrets stay in deployment environment variables, never in source control.
- Development database branch is isolated from production.
- Original project code is MIT licensed; third-party dependencies retain their own licenses and require review.

## Planned architecture
- `apps/web`: Next.js + TypeScript static frontend.
- `apps/api`: Hono HTTP API for Neon Functions.
- `workers/media`: Python media processing jobs.
- `packages/contracts`: shared API contracts.
- `packages/shared`: shared utilities.
- `database/migrations`: versioned PostgreSQL migrations.
- `.github/workflows`: CI, Pages deployment, and media worker workflows.

## Status
Initial bootstrap. Features are delivered incrementally and require automated tests plus documented acceptance checks.
