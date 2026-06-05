import { prisma } from './week-plan-import-service';
import { buildPublishText } from './publish-text';
import { createPost, deletePost } from '../integrations/buffer/client';
import { toBufferErrorResponse } from './buffer-api-response';
import { getBufferMapping } from './buffer-settings-service';
import { fallbackTitleFromSchedule } from './drafts-service';

function parseScheduleMeta(draft: { scheduleMeta: string | null }) {
  if (!draft.scheduleMeta) return null;
  try { return JSON.parse(draft.scheduleMeta); } catch { return null; }
}

function toIsoOrNull(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function dryRunApprovedDrafts(brandSlug: string) {
  const drafts = await prisma.draft.findMany({ where: { brand: { slug: brandSlug }, status: 'approved' }, include: { brand: true }, orderBy: { createdAt: 'asc' } });
  const posts = drafts.map((draft) => {
    const scheduleMeta = parseScheduleMeta(draft);
    return { at: scheduleMeta ? toIsoOrNull(scheduleMeta.scheduledAt ?? scheduleMeta.date ? `${scheduleMeta.date}T${scheduleMeta.time_local ?? '00:00'}:00` : null) : null, body: buildPublishText({ title: draft.title, body: draft.body, platform: draft.platform }).text };
  });
  return { ok: true as const, dryRun: true, bufferCalled: false, payload: { brand: brandSlug, week: null, posts } };
}

export async function scheduleApprovedDrafts(brandSlug: string) {
  const mapping = await getBufferMapping(brandSlug);
  if (!mapping?.channelId) return { ok: false as const, status: 400, errors: ['buffer.mapping.missing'] };
  const approvedDrafts = await prisma.draft.findMany({ where: { brand: { slug: brandSlug }, status: 'approved', scheduledAt: { not: null } }, include: { brand: true }, orderBy: { createdAt: 'asc' } });
  if (!process.env.BUFFER_API_KEY?.trim()) return { ok: false as const, status: 400, errors: ['buffer.api_key_missing'] };
  const results = [] as any[];
  for (const draft of approvedDrafts) {
    const publishText = buildPublishText({ title: draft.title, body: draft.body, platform: draft.platform });
    if (!publishText.ok) return { ok: false as const, status: 400, errors: publishText.errors };
    if (!draft.scheduledAt) return { ok: false as const, status: 400, errors: ['scheduledAt'] };
    try {
      const post = await createPost({ channelId: mapping.channelId, text: publishText.text, scheduledAt: draft.scheduledAt.toISOString() });
      if (!post?.id) return { ok: false as const, status: 502, errors: ['buffer.post_id_missing'] };
      await prisma.$transaction([
        prisma.scheduledPost.create({ data: { brandSlug, draftId: draft.id, bufferPostId: post.id, title: draft.title.trim() || fallbackTitleFromSchedule(parseScheduleMeta(draft)), body: publishText.text, scheduledAt: draft.scheduledAt, externalStatus: 'scheduled', payload: JSON.stringify({ bufferPostId: post.id, scheduledAt: draft.scheduledAt.toISOString(), channelId: mapping.channelId }) } }),
        prisma.draft.update({ where: { id: draft.id }, data: { status: 'scheduled' } }),
        prisma.publishActionLog.create({ data: { brandSlug, draftId: draft.id, action: 'schedule', status: 'success', source: 'buffer', payload: JSON.stringify({ bufferPostId: post.id }) } })
      ]);
      results.push({ draftId: draft.id, bufferPostId: post.id });
    } catch (error) {
      const payload = toBufferErrorResponse(error);
      await prisma.publishActionLog.create({ data: { brandSlug, draftId: draft.id, action: 'schedule', status: 'error', source: 'buffer', error: payload.errors.join(', '), payload: JSON.stringify(payload) } });
      return { ...payload, results };
    }
  }
  return { ok: true as const, scheduled: results.length, results };
}

export async function deleteDraftEverywhere(draftId: string) {
  const draft = await prisma.draft.findUnique({ where: { id: draftId }, include: { brand: true } });
  if (!draft) return { ok: false as const, status: 404, errors: ['draft.id'] };
  const scheduledPost = await prisma.scheduledPost.findFirst({ where: { draftId } });
  if (!scheduledPost?.bufferPostId) {
    await prisma.$transaction([
      prisma.draft.delete({ where: { id: draftId } }),
      prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'success', source: 'local' } })
    ]);
    return { ok: true as const, deleted: 'local' };
  }

  if (!process.env.BUFFER_API_KEY?.trim()) {
    await prisma.$transaction([
      prisma.scheduledPost.delete({ where: { id: scheduledPost.id } }),
      prisma.draft.delete({ where: { id: draftId } }),
      prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'success', source: 'local', payload: JSON.stringify({ skippedBufferReason: 'buffer.api_key_missing', bufferPostId: scheduledPost.bufferPostId }) } })
    ]);
    return { ok: true as const, deleted: 'local+stale-buffer' };
  }

  try {
    const deleted = await deletePost(scheduledPost.bufferPostId);
    if (!deleted) {
      await prisma.$transaction([
        prisma.scheduledPost.delete({ where: { id: scheduledPost.id } }),
        prisma.draft.delete({ where: { id: draftId } }),
        prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'success', source: 'buffer', payload: JSON.stringify({ bufferPostId: scheduledPost.bufferPostId, treatedAsMissing: true }) } })
      ]);
      return { ok: true as const, deleted: 'buffer-missing+local' };
    }
    await prisma.$transaction([
      prisma.scheduledPost.delete({ where: { id: scheduledPost.id } }),
      prisma.draft.delete({ where: { id: draftId } }),
      prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'success', source: 'buffer', payload: JSON.stringify({ bufferPostId: scheduledPost.bufferPostId }) } })
    ]);
    return { ok: true as const, deleted: 'buffer+local' };
  } catch (error) {
    const payload = toBufferErrorResponse(error);
    if (payload.errors.includes('buffer.api_key_missing')) {
      await prisma.$transaction([
        prisma.scheduledPost.delete({ where: { id: scheduledPost.id } }),
        prisma.draft.delete({ where: { id: draftId } }),
        prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'success', source: 'local', payload: JSON.stringify({ skippedBufferReason: 'buffer.api_key_missing', bufferPostId: scheduledPost.bufferPostId }) } })
      ]);
      return { ok: true as const, deleted: 'local+stale-buffer' };
    }
    await prisma.publishActionLog.create({ data: { brandSlug: draft.brand.slug, draftId, action: 'delete_everywhere', status: 'error', source: 'buffer', error: payload.errors.join(', '), payload: JSON.stringify(payload) } });
    return payload;
  }
}
