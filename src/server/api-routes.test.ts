import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prisma } from './week-plan-import-service';
import { POST as validatePOST } from '../../app/api/import/week-plan/validate/route';
import { POST as importPOST } from '../../app/api/import/week-plan/route';
import { GET as draftsGET } from '../../app/api/drafts/route';

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
