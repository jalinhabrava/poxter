# PoXter Open Source Readiness Audit

## Executive summary

**PUBLIC_RELEASE_READY: yes_after_required_changes**

PoXter is close to publishable, but not OSS-ready yet. Core safety is decent: dry-run paths stay local, Buffer calls are gated by `BUFFER_API_KEY`, and `pnpm check:poxter` passes. Biggest blockers are repo hygiene, missing standard OSS files, private/demo-brand cleanup, and several docs/config paths that still hardcode `/home/david/projects/poxter`.

## Current repo state

- Repo URL: `https://github.com/jalinhabrava/poxter`
- Visibility: private
- Branch: `rebuild-split`
- Latest commit: `80a99cc` (`docs: update PoXter rename handoff`)
- Test/check result: `pnpm check:poxter` passed
- Working tree: clean after audit doc only

## Blocking issues before public release

| Area | Issue | Risk | Required fix |
|---|---|---:|---|
| Legal | No `LICENSE` file | Public reuse unclear | Add OSS license, likely MIT or Apache-2.0 |
| Governance | No `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | Contributor and security process missing | Add standard community files |
| CI | No `.github/workflows` or issue/PR templates | Public project lacks automated checks | Add CI and minimal templates |
| Docs | README lacks explicit Node/pnpm version and full OSS setup notes | New contributors may fail setup | Document runtime, install, DB, seed, test, build |
| Privacy | Demo brands still include `TextifAI`, `OnT`, `David Bitcoinpendium` | Private context leaks into public default data | Replace with generic demo seed or make private examples opt-in |
| Paths | Hardcoded `/home/david/projects/poxter` in scripts/docs/package.json | Breaks on other machines | Replace with relative paths or env-driven defaults |

## Recommended changes before public release

| Priority | Change | Why |
|---|---|---|
| P0 | Add `LICENSE` | Required for clear OSS usage |
| P0 | Add `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | Standard public repo baseline |
| P0 | Remove hardcoded local paths from scripts and docs | Makes repo portable |
| P1 | Replace private/demo brand names with generic OSS demo data | Avoids leaking personal context |
| P1 | Add GitHub Actions CI | Public contributors need repeatable checks |
| P1 | Add Node/pnpm version pinning (`engines`, `packageManager`, maybe `.nvmrc`) | Reduces setup drift |
| P2 | Add issue and PR templates | Low-friction public contribution flow |
| P2 | Add explicit setup for Prisma + seed + check | Fewer onboarding failures |

## Secret/security audit result

- Tracked secrets: no
- History risk: no obvious secret values found in scanned history
- Local files ignored: yes (`.env`, `.env.local`, `.local/`, `*.db`, `.next/`, `node_modules/`, `prisma/generated/`)
- Credential rotation needed: no evidence from this audit; still rotate anything real if ever exposed elsewhere

Notes:
- `.env.example` contains placeholder `BUFFER_API_KEY=""`, which is fine.
- `BUFFER_API_KEY` usage is gated in scheduling and delete flows; dry-run stays local.
- No Buffer call was made during this audit.

## Documentation gaps

- README
  - Missing explicit Node/pnpm version requirements
  - Missing public-contributor quick start for clean machine
  - Missing clear explanation of Buffer-free local mode vs Buffer-enabled mode
- Setup
  - Needs one canonical setup path for SQLite/Prisma/seed/test/build
- Buffer config
  - Needs clearer opt-in explanation and failure modes
- JSON schedule examples
  - Existing examples are tied to private brand names
- Architecture
  - Needs short overview of local DB, draft lifecycle, and Buffer integration boundaries
- Contribution
  - Missing contribution and support guidance

## Legal/open-source files needed

- License recommendation: `MIT` or `Apache-2.0` for first-pass indie OSS
- Add `CONTRIBUTING.md`
- Add `SECURITY.md`
- Add `CODE_OF_CONDUCT.md`
- Add issue templates
- Add PR template

## Personal/private cleanup

- Personal paths: present in README, docs, package scripts, and dev shell scripts
- Private brands: `TextifAI`, `OnT`, `David Bitcoinpendium`
- Historical recovery docs: several handoff docs mention rename/recovery context; okay for private history, but should be reviewed before public release
- Screenshots/logs: none reviewed in this slice, but should scan before publish if any exist

## Suggested public release roadmap

1. **OSR-1: security/docs cleanup**
   - Add license and community files
   - Remove hardcoded local paths
   - Rewrite README setup for clean-machine install
2. **OSR-2: CI and contribution baseline**
   - Add GitHub Actions
   - Add issue/PR templates
   - Pin Node/pnpm version
3. **OSR-3: generic demo seed mode**
   - Replace private brands with generic demo brands or make them opt-in
   - Update examples and seed docs
4. **OSR-4: public release candidate**
   - Re-run checks on clean environment
   - Review docs for leftover private context
5. **OSR-5: flip repo visibility to public**
   - Only after cleanup and final verification

## Final recommendation

**RECOMMENDATION: public_after_cleanup**

PoXter is structurally close, but not ready for public release until license, governance, CI, portability, and private-context cleanup land.
