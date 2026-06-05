# OSR-3/5 Public Release Prep Handoff

## Files added

- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `.env.example`

## License

MIT, copyright `David Noya Hervás`.

## CI behavior

- Runs on `pull_request` and pushes to `rebuild-split` and `main`.
- Uses Node 20 with Corepack and pnpm.
- Sets `DATABASE_URL` to a local SQLite path in CI.
- Does not set `BUFFER_API_KEY`.
- Runs Prisma generate, db push, seed, tests, build, and `pnpm check:poxter`.

## README and env status

- README now explains what PoXter is, what it is not, safety model, quickstart, brand config, schedule JSON docs, Buffer setup, and license.
- `.env.example` exists with placeholder-only values.

## Remaining blockers

- Keep repo private until final content scan and deployment hardening are done.
- Review any private demo content before a public visibility flip.

## Check result

- `pnpm check:poxter` passed.

## Repo visibility

- Repo remains private.

## Buffer calls

- false
