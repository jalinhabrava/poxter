import { describe, expect, it } from 'vitest';
import { brands, seedBrands } from '../../prisma/seed-lib.mjs';

describe('seed library', () => {
  it('includes all 3 brands', () => {
    expect(brands.map((brand: { slug: string }) => brand.slug)).toEqual(['textifai', 'ont', 'bitcoinpendium']);
  });

  it('is idempotent', () => {
    const ops = seedBrands(brands as unknown as Array<{ slug: string; name: string }>);
    expect(ops).toEqual([]);
  });
});
