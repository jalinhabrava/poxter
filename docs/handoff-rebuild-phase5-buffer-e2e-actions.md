# Handoff — Rebuild Phase 5 Buffer E2E Actions

## Files changed
- `prisma/schema.prisma`: adds Buffer channel cache/mapping fields, `ScheduledPost.bufferPostId`, and publish action log details.
- `src/integrations/buffer/*`: Buffer GraphQL client, errors, request log, and operation documents.
- `src/server/buffer-settings-service.ts`: cache-only settings, refresh channels, and per-brand mapping persistence.
- `src/server/scheduling-service.ts`: gated live schedule and delete-from-everywhere workflows.
- `src/server/drafts-service.ts`: bulk approve/reject backend behavior.
- `app/api/settings/buffer/*`: Buffer settings and explicit refresh endpoints.
- `app/api/drafts/bulk-approve/route.ts`, `app/api/drafts/bulk-reject/route.ts`, `app/api/drafts/[id]/delete-everywhere/route.ts`: bulk and destructive actions.
- `app/api/scheduled-posts/route.ts`: explicit live schedule action.
- `app/page.tsx`: UI wiring for Buffer destination, refresh, mapping, bulk actions, live schedule, imported schedule visibility, and delete from everywhere.
- `src/server/phase5-actions.test.ts`, `src/server/draft-review.test.ts`, `src/dashboard-ui.test.tsx`: Phase 5 coverage and 140-character product limit updates.

## JSON-defined scheduling behavior
Imported JSON slots remain the source of truth for schedule date, `time_local`, and timezone. Live scheduling uses the imported `Draft.scheduledAt`/`scheduleMeta` values and does not generate dates from fixed weekly slots.

## Approve all / reject all behavior
Bulk endpoints update drafts for the selected brand only. The dashboard calls those endpoints, refreshes draft state, clears stale dry-run state, and unlocks dry-run when visible drafts are reviewed.

## Buffer mapping/cache behavior
Settings GET is cache-only and does not call Buffer. Refresh channels is an explicit action and calls Buffer `listChannels` once. Channels cache locally. Brand mappings persist separately per brand. 429 errors surface as Buffer-source responses and preserve cache/mapping.

## Live schedule gating
Dry-run stays local with `bufferCalled:false`. Live scheduling requires successful dry-run and explicit schedule click. Schedule includes only approved, unscheduled imported drafts with imported scheduled time and valid body. Missing API key, missing mapping, missing schedule, body over 140, and missing real Buffer post ID block success.

## Body-only / 140-character enforcement
Published Buffer text is `draft.body` only. `draft.title` remains internal and is never sent in Buffer payloads. X body limit is 140 characters.

## Imported date/time preservation
Draft UI shows imported date/time/timezone. Dry-run preview includes imported schedule timing. Live scheduling sends the imported scheduled timestamp.

## Delete from everywhere behavior
Unscheduled drafts delete locally without Buffer calls. Scheduled drafts call Buffer delete/cancel once; local draft/scheduled state is removed only after Buffer confirms success. Buffer failures preserve local state and return readable JSON.

## Tests/build result
- `pnpm test`: 65 tests passed.
- `pnpm build`: passed after TypeScript fixes.

## Live Buffer call status
No live Buffer call happened during implementation or automated verification. Tests used mocked `fetch`.

## E2E smoke
Manual live E2E smoke was not executed. Ready state before live smoke must show selected brand, mapped Buffer channel, planned API calls (`1`), imported scheduled date/time, exact body-only text, body length <= 140, and require explicit user confirmation.

## Known limitations
- Buffer GraphQL operation shapes may need adjustment if Buffer’s production schema differs from the assumed `channels`, `createPost`, and `deletePost` GraphQL response fields.
- Live smoke remains pending manual approval and Buffer UI confirmation.

ASSESSMENT: rebuild-buffer-e2e-actions-ready-with-manual-smoke-pending
