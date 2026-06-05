import { ensureBrands, prisma } from './week-plan-import-service';
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
  await ensureBrands();
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return { ok: false as const, status: 404, errors: ['brand.slug'] };
  const drafts = await prisma.draft.findMany({ where: { brandId: brand.id }, include: { brand: true }, orderBy: { createdAt: 'asc' } });
  return { ok: true as const, drafts: drafts.map(toDraftDto) };
}

function buildScheduleMeta(date: string | null, timeLocal: string | null, timezone: string | null) {
  if (!date || !timeLocal) return null;
  const normalizedTimezone = timezone || 'UTC';
  const scheduledAt = resolveScheduledAt(date, timeLocal, normalizedTimezone);
  if (!scheduledAt) return null;
  return { date, timeLocal, time_local: timeLocal, timezone: normalizedTimezone, scheduledAt: scheduledAt.toISOString() };
}

export function fallbackTitleFromSchedule(input?: { date?: string | null; timeLocal?: string | null; time_local?: string | null; scheduledAt?: string | null } | null) {
  const date = input?.date ?? input?.scheduledAt?.slice(0, 10) ?? 'unscheduled';
  const time = input?.timeLocal ?? input?.time_local ?? (input?.scheduledAt ? new Date(input.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null);
  return `Post ${date}${time ? ` ${time}` : ''}`;
}

export async function createDraft(input: { brandSlug?: unknown; title?: unknown; body?: unknown; scheduleDate?: unknown; scheduleTimeLocal?: unknown; timezone?: unknown }) {
  await ensureBrands();
  const brandSlug = typeof input.brandSlug === 'string' ? input.brandSlug : '';
  if (!brandSlug) return { ok: false as const, status: 400, errors: ['brandSlug'] };
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return { ok: false as const, status: 404, errors: ['brand.slug'] };

  const body = typeof input.body === 'string' ? input.body : '';
  const timezone = typeof input.timezone === 'string' ? input.timezone : 'UTC';
  const scheduleMeta = buildScheduleMeta(
    typeof input.scheduleDate === 'string' ? input.scheduleDate : null,
    typeof input.scheduleTimeLocal === 'string' ? input.scheduleTimeLocal : null,
    timezone
  );
  const title = typeof input.title === 'string' && input.title.trim() ? input.title : fallbackTitleFromSchedule(scheduleMeta);
  const externalId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const draft = await prisma.draft.create({
    data: {
      brandId: brand.id,
      externalId,
      slotId: 'manual',
      platform: 'x',
      format: 'single',
      title,
      body,
      status: 'draft',
      scheduleMeta: scheduleMeta ? JSON.stringify(scheduleMeta) : null,
      scheduledAt: scheduleMeta?.scheduledAt ? new Date(scheduleMeta.scheduledAt) : null
    },
    include: { brand: true }
  });
  return { ok: true as const, draft: toDraftDto(draft) };
}

export async function getDraftById(id: string) {
  const draft = await prisma.draft.findUnique({ where: { id }, include: { brand: true } });
  if (!draft) return { ok: false as const, status: 404, errors: ['draft.id'] };
  return { ok: true as const, draft: toDraftDto(draft) };
}

function resolveScheduledAt(date?: string | null, timeLocal?: string | null, timezone?: string | null) {
  if (!date || !timeLocal) return null;
  const raw = timezone && timezone !== 'UTC' ? `${date}T${timeLocal}:00` : `${date}T${timeLocal}:00Z`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function updateDraft(id: string, input: { title?: unknown; body?: unknown; scheduleDate?: unknown; scheduleTimeLocal?: unknown; timezone?: unknown }) {
  const existing = await prisma.draft.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, status: 404, errors: ['draft.id'] };
  const data: { title?: string; body?: string; scheduleMeta?: string; scheduledAt?: Date | null } = {};
  if (typeof input.title === 'string') data.title = input.title.trim() ? input.title : fallbackTitleFromSchedule(existing.scheduleMeta ? JSON.parse(existing.scheduleMeta) : null);
  if (typeof input.body === 'string') data.body = input.body;
  if (typeof input.scheduleDate === 'string' || typeof input.scheduleTimeLocal === 'string' || typeof input.timezone === 'string') {
    const currentMeta = existing.scheduleMeta ? JSON.parse(existing.scheduleMeta) : {};
    const date = typeof input.scheduleDate === 'string' ? input.scheduleDate : currentMeta.date ?? null;
    const timeLocal = typeof input.scheduleTimeLocal === 'string' ? input.scheduleTimeLocal : currentMeta.timeLocal ?? currentMeta.time_local ?? null;
    const timezone = typeof input.timezone === 'string' ? input.timezone : currentMeta.timezone ?? null;
    const scheduledAt = resolveScheduledAt(date, timeLocal, timezone);
    if (!scheduledAt) return { ok: false as const, status: 400, errors: ['scheduledAt'] };
    data.scheduledAt = scheduledAt;
    data.scheduleMeta = JSON.stringify({ ...currentMeta, date, timeLocal, time_local: timeLocal, timezone, scheduledAt: scheduledAt.toISOString() });
  }
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
  await ensureBrands();
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
