# PoXter Config Cleanup Handoff

ASSESSMENT: poxter-config-cleanup-ready

## Summary

Removed active Social Controller legacy config and script names from current PoXter workflows.

## New Active Names

- Env path: `~/.config/poxter/env`
- Dev command: `pnpm dev:poxter`
- Check command: `pnpm check:poxter`
- Env vars: `POXTER_HOST`, `POXTER_PORT`, `DATABASE_URL`, `BUFFER_API_KEY`

## Script Files Renamed

- `scripts/dev/load-social-controller-env.sh` -> `scripts/dev/load-poxter-env.sh`
- `scripts/dev/social-controller-dev.sh` -> `scripts/dev/poxter-dev.sh`
- `scripts/dev/social-controller-check.sh` -> `scripts/dev/poxter-check.sh`

## Local Env Migration

- Legacy env existed: true
- PoXter env existed before migration: false
- Created `~/.config/poxter/env` from legacy env without printing secrets.
- Updated non-secret path/name references inside copied env file.
- Legacy env file was not deleted.

## Verification

Commands run from `/home/david/projects/poxter`:

- `pnpm prisma generate`: passed
- `pnpm prisma db push`: passed
- `pnpm prisma:seed`: passed
- `pnpm test`: passed (`9` files, `68` tests)
- `pnpm build`: passed
- `pnpm check:poxter`: passed (`pnpm test` and `pnpm build`)

## Legacy Reference Audit

Intentional remaining references:

- `social-controller.week-plan.v1` schema version remains unchanged for compatibility.
- Historical handoff docs keep old app/repo references where they describe rename history.
- Tests assert old script/env names are absent.

## Safety

- Buffer call happened: false
- X/Twitter API used: false
- x.com/browser automation used: false
- Secrets printed: false
