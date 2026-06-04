import { prisma } from './week-plan-import-service';

export async function listDraftsByBrandSlug(brandSlug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return { ok: false as const, status: 404, errors: ['brand.slug'] };
  const drafts = await prisma.draft.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: 'asc' } });
  return {
    ok: true as const,
    drafts: drafts.map((draft) => ({
      id: draft.id,
      externalId: draft.externalId,
      brandSlug,
      title: draft.title,
      body: draft.body,
      status: draft.status,
      scheduledAt: draft.scheduledAt?.toISOString?.() ?? null,
      scheduleMeta: draft.scheduleMeta ? JSON.parse(draft.scheduleMeta) : null,
      sourceContext: draft.sourceContext ? JSON.parse(draft.sourceContext) : null
    }))
  };
}
