# Authentication and authorization baseline

The API accepts short-lived Managed Neon Auth JWTs only. It verifies signatures against the branch-provided JWKS URL and validates the issuer derived from `NEON_AUTH_BASE_URL`. Missing auth configuration fails startup; protected API routes fail closed with HTTP 401.

Workspace membership is checked in the API for every data operation. Creating a workspace inserts its owner membership in the same transaction. Project creation requires owner/admin/editor membership; viewers cannot create content. SQL uses parameterized statements. Do not expose `DATABASE_URL`, JWKS configuration, OAuth tokens, or storage credentials to the static browser app.

The GitHub Pages origin `https://akvisomr-eng.github.io` is trusted on Neon development only. Add any future custom/preview origin explicitly and only to the correct branch. Production trusted origins, email SMTP, and OAuth credentials must be configured and verified separately before launch.

This is an application authorization layer. Do not claim PostgreSQL RLS is active until policies and a non-owner database role are implemented and tested. Neon Function URLs are public endpoints; JWT verification is mandatory before accessing application data.
