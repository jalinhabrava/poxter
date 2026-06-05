# Security Policy

## Status

PoXter is an early, private-prep project moving toward a public open-source release. Treat the repository and local installs as developer-operated tooling, not a hardened public service.

## Reporting vulnerabilities

Open a GitHub security advisory once the repository is public.

## Supported versions

Only the current development branch is supported during this early phase. Security fixes should target the active release-prep branch unless project maintainers decide otherwise.

## Secret handling

- Never commit Buffer API keys.
- Store real local secrets in `$HOME/.config/poxter/env`.
- Use `.env.example` only for placeholders.
- Redact secrets from logs, issues, screenshots, and test output.

## Local-first architecture

- PoXter uses a local SQLite database by default.
- Buffer API access is allowed only for explicit user actions.
- Dry-run mode should never call Buffer.
- Tests and CI must pass without `BUFFER_API_KEY`.

## Deployment warning

Do not expose PoXter publicly without authentication, authorization, secret-management review, and reverse-proxy hardening.
