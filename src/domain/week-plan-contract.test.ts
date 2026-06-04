import { describe, expect, it } from 'vitest';
import { brands } from './brand-config';
import { validateWeekPlanContract } from './week-plan-contract';
import { readFileSync } from 'node:fs';

const textifaiPlan = JSON.parse(readFileSync('schedule.json.example', 'utf8'));
const bitcoinPlan = JSON.parse(readFileSync('docs/contracts/bitcoinpendium.week-plan.v1.example.json', 'utf8'));

describe('brand registry', () => {
  it('includes all 3 brands', () => {
    expect(brands.map((brand) => brand.slug)).toEqual(['textifai', 'ont', 'bitcoinpendium']);
  });
});

describe('week plan contract', () => {
  it('valid TextifAI plan', () => {
    expect(validateWeekPlanContract(textifaiPlan)).toEqual({ ok: true, errors: [] });
  });

  it('valid Bitcoinpendium plan', () => {
    expect(validateWeekPlanContract(bitcoinPlan)).toEqual({ ok: true, errors: [] });
  });

  it('rejects unknown brand', () => {
    expect(validateWeekPlanContract({ ...textifaiPlan, brand: { slug: 'nope', name: 'Nope' } }).ok).toBe(false);
  });

  it('rejects mismatched brand name', () => {
    expect(validateWeekPlanContract({ ...textifaiPlan, brand: { slug: 'textifai', name: 'Wrong' } }).ok).toBe(false);
  });

  it('rejects duplicate external_id', () => {
    const duplicate = { ...textifaiPlan, drafts: [...textifaiPlan.drafts, { ...textifaiPlan.drafts[0] }] };
    expect(validateWeekPlanContract(duplicate).ok).toBe(false);
  });

  it('does not require fixed slots', () => {
    expect(validateWeekPlanContract({ ...textifaiPlan, drafts: [{ ...textifaiPlan.drafts[0], slot_id: '' }] }).ok).toBe(true);
    expect(validateWeekPlanContract({ ...textifaiPlan, drafts: [{ ...textifaiPlan.drafts[0], slot_id: 'bad' }] }).ok).toBe(true);
  });

  it('requires body or thread_posts', () => {
    expect(validateWeekPlanContract({ ...textifaiPlan, drafts: [{ ...textifaiPlan.drafts[0], body: '', thread_posts: [] }] }).ok).toBe(false);
  });

  it('rejects status outside allowed list', () => {
    expect(validateWeekPlanContract({ ...textifaiPlan, drafts: [{ ...textifaiPlan.drafts[0], status: 'posted' }] }).ok).toBe(false);
  });

  it('accepts schedule example', () => {
    expect(validateWeekPlanContract(textifaiPlan).ok).toBe(true);
  });

  it('does not import buffer client', () => {
    const source = readFileSync('src/domain/week-plan-contract.ts', 'utf8');
    expect(source).not.toContain('Buffer');
  });
});
