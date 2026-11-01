# Neon Function deployment

The Hono API is bundled for Neon Functions on Node.js 24. The `Build Neon Function artifact` workflow produces `studio-api-function.zip` from the `development` branch. Deploy only to Neon branch `development` until the API, auth, and data authorization flows have passed integration tests.

Required runtime values are supplied by Neon for the branch: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL`. `CORS_ORIGINS` defaults to the GitHub Pages origin and local development. The API fails startup if the required database or auth values are absent and verifies a bearer JWT before every `/api/v1/*` route.

Function slug: `studioapi` (permanent slug; do not rename after creation). Runtime: `nodejs24`. The function URL is public, so authentication must remain mandatory. Do not expose or deploy an unauthenticated API build.
