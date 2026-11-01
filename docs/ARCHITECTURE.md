# Architecture

- `apps/web`: statically exported Next.js frontend on GitHub Pages; browser never connects directly to Postgres.
- `apps/api`: Hono API intended for Neon Functions; deployment waits for verified runtime/auth integration.
- `packages/contracts`: shared Zod contracts.
- `workers/media`: Python FFmpeg/transcription worker.
- Neon Postgres: records, ownership, jobs, usage, audit.
- Neon Object Storage: private media; use short-lived signed URLs.

Every protected route must verify identity and workspace role server-side. Never trust browser-supplied user IDs or roles. Encrypt OAuth tokens server-side. Provider adapters are opt-in; validate quota and estimated spend before queueing paid jobs; fail closed if pricing is unknown. Manual export is always available. Use official social APIs only. Apply migrations to Neon development first; do not modify production during development.
