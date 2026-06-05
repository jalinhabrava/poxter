import { PrismaClient } from '@prisma/client';
import { brands } from './seed-lib.mjs';

const prisma = new PrismaClient();

async function main() {
  for (const brand of brands) {
    const data = { slug: brand.slug, name: brand.name };
    await prisma.brand.upsert({ where: { slug: brand.slug }, update: { name: brand.name }, create: data });
  }
}

main().finally(async () => prisma.$disconnect());
