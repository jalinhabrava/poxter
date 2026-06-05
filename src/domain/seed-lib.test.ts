import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('seed library', () => {
  it('uses demo brand by default', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    vi.stubEnv('POXTER_BRANDS_FILE', '');
    const mod = await import('../../prisma/seed-lib.mjs');
    expect(mod.brands.map((brand: { slug: string }) => brand.slug)).toEqual(['demo-brand']);
    rmSync(home, { recursive: true, force: true });
  });

  it('is idempotent', async () => {
    const home = join(tmpdir(), `poxter-home-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    vi.stubEnv('HOME', home);
    vi.stubEnv('POXTER_BRANDS_FILE', '');
    const mod = await import('../../prisma/seed-lib.mjs');
    const ops = mod.seedBrands(mod.brands as Array<{ slug: string; name: string }>);
    expect(ops).toEqual([]);
    rmSync(home, { recursive: true, force: true });
  });
});
