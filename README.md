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

Use absolute SQLite URLs for this rebuild:

```bash
DATABASE_URL="file:/home/david/projects/poxter/dev.db"
```

Secrets may live in `~/.config/social-controller/env`; never commit `.env`, `.local/`, database files, or API keys.
