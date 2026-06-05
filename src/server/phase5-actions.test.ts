import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { importWeekPlan, prisma } from './week-plan-import-service';
import { bulkSetDraftStatus } from './drafts-service';
import { getBufferSettings, refreshBufferChannels, saveBufferMapping } from './buffer-settings-service';
import { deleteDraftEverywhere, scheduleApprovedDrafts } from './scheduling-service';
import { resetBufferRequestLog, readBufferRequestLog } from '../integrations/buffer/request-log';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));
const bitcoinPlan = JSON.parse(readFileSync('docs/contracts/bitcoinpendium.week-plan.v1.example.json', 'utf8'));

async function seed() {
  await prisma.publishActionLog.deleteMany();
  await prisma.scheduledPost.deleteMany();
  await prisma.bufferChannelMapping.deleteMany();
  await prisma.bufferChannelCache.deleteMany();
  await prisma.safetyWarning.deleteMany();
  await prisma.sourceItem.deleteMany();
  await prisma.draft.deleteMany();
  await importWeekPlan(textifaiPlan);
  await importWeekPlan(bitcoinPlan);
  resetBufferRequestLog();
}

describe('phase 5 actions', () => {
  beforeEach(async () => {
    await seed();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.BUFFER_API_KEY = 'test-buffer-key';
  });

  it('approve all changes only selected brand drafts', async () => {
    const result = await bulkSetDraftStatus('textifai', 'approved');
    expect(result.ok).toBe(true);
    expect((await prisma.draft.count({ where: { brand: { slug: 'textifai' }, status: 'approved' } }))).toBe(7);
    expect((await prisma.draft.count({ where: { brand: { slug: 'bitcoinpendium' }, status: 'approved' } }))).toBeLessThan(7);
  });

  it('reject all changes only selected brand drafts', async () => {
    const result = await bulkSetDraftStatus('bitcoinpendium', 'rejected');
    expect(result.ok).toBe(true);
    expect((await prisma.draft.count({ where: { brand: { slug: 'bitcoinpendium' }, status: 'rejected' } }))).toBeGreaterThan(0);
    expect((await prisma.draft.count({ where: { brand: { slug: 'textifai' }, status: 'rejected' } }))).toBeLessThan(7);
  });

  it('settings GET is cache-only and calls no Buffer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await getBufferSettings();
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refresh channels calls Buffer once and persists cache', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (String(body.query).includes('account')) return Promise.resolve(new Response(JSON.stringify({ data: { account: { organizations: [{ id: 'org-1', name: 'Org 1' }] } } }), { status: 200, headers: { 'content-type': 'application/json' } }));
      return Promise.resolve(new Response(JSON.stringify({ data: { channels: [{ id: 'ch-1', name: 'Queue 1', service: 'x' }] } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }));
    const result = await refreshBufferChannels();
    expect(result.channels).toHaveLength(1);
    expect(readBufferRequestLog().filter((item) => item.action === 'listChannels')).toHaveLength(1);
    expect(await prisma.bufferChannelCache.count()).toBe(1);
  });

  it('refresh 429 preserves cache and mapping', async () => {
    await prisma.bufferChannelCache.create({ data: { channelId: 'ch-old', channelName: 'Old', payload: JSON.stringify({ id: 'ch-old', name: 'Old' }) } });
    await saveBufferMapping({ brandSlug: 'textifai', channelId: 'ch-old' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'rate' }] }), { status: 429, headers: { 'retry-after': '12' } }))));
    await expect(refreshBufferChannels()).rejects.toThrow();
    expect(await prisma.bufferChannelCache.count()).toBe(1);
    expect((await prisma.bufferChannelMapping.findUniqueOrThrow({ where: { brandSlug: 'textifai' } })).channelId).toBe('ch-old');
  });

  it('live schedule sends body only and persists scheduled state', async () => {
    await prisma.bufferChannelCache.create({ data: { channelId: 'ch-1', channelName: 'Queue 1', payload: '{}' } });
    await saveBufferMapping({ brandSlug: 'textifai', channelId: 'ch-1' });
    await prisma.draft.updateMany({ where: { brand: { slug: 'textifai' } }, data: { status: 'rejected' } });
    const target = await prisma.draft.findFirstOrThrow({ where: { brand: { slug: 'textifai' } } });
    await prisma.draft.update({ where: { id: target.id }, data: { status: 'approved', title: 'Secret', body: 'Body only text' } });
    vi.stubGlobal('fetch', vi.fn(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}'));
      expect(payload.variables.input.text).toBe('Body only text');
      expect(JSON.stringify(payload)).not.toContain('Secret');
      return new Response(JSON.stringify({ data: { createPost: { post: { id: 'buf-1', status: 'scheduled', scheduledAt: target.scheduledAt?.toISOString() } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const result = await scheduleApprovedDrafts('textifai');
    expect(result.ok).toBe(true);
    expect(await prisma.scheduledPost.count()).toBe(1);
    expect((await prisma.scheduledPost.findFirstOrThrow()).bufferPostId).toBe('buf-1');
  });

  it('body over 280 blocks before Buffer', async () => {
    await prisma.bufferChannelCache.create({ data: { channelId: 'ch-1', channelName: 'Queue 1', payload: '{}' } });
    await saveBufferMapping({ brandSlug: 'textifai', channelId: 'ch-1' });
    await prisma.draft.updateMany({ where: { brand: { slug: 'textifai' } }, data: { status: 'rejected' } });
    const target = await prisma.draft.findFirstOrThrow({ where: { brand: { slug: 'textifai' } } });
    await prisma.draft.update({ where: { id: target.id }, data: { status: 'approved', body: 'x'.repeat(281) } });
    const result = await scheduleApprovedDrafts('textifai');
    expect(result.ok).toBe(false);
    expect(readBufferRequestLog()).toHaveLength(0);
  });

  it('delete unscheduled draft is local only with no Buffer', async () => {
    const target = await prisma.draft.findFirstOrThrow({ where: { brand: { slug: 'textifai' } } });
    const result = await deleteDraftEverywhere(target.id);
    expect(result.ok).toBe(true);
    expect(readBufferRequestLog()).toHaveLength(0);
    await expect(prisma.draft.findUnique({ where: { id: target.id } })).resolves.toBeNull();
  });

  it('delete scheduled draft calls Buffer once and removes local state', async () => {
    const target = await prisma.draft.findFirstOrThrow({ where: { brand: { slug: 'textifai' } } });
    await prisma.scheduledPost.create({ data: { brandSlug: 'textifai', draftId: target.id, bufferPostId: 'buf-del-1', title: target.title, body: target.body ?? 'body', scheduledAt: target.scheduledAt!, externalStatus: 'scheduled', payload: '{}' } });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { deletePost: { success: true } } }), { status: 200, headers: { 'content-type': 'application/json' } }))));
    const result = await deleteDraftEverywhere(target.id);
    expect(result.ok).toBe(true);
    expect(readBufferRequestLog().filter((item) => item.action === 'deletePost')).toHaveLength(1);
    expect(await prisma.scheduledPost.count()).toBe(0);
  });

  it('delete scheduled draft without Buffer key still removes stale local state', async () => {
    process.env.BUFFER_API_KEY = '';
    const target = await prisma.draft.findFirstOrThrow({ where: { brand: { slug: 'textifai' } } });
    await prisma.scheduledPost.create({ data: { brandSlug: 'textifai', draftId: target.id, bufferPostId: 'buf-stale-1', title: target.title, body: target.body ?? 'body', scheduledAt: target.scheduledAt!, externalStatus: 'scheduled', payload: '{}' } });
    const result = await deleteDraftEverywhere(target.id);
    expect(result.ok).toBe(true);
    expect(await prisma.scheduledPost.count()).toBe(0);
    await expect(prisma.draft.findUnique({ where: { id: target.id } })).resolves.toBeNull();
  });
});
