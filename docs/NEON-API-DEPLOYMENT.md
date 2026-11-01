# Neon API deployment

## Target and safety boundary

- Neon project: `shy-silence-28583411`
- Target branch: `development` (`br-rough-block-azkcw5t3`)
- Function slug: `studioapi`
- Invocation URL: `https://br-rough-block-azkcw5t3-studioapi.compute.c-3.ap-southeast-1.aws.neon.tech`
- The deployment workflow is manual and refuses to run unless the GitHub ref is `development` and the confirmation input is exactly `DEPLOY-DEVELOPMENT`.
- The workflow deploys only to Neon branch `development`; do not change it to target production as part of routine development.
- Production is a separate branch (`br-spring-tooth-azkcw5t3`) and must remain untouched until development acceptance tests pass and the user explicitly approves a production release.

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

## Remaining acceptance tests before production

- Sign in through the development Neon Auth client and obtain a valid short-lived JWT.
- Verify `/api/v1/me` returns the authenticated JWT subject.
- Create and list a workspace and project using the authenticated user.
- Verify a viewer cannot create projects.
- Verify a second user cannot list or mutate another workspace's projects.
- Verify audit log entries are written for successful workspace/project creation.
- Test the browser's configured CORS origin and reject an untrusted origin.
- Keep PostgreSQL RLS status explicitly documented as not enabled unless policies and a non-owner database role are implemented and tested.

Never treat a successful GitHub build or Function deployment as proof that the full application flow works.
