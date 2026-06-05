# OSR-1 configurable brand registry handoff

## What changed

- Replaced hardcoded private brand registry with JSON-backed resolution.
- Added public demo config at `config/brands.example.json`.
- Added `app/api/brands/route.ts` for dashboard brand loading.
- Updated seed and validation to use resolved brand registry.
- Updated dashboard switcher to render runtime brands instead of hardcoded private list.

## Brand resolution order

1. `POXTER_BRANDS_FILE`
2. `~/.config/poxter/brands.local.json`
3. `config/brands.example.json`

## Local config path

- `~/.config/poxter/brands.local.json`

## Local setup preservation

- Local brands file existed before task: no
- Local brands file created during task: yes
- Brand slugs found: `textifai`, `ont`, `bitcoinpendium`
- Existing DB rows not deleted.
- Existing Buffer mappings not deleted.
- No DB reset required.

## OSS default behavior

- Without local config, default seeded brand is `Demo Brand` / `demo-brand`.
- With local config, configured private brands seed and validate normally.

## Verification

- `pnpm prisma generate`: pass
- `pnpm prisma db push`: pass
- `pnpm prisma:seed`: pass
- `pnpm test`: pass
- `pnpm build`: pass
- `pnpm check:poxter`: pass

## Safety notes

- Buffer calls during task: false
- Live scheduling triggered during task: false

## Remaining open-source blockers

- CI and governance files still pending from audit.
- Historical docs and fixtures still mention private brands where context is intentional.

ASSESSMENT: osr-configurable-brands-ready-with-minor-followups
