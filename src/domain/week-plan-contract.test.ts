import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const demoPlan = {
  schema_version: 'social-controller.week-plan.v1',
  brand: { slug: 'demo-brand', name: 'Demo Brand' },
  week: { start_date: '2026-06-08', end_date: '2026-06-14', timezone: 'Europe/Madrid' },
  drafts: [{ external_id: 'd1', slot_id: 's1', platform: 'x', format: 'post', title: 'Demo', body: 'Body', status: 'draft' }]
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('brand registry', () => {
  it('uses demo brand by default', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const mod = await import('./brand-config');
    expect(mod.getBrandRegistry().map((brand) => brand.slug)).toEqual(['demo-brand']);
    rmSync(home, { recursive: true, force: true });
  });

  it('uses env override config', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    const dir = join(tmpdir(), `poxter-brands-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'brands.json');
    writeFileSync(file, JSON.stringify({ brands: [{ slug: 'textifai', name: 'TextifAI' }] }));
    vi.stubEnv('HOME', home);
    vi.stubEnv('POXTER_BRANDS_FILE', file);
    const mod = await import('./brand-config');
    expect(mod.getBrandRegistry().map((brand) => brand.slug)).toEqual(['textifai']);
    rmSync(home, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('week plan contract', () => {
  it('valid configured brand passes', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract(demoPlan)).toEqual({ ok: true, errors: [] });
    rmSync(home, { recursive: true, force: true });
  });

  it('rejects mismatched brand name', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract({ ...demoPlan, brand: { slug: 'demo-brand', name: 'Wrong' } }).ok).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  it('rejects unknown brand', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract({ ...demoPlan, brand: { slug: 'nope', name: 'Nope' } }).ok).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  it('private brands pass when test config provides them', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    const dir = join(tmpdir(), `poxter-brands-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'brands.json');
    writeFileSync(file, JSON.stringify({ brands: [{ slug: 'textifai', name: 'TextifAI' }] }));
    vi.stubEnv('HOME', home);
    vi.stubEnv('POXTER_BRANDS_FILE', file);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract({ ...demoPlan, brand: { slug: 'textifai', name: 'TextifAI' } }).ok).toBe(true);
    rmSync(home, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects duplicate external_id', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    const duplicate = { ...demoPlan, drafts: [...demoPlan.drafts, { ...demoPlan.drafts[0] }] };
    expect(validateWeekPlanContract(duplicate).ok).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  it('requires body or thread_posts', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract({ ...demoPlan, drafts: [{ ...demoPlan.drafts[0], body: '', thread_posts: [] }] }).ok).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  it('rejects status outside allowed list', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    const { validateWeekPlanContract } = await import('./week-plan-contract');
    expect(validateWeekPlanContract({ ...demoPlan, drafts: [{ ...demoPlan.drafts[0], status: 'posted' }] }).ok).toBe(false);
    rmSync(home, { recursive: true, force: true });
  });

  it('does not import buffer client', async () => {
    const source = readFileSync('src/domain/week-plan-contract.ts', 'utf8');
    expect(source).not.toContain('Buffer');
  });
});
