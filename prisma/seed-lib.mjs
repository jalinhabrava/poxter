export const brands = [
  { slug: 'textifai', name: 'TextifAI' },
  { slug: 'ont', name: 'OnT' },
  { slug: 'bitcoinpendium', name: 'David Bitcoinpendium' }
];

export function seedBrands(existingBrands = []) {
  const bySlug = new Map(existingBrands.map((brand) => [brand.slug, brand]));
  const operations = [];
  for (const brand of brands) {
    if (!bySlug.has(brand.slug)) operations.push({ create: brand });
  }
  return operations;
}
