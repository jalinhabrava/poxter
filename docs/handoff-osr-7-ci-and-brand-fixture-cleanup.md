# OSR-7 handoff — CI and brand fixture cleanup

## Scope

Close out OSR-7 on branch `rebuild-split` without changing repository visibility.

## CI failure root cause

Latest failing GitHub Actions run on `rebuild-split` failed in `Setup Node` before dependency install.

Exact root cause:
- workflow used `actions/setup-node@v4` with `cache: pnpm`
- runner did not have `pnpm` available yet
- cache setup failed with `Unable to locate executable file: pnpm`
- after installing pnpm, Node 20 was still too old for pnpm 11

## CI fix

Updated `.github/workflows/ci.yml` to install `pnpm@11.3.0` with `pnpm/action-setup@v4` before `actions/setup-node@v4` runs cache resolution, and switched GitHub Actions Node to 22 for pnpm 11 compatibility.

Result:
- CI no longer depends on preinstalled `pnpm`
- clean-clone workflow can reach install/build/test steps

## Brand fixture cleanup

Removed tracked private brand profile files:
- `brands/textifai.md`
- `brands/ont.md`
- `brands/bitcoinpendium.md`

Added public generic profile:
- `brands/demo-brand.md`

Genericized active public-facing test fixtures:
- dashboard UI tests now use `demo-brand`, `fiction-studio`, and `bitcoin-notes`
- removed active private brand names from current UI test fixtures

## Local config preservation

Preserved local-first setup:
- `~/.config/poxter/env` untouched
- `~/.config/poxter/brands.local.json` untouched
- repo still resolves private brands from local config when present
- public repo defaults remain `config/brands.example.json`

## Scan result

Final repo scan for:
- `TextifAI`
- `OnT`
- `David Bitcoinpendium`
- `bitcoinpendium`
- `textifai`
- local machine paths
- `Social Controller`

Classification:
- remaining hits are historical handoff docs, compatibility schema string `social-controller.week-plan.v1`, or deeper tests/examples not changed in this slice
- no private brand profiles remain as active tracked brand profile content
- no private brand names remain in active README/local setup defaults changed by this slice

## Local verification result

Commands run:
- `pnpm prisma generate`
- `pnpm prisma db push`
- `pnpm prisma:seed`
- `pnpm test`
- `pnpm build`
- `pnpm check:poxter`

Result:
- local verification passed

## Repo state

- repo visibility: private
- branch: `rebuild-split`
- Buffer calls: false

## Final recommendation

`public_after_minor_cleanup`

Assessment: `osr-public-ready-with-minor-followups`

Notes:
- keep repository private until explicit visibility change is requested
- deployment hardening remains separate from source cleanup
