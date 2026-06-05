import { describe, expect, it, beforeEach } from 'vitest';
import { importWeekPlan, prisma } from './week-plan-import-service';
import { buildPublishText } from './publish-text';
import { dryRunDraft, listDraftsByBrandSlug, setDraftStatus, updateDraft } from './drafts-service';
import { readFileSync } from 'node:fs';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));
const bitcoinPlan = JSON.parse(readFileSync('docs/contracts/bitcoinpendium.week-plan.v1.example.json', 'utf8'));

async function seedDrafts() {
  await prisma.safetyWarning.deleteMany();
  await prisma.sourceItem.deleteMany();
  await prisma.draft.deleteMany();
  await importWeekPlan(textifaiPlan);
  await importWeekPlan(bitcoinPlan);
}

describe('draft review workflow', () => {
  beforeEach(async () => {
    await seedDrafts();
  });

  it('update title/body persists', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    const result = await updateDraft(draft.id, { title: 'Internal title', body: 'Updated body' });
    expect(result.ok).toBe(true);
    expect((await prisma.draft.findUniqueOrThrow({ where: { id: draft.id } })).body).toBe('Updated body');
  });

  it('saving one draft does not update another', async () => {
    const first = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    const second = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-2' } });
    await updateDraft(first.id, { body: 'Only first' });
    expect((await prisma.draft.findUniqueOrThrow({ where: { id: second.id } })).body).toBe('Hello 2');
  });

  it('approve reject needs_review back_to_draft work', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    expect((await setDraftStatus(draft.id, 'approved')).draft!.status).toBe('approved');
    expect((await setDraftStatus(draft.id, 'rejected')).draft!.status).toBe('rejected');
    expect((await setDraftStatus(draft.id, 'needs_review')).draft!.status).toBe('needs_review');
    expect((await setDraftStatus(draft.id, 'draft')).draft!.status).toBe('draft');
  });

  it('invalid status transition rejected', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    const result = await setDraftStatus(draft.id, 'scheduled' as never);
    expect(result.ok).toBe(false);
  });

  it('dry-run text is body only and title never included', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    await updateDraft(draft.id, { title: 'Secret title', body: 'Body only text' });
    const result = await dryRunDraft(draft.id);
    expect(result.publishText).toBe('Body only text');
    expect(result.publishText).not.toContain('Secret title');
  });

  it('140 chars valid', () => {
    const result = buildPublishText({ body: 'x'.repeat(140), platform: 'x' });
    expect(result.ok).toBe(true);
  });

  it('141 chars invalid', () => {
    const result = buildPublishText({ body: 'x'.repeat(141), platform: 'x' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('body.too_long');
  });

  it('empty body invalid', () => {
    const result = buildPublishText({ body: '   ', platform: 'x' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('body.empty');
  });

  it('dry-run calls no Buffer', async () => {
    const draft = await prisma.draft.findFirstOrThrow({ where: { externalId: 'draft-1' } });
    const result = await dryRunDraft(draft.id);
    expect(result.bufferCalled).toBe(false);
  });

  it('Bitcoinpendium drafts edit independently', async () => {
    const bitcoin = await prisma.draft.findFirstOrThrow({ where: { externalId: 'btc-draft-1' } });
    await updateDraft(bitcoin.id, { body: 'Bitcoin body' });
    expect((await prisma.draft.findUniqueOrThrow({ where: { id: bitcoin.id } })).body).toBe('Bitcoin body');
    expect((await listDraftsByBrandSlug('textifai')).drafts).toHaveLength(7);
  });

  it('imported drafts still list correctly', async () => {
    const result = await listDraftsByBrandSlug('textifai');
    expect(result.ok).toBe(true);
    expect(result.drafts).toHaveLength(7);
  });
});
