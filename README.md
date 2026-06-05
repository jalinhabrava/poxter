# PoXter

PoXter, formerly Social Controller during rebuild.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm prisma db push
pnpm prisma:seed
pnpm test
pnpm build
```

## Local config

Create local config file:

```bash
mkdir -p ~/.config/poxter
cat > ~/.config/poxter/env <<'EOF2'
DATABASE_URL="file:/home/david/projects/poxter/dev.db"
POXTER_HOST="0.0.0.0"
POXTER_PORT="3000"
BUFFER_API_KEY="your-local-buffer-key"
EOF2
```

Notes:

- `BUFFER_API_KEY` optional unless testing Buffer features.
- Local import, review, and dry-run flows do not call Buffer.
- Never commit `.env`, `.local/`, database files, or API keys.
