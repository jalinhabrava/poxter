import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prisma } from './week-plan-import-service';
import { POST as validatePOST } from '../../app/api/import/week-plan/validate/route';
import { POST as importPOST } from '../../app/api/import/week-plan/route';
import { GET as draftsGET } from '../../app/api/drafts/route';
import { PATCH as patchDraft } from '../../app/api/drafts/[id]/route';
import { POST as approveDraft } from '../../app/api/drafts/[id]/approve/route';
import { POST as rejectDraft } from '../../app/api/drafts/[id]/reject/route';
import { POST as needsReviewDraft } from '../../app/api/drafts/[id]/needs-review/route';
import { POST as backToDraft } from '../../app/api/drafts/[id]/back-to-draft/route';
import { POST as dryRunDraft } from '../../app/api/drafts/[id]/dry-run/route';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));

describe('api routes', () => {
  it('validate route returns ok for valid example', async () => {
    const response = await validatePOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    expect(response.status).toBe(200);
  });

  it('validate route returns errors for invalid json', async () => {
    const response = await validatePOST(new Request('http://localhost', { method: 'POST', body: 'not-json' }));
    expect(response.status).toBe(400);
  });

  it('import route persists drafts', async () => {
    await prisma.draft.deleteMany();
    const response = await importPOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    expect(response.status).toBe(200);
    expect(await prisma.draft.count()).toBe(7);
  });

  it('repeated import does not duplicate', async () => {
    await prisma.draft.deleteMany();
    await importPOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    await importPOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    expect(await prisma.draft.count()).toBe(7);
  });

  it('drafts API lists imported drafts', async () => {
    await prisma.draft.deleteMany();
    await importPOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    const response = await draftsGET(new Request('http://localhost/api/drafts?brandSlug=textifai'));
    const payload = await response.json();
    expect(payload.drafts).toHaveLength(7);
  });

  it('drafts API returns empty list for known brand with no drafts', async () => {
    await prisma.draft.deleteMany();
    const response = await draftsGET(new Request('http://localhost/api/drafts?brandSlug=textifai'));
    const payload = await response.json();
    expect(payload.drafts).toEqual([]);
  });
});

describe('draft review routes', () => {
  it('patch updates title/body', async () => {
    if ((await prisma.draft.count()) === 0) {
      await importPOST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ json: textifaiPlan }) }));
    }
    const draft = await prisma.draft.findFirstOrThrow();
    const response = await patchDraft(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ title: 'Internal', body: 'Edited body' }) }), { params: Promise.resolve({ id: draft.id }) });
    const payload = await response.json();
    expect(payload.draft.body).toBe('Edited body');
  });

  it('status routes work', async () => {
    const draft = await prisma.draft.findFirstOrThrow();
    expect((await (await approveDraft(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: draft.id }) })).json()).draft.status).toBe('approved');
    expect((await (await rejectDraft(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: draft.id }) })).json()).draft.status).toBe('rejected');
    expect((await (await needsReviewDraft(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: draft.id }) })).json()).draft.status).toBe('needs_review');
    expect((await (await backToDraft(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: draft.id }) })).json()).draft.status).toBe('draft');
  });

  it('dry-run returns body only', async () => {
    const draft = await prisma.draft.findFirstOrThrow();
    await prisma.draft.update({ where: { id: draft.id }, data: { title: 'Internal only', body: 'Body payload' } });
    const response = await dryRunDraft(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: draft.id }) });
    const payload = await response.json();
    expect(payload.dryRun).toBe(true);
    expect(payload.bufferCalled).toBe(false);
    expect(payload.publishText).toBe('Body payload');
  });
});
