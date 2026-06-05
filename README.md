# PoXter

PoXter, formerly Social Controller during rebuild.

## Prerequisites

- `pnpm`
- `node`
- SQLite access through Prisma tooling

## Clone

```bash
git clone <repo-url>
cd poxter
```

## Install

```bash
pnpm install
```

## Local config

Create persistent env file:

```bash
mkdir -p "$HOME/.config/poxter"
cat > "$HOME/.config/poxter/env" <<'EOF2'
DATABASE_URL="file:/absolute/path/to/poxter/dev.db"
POXTER_HOST="0.0.0.0"
POXTER_PORT="3000"
BUFFER_API_KEY="your-local-buffer-key"
EOF2
```

Optional private brands file:

```bash
cat > "$HOME/.config/poxter/brands.local.json" <<'EOF2'
{}
EOF2
```

Notes:

- `BUFFER_API_KEY` not needed for import, review, or dry-run.
- Real scheduling needs `BUFFER_API_KEY`.
- Never commit `.env`, `.local/`, DB files, or API keys.
- Scripts load `$HOME/.config/poxter/env` if present.
- If `DATABASE_URL` missing, scripts fall back to repo-local `dev.db`.

## Run

```bash
pnpm prisma generate
pnpm prisma db push
pnpm prisma:seed
pnpm dev:poxter
pnpm check:poxter
```

## Configuring brands

Brand resolution order:

- `POXTER_BRANDS_FILE`
- `$HOME/.config/poxter/brands.local.json`
- `config/brands.example.json`

Notes:

- Keep private brand config outside repo.
- Existing private installs stay working without DB reset.
- Week-plan JSON must use configured `brand.slug` and matching `brand.name`.

## License

MIT
