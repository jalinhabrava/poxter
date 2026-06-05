# PoXter

PoXter is a local-first publishing workflow for reviewing week plans, drafting posts, and coordinating Buffer-backed scheduling when explicitly enabled.

## What it is

- A small local app for import, review, dry-run, and scheduling workflows.
- A SQLite-backed tool that keeps private brand data on your machine by default.
- An explicit Buffer client for live actions only when you opt in.

## What it is not

- Not a direct X/Twitter automation bot.
- Not a public multi-tenant service.
- Not a background scheduler that posts without review.
- Not a place to store secrets in git.

## Features

- Import week-plan JSON into local drafts.
- Review draft copy before scheduling.
- Run dry-run checks without calling Buffer.
- Resolve brands from demo config or private local config.
- Keep scheduling and delete actions explicit.

## Safety model

- Local-first SQLite data store by default.
- `BUFFER_API_KEY` only needed for live Buffer actions.
- Dry-run, import, and review stay local.
- Private brand config stays in `$HOME/.config/poxter/brands.local.json`.
- Never commit `.env`, `.local`, DB files, generated files, or secrets.

## Quickstart

```bash
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm prisma:seed
pnpm check:poxter
```

For local config, create `$HOME/.config/poxter/env`:

```bash
mkdir -p "$HOME/.config/poxter"
cat > "$HOME/.config/poxter/env" <<'EOF2'
DATABASE_URL="file:/absolute/path/to/poxter/dev.db"
POXTER_HOST="0.0.0.0"
POXTER_PORT="3000"
BUFFER_API_KEY=""
POXTER_BRANDS_FILE=""
EOF2
```

Optional private brands file:

```bash
cat > "$HOME/.config/poxter/brands.local.json" <<'EOF2'
{}
EOF2
```

## Brand config

Brand resolution order:

1. `POXTER_BRANDS_FILE`
2. `$HOME/.config/poxter/brands.local.json`
3. `config/brands.example.json`

Use demo brands for public examples. Keep private brands outside repo.

## Schedule JSON docs

- Authoring contract: `docs/contracts/schedule-json-authoring.md`
- Example payloads: `docs/contracts/*.example.json`
- `brand.slug` must exist in registry.
- `brand.name` must match the configured name for that slug.
- `schema_version` must match `social-controller.week-plan.v1`.

## Buffer setup

- `BUFFER_API_KEY` is optional unless you run live Buffer actions.
- Dry-run and review do not call Buffer.
- Live scheduling and some delete flows require explicit Buffer access.

## License

MIT
