import { PrismaClient } from '@prisma/client';
import { brands } from './seed-lib.mjs';

const prisma = new PrismaClient();

async function main() {
  for (const brand of brands) {
    await prisma.brand.upsert({ where: { slug: brand.slug }, update: { name: brand.name }, create: brand });
  }
}

main().finally(async () => prisma.$disconnect());
