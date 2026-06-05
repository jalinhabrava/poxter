# Local dev env

Persistent env file path: `~/.config/social-controller/env`.
Do not print or commit secrets.

PoXter currently keeps legacy env path during rebuild.

Recommended rebuild database URL:

```bash
DATABASE_URL="file:/home/david/projects/poxter/dev.db"
```

If `DATABASE_URL` is missing, dev scripts use the same absolute rebuild DB path by default.
Do not use `file:./dev.db` in this WSL setup; Prisma engine behavior has been unreliable with relative SQLite URLs here.
