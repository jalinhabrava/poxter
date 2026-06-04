# Phase 3 handoff

## Files changed
- `src/server/publish-text.ts`
- `src/server/drafts-service.ts`
- `app/api/drafts/[id]/route.ts`
- `app/api/drafts/[id]/approve/route.ts`
- `app/api/drafts/[id]/reject/route.ts`
- `app/api/drafts/[id]/needs-review/route.ts`
- `app/api/drafts/[id]/back-to-draft/route.ts`
- `app/api/drafts/[id]/dry-run/route.ts`
- `src/server/draft-review.test.ts`
- `src/server/api-routes.test.ts`

## Behavior restored
- Edit draft `title` and `body`.
- Set status to `draft`, `needs_review`, `approved`, `rejected`.
- Dry-run returns body-only publish text.
- Title remains internal and never enters dry-run output.
- `x` dry-run validates 280-char limit.

## Verification
- `pnpm prisma generate` ✅
- `pnpm prisma db push` ✅
- `pnpm prisma:seed` ✅
- `pnpm test` ✅
- `pnpm build` ✅

## Buffer
- No Buffer call happened.
