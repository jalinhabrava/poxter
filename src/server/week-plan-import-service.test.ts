import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importWeekPlan, prisma } from './week-plan-import-service';
import { listDraftsByBrandSlug } from './drafts-service';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));
const bitcoinPlan = JSON.parse(readFileSync('docs/contracts/bitcoinpendium.week-plan.v1.example.json', 'utf8'));

beforeEach(async () => {
  await prisma.safetyWarning.deleteMany();
  await prisma.sourceItem.deleteMany();
  await prisma.draft.deleteMany();
});

describe('week-plan import service', () => {
  it('imports 7 TextifAI drafts', async () => {
    const result = await importWeekPlan(textifaiPlan);
    expect(result).toEqual({ ok: true, imported: 7 });
    expect(await prisma.draft.count()).toBe(7);
  });

  it('imports Bitcoinpendium under bitcoinpendium', async () => {
    const result = await importWeekPlan(bitcoinPlan);
    expect(result.ok).toBe(true);
    const drafts = await prisma.draft.findMany({ include: { brand: true } });
    expect(drafts.every((draft) => draft.brand.slug === 'bitcoinpendium')).toBe(true);
  });

  it('keeps Bitcoinpendium out of TextifAI', async () => {
    await importWeekPlan(bitcoinPlan);
    const result = await listDraftsByBrandSlug('textifai');
    expect(result.ok).toBe(true);
    expect(result.drafts).toEqual([]);
  });

  it('rejects unknown brand', async () => {
    const result = await importWeekPlan({ ...textifaiPlan, brand: { slug: 'nope', name: 'Nope' } });
    expect(result.ok).toBe(false);
  });

  it('rejects mismatched brand name', async () => {
    const result = await importWeekPlan({ ...textifaiPlan, brand: { slug: 'textifai', name: 'Wrong' } });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid slot reference', async () => {
    const invalid = { ...textifaiPlan, drafts: textifaiPlan.drafts.map((draft: any) => ({ ...draft, slot_id: 'bad' })) };
    const result = await importWeekPlan(invalid);
    expect(result.ok).toBe(false);
  });

  it('is idempotent by external id', async () => {
    await importWeekPlan(textifaiPlan);
    await importWeekPlan({ ...textifaiPlan, drafts: textifaiPlan.drafts.map((draft: any, index: number) => index === 0 ? { ...draft, title: 'Updated' } : draft) });
    expect(await prisma.draft.count()).toBe(7);
    expect((await prisma.draft.findUnique({ where: { externalId: textifaiPlan.drafts[0].external_id } }))?.title).toBe('Updated');
  });

  it('replace_week replaces only selected brand/week', async () => {
    await importWeekPlan(textifaiPlan);
    await importWeekPlan(bitcoinPlan);
    await importWeekPlan({ ...textifaiPlan, drafts: textifaiPlan.drafts.slice(0, 2) }, 'replace_week');
    expect(await prisma.draft.count({ where: { brand: { slug: 'textifai' } } })).toBe(2);
    expect(await prisma.draft.count({ where: { brand: { slug: 'bitcoinpendium' } } })).toBeGreaterThan(0);
  });

  it('persists source context and safety warnings if present', async () => {
    await importWeekPlan({ ...textifaiPlan, source_context: [{ external_id: 'src-1', kind: 'link', url: 'https://example.com' }], safety_warnings: [{ message: 'Review tone' }] });
    expect(await prisma.sourceItem.count()).toBe(1);
    expect(await prisma.safetyWarning.count()).toBe(1);
  });

  it('does not create ScheduledPost', async () => {
    await importWeekPlan(textifaiPlan);
    expect(await prisma.scheduledPost.count()).toBe(0);
  });

  it('does not call Buffer', async () => {
    const source = readFileSync('src/server/week-plan-import-service.ts', 'utf8');
    expect(source).not.toContain('Buffer');
  });
});
