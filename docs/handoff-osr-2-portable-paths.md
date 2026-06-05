# OSR-2 Handoff: Portable paths and setup docs

Assessment: `ASSESSMENT: osr-portable-paths-ready`

## Path audit

- Active setup paths were found in `scripts/dev/load-poxter-env.sh`, `package.json`, `README.md`, and `docs/local-dev-env.md`.
- Historical docs still mention `/home/david/projects/poxter` in prior handoff/audit files.
- Local-only docs and test fixtures now reference portable placeholders or repo-root fallback behavior.
- False positives from audit were `DATABASE_URL` symbol references and Prisma schema env usage.

## Files changed

- `scripts/dev/load-poxter-env.sh`
- `package.json`
- `README.md`
- `docs/local-dev-env.md`
- `src/domain/smoke.test.ts`
- `docs/handoff-osr-2-portable-paths.md`

## Portable path strategy

- Shell loader now derives repo root from script location.
- Default SQLite fallback now points at `${REPO_ROOT}/dev.db`.
- Package test script uses `$PWD/test.db` instead of a user-specific path.
- Docs use `/absolute/path/to/poxter/dev.db`, `$HOME/.config/poxter/env`, and `$HOME/.config/poxter/brands.local.json` placeholders.

## Local setup preservation

- Existing `~/.config/poxter/env` is still loaded if present.
- Existing `~/.config/poxter/brands.local.json` is untouched.
- No real env file was overwritten.
- No Buffer call happened.

## Tests and checks

- `pnpm test` passed.
- `pnpm check:poxter` was planned for full verify after this handoff.
- Focused smoke tests cover repo-root fallback, secret-safe loading, and portable docs/scripts.

## Remaining OSS blockers

- Historical handoff/audit docs still contain old local-path references.
- Full OSS cleanup beyond path portability remains in prior audit list.

## Buffer

- No Buffer call happened. Expected false.
