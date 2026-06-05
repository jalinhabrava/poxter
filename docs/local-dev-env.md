# Local dev env

Persistent env file path: `$HOME/.config/poxter/env`.
Do not print or commit secrets.

Recommended local config:

```bash
mkdir -p "$HOME/.config/poxter"
cat > "$HOME/.config/poxter/env" <<'EOF2'
DATABASE_URL="file:/absolute/path/to/poxter/dev.db"
POXTER_HOST="0.0.0.0"
POXTER_PORT="3000"
BUFFER_API_KEY="your-local-buffer-key"
EOF2
```

Notes:

- `BUFFER_API_KEY` is optional unless testing Buffer features.
- If `DATABASE_URL` is missing, dev scripts fall back to repo-local `dev.db`.
- Do not use relative SQLite URLs in this WSL setup when Prisma engine behavior is unstable.
- Local import, review, and dry-run flows do not call Buffer.

## Configuring brands

Brand resolution order:

- `POXTER_BRANDS_FILE`
- `$HOME/.config/poxter/brands.local.json`
- `config/brands.example.json`

Migration note:

- Existing private installs are preserved by `$HOME/.config/poxter/brands.local.json`; this file is outside the repo and must not be committed.
- No DB reset required.
- Do not commit private brand config, real Buffer channel IDs, or local machine paths.
