import { PrismaClient } from '@prisma/client';
import { resolveBrandRegistry } from '../domain/brand-config';

const prisma = new PrismaClient();

export async function ensureBrands() {
  const { brands } = resolveBrandRegistry();
  for (const brand of brands) {
    await prisma.brand.upsert({ where: { slug: brand.slug }, update: { name: brand.name }, create: { slug: brand.slug, name: brand.name } });
  }
  return brands;
}

export async function listConfiguredBrands() {
  await ensureBrands();
  return prisma.brand.findMany({ orderBy: { slug: 'asc' } });
}
