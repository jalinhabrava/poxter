# Phase 4 Handoff — Single Workflow Dashboard

ASSESSMENT: rebuild-single-workflow-dashboard-ready

## Summary

Implemented a warm neutral, three-zone dashboard with a single review flow column: import, review drafts, dry-run, schedule gate. The center workspace supports draft selection, title/body editing, preview, body character counter, and over-limit warning. The right rail handles selected draft actions, approve/reject all via safe sequential local API calls, workflow gates, dry-run result preview, and disabled schedule behavior.

## UX / Logic

- Brand selector renders TextifAI, OnT, and David Bitcoinpendium.
- Draft list refreshes after brand switch, import, save, approve, reject, approve all, and reject all.
- Title is explicitly internal and never included in dry-run payload.
- Body counter uses `N / 140`; body over 140 shows a readable warning.
- Dry-run stays disabled while any draft remains `draft` or `needs_review`.
- Dry-run unlocks when all drafts are `approved` or `rejected`.
- Dry-run only runs for approved drafts and shows a body-only local payload.
- Schedule stays disabled until dry-run succeeds; clicking schedule after unlock only shows a local message.

## Buffer Safety

No Buffer call happened. The UI only calls local `/api/*` routes and dry-run payloads keep `bufferCalled: false`.

## Files Changed

- `app/page.tsx`
- `src/dashboard-ui.test.tsx`
- `src/server/draft-review.test.ts`
- `docs/handoff-rebuild-phase4-single-workflow-dashboard.md`

## Verification

Commands run:

- `pnpm prisma generate`
- `pnpm prisma db push`
- `pnpm prisma:seed`
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm build`

Final command outputs are in terminal history for this run.

## Commit / Push

No commit or push performed in this run.
