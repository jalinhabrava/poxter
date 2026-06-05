import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const exampleBrandsPath = join(process.cwd(), 'config', 'brands.example.json');
const localBrandsPath = join(homedir(), '.config', 'poxter', 'brands.local.json');

function readRegistry(path) {
  if (!path || !existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const brands = Array.isArray(parsed?.brands) ? parsed.brands : [];
  return brands.filter((brand) => brand && typeof brand.slug === 'string' && typeof brand.name === 'string').map((brand) => ({ slug: brand.slug, name: brand.name }));
}

export function resolveSeedBrands() {
  return readRegistry(process.env.POXTER_BRANDS_FILE?.trim() || '') ?? readRegistry(localBrandsPath) ?? readRegistry(exampleBrandsPath) ?? [];
}

export const brands = resolveSeedBrands();

export function seedBrands(existingBrands = []) {
  const bySlug = new Map(existingBrands.map((brand) => [brand.slug, brand]));
  const operations = [];
  for (const brand of brands) {
    if (!bySlug.has(brand.slug)) operations.push({ create: brand });
  }
  return operations;
}
