# Security Policy

Report vulnerabilities privately to maintainers; never publish credentials or personal data in public issues.

- Never commit secrets or production database URLs.
- Verify identity server-side and enforce workspace membership on every protected operation.
- Encrypt social OAuth tokens at rest; never return tokens to the browser.
- Use private object storage and short-lived signed URLs.
- Apply request size, rate, quota, and spend limits.
- Keep production and development branches isolated.
