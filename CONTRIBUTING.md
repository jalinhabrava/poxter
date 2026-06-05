# Contributing to PoXter

PoXter is an early, local-first publishing workflow tool being prepared for open-source release. Contributions should keep the default workflow safe, private, and explicit.

## Local setup

1. Install Node.js 20 or newer and `pnpm`.
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create local configuration outside the repository:

   ```bash
   mkdir -p "$HOME/.config/poxter"
   cat > "$HOME/.config/poxter/env" <<'EOF2'
   DATABASE_URL="file:/absolute/path/to/poxter/dev.db"
   POXTER_HOST="0.0.0.0"
   POXTER_PORT="3000"
   EOF2
   ```

4. Use demo brands from `config/brands.example.json`, or keep private brand config in `$HOME/.config/poxter/brands.local.json`.
5. Prepare the database and run checks:

   ```bash
   pnpm prisma generate
   pnpm prisma db push
   pnpm prisma:seed
   pnpm check:poxter
   ```

## Safety rules

- Do not commit secrets, `.env`, `.local`, database files, generated Prisma client output, `node_modules`, or `.next`.
- Do not use direct X/Twitter API integrations.
- Do not automate `x.com` or browser sessions against X.
- Buffer integrations must be explicit, safe, and easy to audit.
- Tests must not make live Buffer calls.
- Dry-run flows must not call Buffer.
- Use placeholders in `.env.example`; keep real values in `$HOME/.config/poxter/env`.

## Pull request checklist

- Tests added or updated when behavior changes.
- `pnpm check:poxter` passes.
- No Buffer live calls in tests.
- No secrets or local private config committed.
- Docs updated if behavior changes.
