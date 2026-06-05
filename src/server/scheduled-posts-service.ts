import { prisma } from './week-plan-import-service';

function asScheduledDate(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fallbackTitleFromDate(date: Date) {
  return `Post ${date.toISOString().slice(0, 10)} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export async function persistScheduledPost(input: {
  brandSlug?: unknown;
  draftId?: unknown;
  externalId?: unknown;
  title?: unknown;
  body?: unknown;
  scheduledAt?: unknown;
  externalStatus?: unknown;
  payload?: unknown;
}) {
  const brandSlug = typeof input.brandSlug === 'string' ? input.brandSlug : '';
  const rawTitle = typeof input.title === 'string' ? input.title : '';
  const body = typeof input.body === 'string' ? input.body : '';
  const externalStatus = typeof input.externalStatus === 'string' ? input.externalStatus : '';
  const scheduledAt = asScheduledDate(input.scheduledAt);
  const draftId = typeof input.draftId === 'string' && input.draftId.length > 0 ? input.draftId : null;
  const externalId = typeof input.externalId === 'string' && input.externalId.length > 0 ? input.externalId : null;

  if (!brandSlug) return { ok: false as const, status: 400, errors: ['brand.slug'] };
  if (!body) return { ok: false as const, status: 400, errors: ['body.empty'] };
  if (!scheduledAt) return { ok: false as const, status: 400, errors: ['scheduledAt'] };
  if (!externalStatus) return { ok: false as const, status: 400, errors: ['externalStatus'] };
  if (externalStatus !== 'scheduled') return { ok: false as const, status: 400, errors: ['externalStatus.not_scheduled'] };
  const title = rawTitle.trim() || fallbackTitleFromDate(scheduledAt);

  const persisted = await prisma.scheduledPost.create({
    data: {
      brandSlug,
      draftId,
      bufferPostId: externalId,
      title,
      body,
      scheduledAt,
      externalStatus,
      payload: input.payload === undefined ? null : JSON.stringify(input.payload)
    }
  });

  if (draftId) {
    await prisma.draft.updateMany({
      where: { id: draftId },
      data: { status: 'approved' }
    });
  } else if (externalId) {
    await prisma.draft.updateMany({
      where: { externalId },
      data: { status: 'approved' }
    });
  }

  return {
    ok: true as const,
    scheduledPost: {
      id: persisted.id,
      brandSlug: persisted.brandSlug,
      draftId: persisted.draftId,
      title: persisted.title,
      body: persisted.body,
      scheduledAt: persisted.scheduledAt.toISOString(),
      externalStatus: persisted.externalStatus,
      payload: persisted.payload ? JSON.parse(persisted.payload) : null,
      createdAt: persisted.createdAt.toISOString()
    }
  };
}
