# Neon API deployment

## Target and safety boundary

- Neon project: `shy-silence-28583411`
- Target branch: `development` (`br-rough-block-azkcw5t3`)
- Function slug: `studioapi`
- Invocation URL: `https://br-rough-block-azkcw5t3-studioapi.compute.c-3.ap-southeast-1.aws.neon.tech`
- Pushes touching API/contracts/migrations on `development` trigger a development-only deployment; manual dispatch still requires the exact `DEPLOY-DEVELOPMENT` confirmation.
- The workflow deploys only to Neon branch `development`; do not change it to target production as part of routine development.
- Production is a separate branch (`br-spring-tooth-az0sfcm5`) and must remain untouched until development acceptance tests pass and the user explicitly approves a production release.

## One-time GitHub setup

1. In the repository settings, add an Actions secret named `NEON_API_KEY`.
2. Use a Neon project-scoped API key for project `shy-silence-28583411`; do not put the key in repository files, workflow inputs, or logs.
3. In GitHub Actions, run **Deploy Neon API (development only)** from branch `development`.
4. Enter `DEPLOY-DEVELOPMENT` as the confirmation input.

The workflow links the Neon project, explicitly checks out the Neon branch named `development`, builds the API bundle, and deploys slug `studioapi`. Neon injects branch-scoped `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL` at runtime when Auth is enabled on that branch.

## Automated post-deployment smoke tests

After every successful deployment, GitHub Actions calls the development Function URL and verifies:

- `GET /health` returns HTTP 200 with `ok: true` and `database: "reachable"`.
- `GET /api/v1/me` without a bearer token returns HTTP 401.
- `GET /api/v1/workspaces` without a bearer token returns HTTP 401.
- `GET /api/v1/me` with a malformed bearer token returns HTTP 401.

A successful smoke test proves that the Function can serve requests, reach its database, and reject unauthenticated/invalid-token requests. It does not prove successful sign-in, acceptance of a valid JWT, workspace/project CRUD, role enforcement, or cross-user isolation.

## Development database security baseline

Migration `0002_api_runtime_rls.sql` has been applied to Neon development only.

- All 18 public tables have Row Level Security enabled and forced.
- The API switches each authenticated request into Neon's `authenticated` role inside a transaction, then sets the verified JWT subject in transaction-local `app.user_id`.
- The authenticated role has no `BYPASSRLS`; the API does not execute tenant queries as `neondb_owner`.
- Only the tables needed by the current workspace/project API have grants. Other tables remain inaccessible to the API role until endpoints and policies are deliberately implemented.
- Workspace owners/admins/editors may create projects. Viewers may read workspace projects but cannot create them. Non-members cannot read workspace or project rows.
- The API transaction commits successful writes and rolls back failed requests, including the associated audit-log write.

The repeatable, rollback-only policy test is `database/tests/0002_rls_acceptance.sql`. It creates temporary fixtures inside a subtransaction and rolls them back after checking owner access, viewer read access, viewer write denial, and outsider isolation.

## Development deployment workflow

The development API workflow now runs automatically on pushes to `development` that touch API code, shared contracts, database migrations, or the workflow itself. It is still branch-guarded to `development`, and manual dispatch still requires the exact `DEPLOY-DEVELOPMENT` confirmation. It never deploys the API to the production branch. After pinning the branch, the workflow pulls only PostgreSQL variables into the ignored `.env.development` file, verifies `NEON_BRANCH=development`, and applies pending SQL migrations in filename order using `DATABASE_URL_UNPOOLED` (or the pooled URL fallback), then runs every rollback-only SQL acceptance test in `database/tests/`. The temporary environment file is removed even if migration/test execution fails. A failed migration or database security test blocks deployment. The runner never prints connection strings. Every deployment then checks database/security readiness, unauthenticated and malformed-token rejection, and configured/untrusted CORS origins.

## Frontend configuration

The static Next.js frontend uses the official `@neondatabase/auth` browser SDK. Development routes:

- `/auth/`: email/password sign-in and registration.
- `/studio/`: authenticated workspace, project, and script draft list/create/edit.
- Public build-time variables: `NEXT_PUBLIC_AUTH_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL`.
- The GitHub Pages workflow reads those from repository Actions Variables. Configure both before publishing a Pages build. The current trusted Neon Auth origin is `https://akvisomr-eng.github.io`; the GitHub Pages project path does not change the origin.
- `.env.example` contains the development endpoints for local testing. These URLs are public configuration, not secrets.

## Remaining acceptance tests before production

- Complete an actual browser sign-up, sign-in, sign-out, and session restoration test against development Neon Auth.
- Verify a real short-lived JWT is accepted and `/api/v1/me` returns the correct subject.
- Verify workspace, project, and script create/list/update flows end-to-end from the browser.
- Verify audit-log entries are written for successful workspace/project creation.
- Test allowed and untrusted browser origins with real preflight requests.
- Add route-level automated tests for the API and browser tests for auth/session states.
- Review custom SMTP, email branding, backup/restore, rate limits, monitoring, cost alerts, and incident procedures before launch.

A successful database policy test proves the current RLS rules for the tested workspace/project/script paths; it does not replace the live JWT/API/browser acceptance tests above. Never treat a successful GitHub build or Function deployment as proof that the full application flow works.
