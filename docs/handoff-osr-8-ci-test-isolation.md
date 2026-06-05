# OSR-8 handoff — CI test isolation from local PoXter config

## Scope

Close out OSR-8 on branch `rebuild-split` without changing repository visibility.

## CI failure root cause

GitHub Actions and local test runs were not isolated from machine-local brand config.

Root cause:
- brand registry resolution fell back to `$HOME/.config/poxter/brands.local.json`
- tests and seeding could pick up private local brands instead of deterministic repo fixtures
- CI and clean-home runs failed with `brand.slug` because example/private brand names were not aligned

## RED reproduction

Reproduced locally with a clean `HOME` and no fixture override:
- `HOME=$(mktemp -d) DATABASE_URL=file:$(pwd)/tmp-ci-repro.db pnpm prisma generate`
- `HOME=$(mktemp -d) DATABASE_URL=file:$(pwd)/tmp-ci-repro.db pnpm prisma db push`
- `HOME=$(mktemp -d) DATABASE_URL=file:$(pwd)/tmp-ci-repro.db pnpm prisma:seed`
- `HOME=$(mktemp -d) DATABASE_URL=file:$(pwd)/tmp-ci-repro.db pnpm test`

Observed failure:
- multiple suite failures around `brand.slug`
- tests were resolving local/example brand config instead of deterministic test brands

## Deterministic fixture solution

Implemented:
- `tests/fixtures/brands.test.json`
- `src/test/setup.ts` to force `POXTER_BRANDS_FILE` and isolated `DATABASE_URL`
- `vitest.config.ts` wiring the fixture into Vitest env
- `pnpm test:ci` for CI-like test execution
- CI workflow env override for `POXTER_BRANDS_FILE`
- `scripts/dev/poxter-check.sh` now uses `pnpm test:ci`
- default-brand tests explicitly opt out of fixture when they need fallback behavior

## Verification

Local results:
- `pnpm test:ci` passed: 10 files, 71 tests
- `pnpm check:poxter` passed
- `pnpm build` passed
- `BUILD_OK` observed on final build run

## Repo state

- repository visibility: private
- Buffer calls: false
- CI passed at run `27035203623`
- active private brand profiles removed
- tests isolated from local config
- repo remains private until explicit visibility flip
- live scheduling: not run
- temp DB cleaned: yes

## Pending

GitHub Actions run `27035203623` passed.

## Final recommendation

PUBLIC_RELEASE_READY: yes

RECOMMENDATION: safe_to_publish_now

ASSESSMENT: osr-public-ready
