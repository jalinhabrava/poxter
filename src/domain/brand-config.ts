export const brands = [
  { slug: 'textifai', name: 'TextifAI' },
  { slug: 'ont', name: 'OnT' },
  { slug: 'bitcoinpendium', name: 'David Bitcoinpendium' }
] as const;

export type BrandSlug = (typeof brands)[number]['slug'];

export function getBrandConfig(slug: string) {
  return brands.find((brand) => brand.slug === slug) ?? null;
}
