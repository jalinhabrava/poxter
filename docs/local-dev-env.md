# Local dev env

Persistent env file path: `~/.config/poxter/env`.
Do not print or commit secrets.

Recommended local config:

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

- `BUFFER_API_KEY` is optional unless testing Buffer features.
- If `DATABASE_URL` is missing, dev scripts fall back to `file:/home/david/projects/poxter/dev.db`.
- Do not use `file:./dev.db` in this WSL setup; Prisma engine behavior has been unreliable with relative SQLite URLs here.
- Local import, review, and dry-run flows do not call Buffer.
