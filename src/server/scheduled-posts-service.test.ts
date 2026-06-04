import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importWeekPlan, prisma } from './week-plan-import-service';
import { persistScheduledPost } from './scheduled-posts-service';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));

beforeEach(async () => {
  await prisma.scheduledPost.deleteMany();
  await prisma.safetyWarning.deleteMany();
  await prisma.sourceItem.deleteMany();
  await prisma.draft.deleteMany();
  await importWeekPlan(textifaiPlan);
});

describe('scheduled posts service', () => {
  it('persists scheduled post in local db', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' }, include: { brand: true } });
    const result = await persistScheduledPost({
      brandSlug: draft.brand.slug,
      draftId: draft.id,
      externalId: draft.externalId,
      title: draft.title,
      body: draft.body,
      scheduledAt: draft.scheduledAt?.toISOString(),
      externalStatus: 'scheduled',
      payload: { bufferUpdateId: 'buf-1' }
    });
    expect(result.ok).toBe(true);
    expect(await prisma.scheduledPost.count()).toBe(1);
  });

  it('rejects invalid payload', async () => {
    const result = await persistScheduledPost({ brandSlug: 'textifai' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-scheduled Buffer result', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' }, include: { brand: true } });
    const result = await persistScheduledPost({
      brandSlug: draft.brand.slug,
      draftId: draft.id,
      title: draft.title,
      body: draft.body,
      scheduledAt: draft.scheduledAt?.toISOString(),
      externalStatus: 'failed'
    });
    expect(result.ok).toBe(false);
    expect(await prisma.scheduledPost.count()).toBe(0);
  });
});
