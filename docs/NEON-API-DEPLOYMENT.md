# Neon API deployment

## Target and safety boundary

- Neon project: `shy-silence-28583411`
- Target branch: `development` (`br-rough-block-azkcw5t3`)
- Function slug: `studioapi`
- The deployment workflow is manual and refuses to run unless the GitHub ref is `development` and the confirmation input is exactly `DEPLOY-DEVELOPMENT`.
- Do not change the workflow to target production as part of routine development.

## One-time GitHub setup

1. In the repository settings, add an Actions secret named `NEON_API_KEY`.
2. Use a Neon project-scoped API key for project `shy-silence-28583411`; do not put the key in repository files, workflow inputs, or logs.
3. In GitHub Actions, run **Deploy Neon API (development only)** from branch `development`.
4. Enter `DEPLOY-DEVELOPMENT` as the confirmation input.

The workflow links the Neon project, explicitly checks out the Neon branch named `development`, builds the API bundle, and deploys slug `studioapi`. Neon injects branch-scoped `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL` at runtime when Auth is enabled on that branch.

## Post-deployment acceptance checks

- Read the invocation URL from Neon Functions for the development branch.
- `GET /health` must return HTTP 200 and a successful database check.
- `GET /api/v1/me` without a bearer token must return HTTP 401.
- `GET /api/v1/workspaces` without a bearer token must return HTTP 401.
- A valid Neon Auth session must be tested against `/api/v1/me`, then workspace and project creation/listing must be tested with an authenticated user.
- Verify that a second user cannot read or mutate another workspace's projects.

A successful GitHub workflow is not, by itself, proof that the HTTP endpoints or JWT verification work. Record the invocation URL and actual HTTP results in the deployment notes after smoke testing.
