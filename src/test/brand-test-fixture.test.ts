import { describe, expect, it } from 'vitest';
import { getBrandRegistryInfo } from '../domain/brand-config';

describe('test brand fixture', () => {
  it('uses dedicated test registry file', () => {
    const registry = getBrandRegistryInfo();
    expect(registry.source).toBe('env');
    expect(registry.path).toContain('brands.test.json');
    expect(registry.brands.map((brand) => brand.slug)).toEqual(['textifai', 'bitcoinpendium']);
  });
});
