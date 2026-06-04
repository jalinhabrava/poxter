# Phase 2 handoff

## Rebuilt files
- `src/server/week-plan-import-service.ts`
- `src/server/drafts-service.ts`
- `app/api/import/week-plan/route.ts`
- `app/api/import/week-plan/validate/route.ts`
- `app/api/drafts/route.ts`
- `src/server/week-plan-import-service.test.ts`
- `src/server/api-routes.test.ts`
- `README.md`
- `.env.example`
- `docs/local-dev-env.md`

## Import behavior
- Validates `social-controller.week-plan.v1` before persistence.
- Imports drafts by `external_id` in `upsert_by_external_id` mode.
- Persists brand, source context, safety warnings, schedule metadata, and draft fields.
- No Buffer calls.
- No ScheduledPost creation.

## Idempotency
- Re-import with same JSON does not duplicate drafts.
- Same `external_id` updates draft fields.

## replace_week
- Replaces drafts for selected brand/week only.
- Does not touch other brands.
- Does not touch Buffer mappings.

## Tests/check result
- `pnpm prisma generate` ✅
- `pnpm prisma db push` ✅
- `pnpm prisma:seed` ✅
- `pnpm test` ✅
- `pnpm build` ✅

## Buffer
- No Buffer call happened.

## Limits
- `scheduledAt` derivation is basic; full timezone/date math can be refined later.
- Schema still uses local wrapper fallback for `db push` in this environment.
ASSESSMENT: rebuild-week-plan-import-ready

