import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type BrandConfig = {
  slug: string;
  name: string;
  description?: string;
  timezone?: string;
  platforms?: string[];
};

export type BrandRegistrySource = 'env' | 'local' | 'example';

const exampleBrandsPath = join(process.cwd(), 'config', 'brands.example.json');
const localBrandsPath = join(homedir(), '.config', 'poxter', 'brands.local.json');

function readJsonFile(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function asBrands(input: unknown): BrandConfig[] {
  const brands = (input as { brands?: unknown } | null | undefined)?.brands;
  if (!Array.isArray(brands)) return [];
  return brands.filter((item): item is BrandConfig => Boolean(item) && typeof item === 'object' && typeof (item as BrandConfig).slug === 'string' && typeof (item as BrandConfig).name === 'string');
}

function validateRegistry(brands: BrandConfig[]) {
  if (!Array.isArray(brands) || brands.length === 0) throw new Error('brand registry empty');
  const seen = new Set<string>();
  for (const brand of brands) {
    const slug = typeof brand.slug === 'string' ? brand.slug.trim() : '';
    const name = typeof brand.name === 'string' ? brand.name.trim() : '';
    if (!slug || !name) throw new Error('brand registry invalid');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('brand slug invalid');
    if (seen.has(slug)) throw new Error('brand slug duplicate');
    seen.add(slug);
  }
}

function readRegistryFromPath(path: string) {
  if (!existsSync(path)) return null;
  const brands = asBrands(readJsonFile(path));
  validateRegistry(brands);
  return brands;
}

export function resolveBrandRegistry() {
  const envPath = process.env.POXTER_BRANDS_FILE?.trim();
  const envBrands = envPath ? readRegistryFromPath(envPath) : null;
  if (envBrands) return { source: 'env' as const, path: envPath, brands: envBrands };

  const localBrands = readRegistryFromPath(localBrandsPath);
  if (localBrands) return { source: 'local' as const, path: localBrandsPath, brands: localBrands };

  const exampleBrands = readRegistryFromPath(exampleBrandsPath);
  if (exampleBrands) return { source: 'example' as const, path: exampleBrandsPath, brands: exampleBrands };

  throw new Error('No valid brand registry found');
}

export function getBrandRegistry() {
  return resolveBrandRegistry().brands;
}

export function getBrandConfig(slug: string) {
  return getBrandRegistry().find((brand) => brand.slug === slug) ?? null;
}

export function getBrandRegistryInfo() {
  const registry = resolveBrandRegistry();
  return { source: registry.source, path: registry.path, brands: registry.brands };
}
