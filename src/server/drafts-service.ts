import { prisma } from './week-plan-import-service';
import { buildPublishText } from './publish-text';

const editableStatuses = new Set(['draft', 'needs_review', 'approved', 'rejected']);
export type DraftStatus = 'draft' | 'needs_review' | 'approved' | 'rejected';

function toDraftDto(draft: any) {
  return {
    id: draft.id,
    externalId: draft.externalId,
    brandSlug: draft.brand.slug,
    title: draft.title,
    body: draft.body,
    status: draft.status,
    scheduledAt: draft.scheduledAt?.toISOString?.() ?? null,
    scheduleMeta: draft.scheduleMeta ? JSON.parse(draft.scheduleMeta) : null,
    sourceContext: draft.sourceContext ? JSON.parse(draft.sourceContext) : null
  };
}

export async function listDraftsByBrandSlug(brandSlug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return { ok: false as const, status: 404, errors: ['brand.slug'] };
  const drafts = await prisma.draft.findMany({ where: { brandId: brand.id }, include: { brand: true }, orderBy: { createdAt: 'asc' } });
  return { ok: true as const, drafts: drafts.map(toDraftDto) };
}

export async function getDraftById(id: string) {
  const draft = await prisma.draft.findUnique({ where: { id }, include: { brand: true } });
  if (!draft) return { ok: false as const, status: 404, errors: ['draft.id'] };
  return { ok: true as const, draft: toDraftDto(draft) };
}

export async function updateDraft(id: string, input: { title?: unknown; body?: unknown }) {
  const existing = await prisma.draft.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, status: 404, errors: ['draft.id'] };
  const data: { title?: string; body?: string } = {};
  if (typeof input.title === 'string') data.title = input.title;
  if (typeof input.body === 'string') data.body = input.body;
  const draft = await prisma.draft.update({ where: { id }, data, include: { brand: true } });
  return { ok: true as const, draft: toDraftDto(draft) };
}

export async function setDraftStatus(id: string, status: DraftStatus) {
  if (!editableStatuses.has(status)) return { ok: false as const, status: 400, errors: ['draft.status.invalid'] };
  const existing = await prisma.draft.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, status: 404, errors: ['draft.id'] };
  const draft = await prisma.draft.update({ where: { id }, data: { status }, include: { brand: true } });
  return { ok: true as const, draft: toDraftDto(draft) };
}

export async function bulkSetDraftStatus(brandSlug: string, status: Extract<DraftStatus, 'approved' | 'rejected'>) {
  if (!brandSlug) return { ok: false as const, status: 400, errors: ['brandSlug'] };
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return { ok: false as const, status: 404, errors: ['brand.slug'] };
  const result = await prisma.draft.updateMany({ where: { brandId: brand.id }, data: { status } });
  const drafts = await prisma.draft.findMany({ where: { brandId: brand.id }, include: { brand: true }, orderBy: { createdAt: 'asc' } });
  return { ok: true as const, updated: result.count, drafts: drafts.map(toDraftDto) };
}

export async function dryRunDraft(id: string) {
  const draft = await prisma.draft.findUnique({ where: { id }, include: { brand: true } });
  if (!draft) return { ok: false as const, status: 404, errors: ['draft.id'] };
  const publishText = buildPublishText({ title: draft.title, body: draft.body, platform: draft.platform });
  return {
    ok: publishText.ok,
    status: publishText.ok ? 200 : 400,
    dryRun: true,
    bufferCalled: false,
    draft: toDraftDto(draft),
    publishText: publishText.text,
    characterCount: publishText.characterCount,
    limit: publishText.limit,
    errors: publishText.errors
  };
}
