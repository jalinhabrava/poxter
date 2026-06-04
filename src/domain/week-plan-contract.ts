import { getBrandConfig } from './brand-config';

const allowedDraftStatuses = new Set(['draft', 'needs_review', 'approved']);
const allowedExternalStatuses = new Set(['unknown', 'scheduled', 'missing', 'deleted', 'failed']);

export function validateWeekPlanContract(input: unknown) {
  const errors: string[] = [];
  const plan = input as any;

  if (!plan || plan.schema_version !== 'social-controller.week-plan.v1') errors.push('schema_version');
  const brand = plan?.brand;
  const localBrand = typeof brand?.slug === 'string' ? getBrandConfig(brand.slug) : null;
  if (!localBrand) errors.push('brand.slug');
  if (localBrand && brand?.name && brand.name !== localBrand.name) errors.push('brand.name');

  if (!plan?.week?.start_date) errors.push('week.start_date');
  if (!plan?.week?.end_date) errors.push('week.end_date');
  if (!plan?.week?.timezone) errors.push('week.timezone');

  const drafts = Array.isArray(plan?.drafts) ? plan.drafts : [];
  const externalIds = new Set<string>();

  for (const draft of drafts) {
    if (!draft?.external_id) errors.push('draft.external_id');
    if (draft?.external_id && externalIds.has(draft.external_id)) errors.push('draft.external_id.duplicate');
    if (draft?.external_id) externalIds.add(draft.external_id);
    if (!draft?.platform) errors.push('draft.platform');
    if (!draft?.format) errors.push('draft.format');
    if (!draft?.title) errors.push('draft.title');
    const hasBody = typeof draft?.body === 'string' && draft.body.trim().length > 0;
    const threadPosts = Array.isArray(draft?.thread_posts) ? draft.thread_posts.filter((post: unknown) => typeof post === 'string' && String(post).trim().length > 0) : [];
    if (!hasBody && threadPosts.length === 0) errors.push('draft.body_or_thread_posts');
    if (!allowedDraftStatuses.has(draft?.status)) errors.push('draft.status');
    if (draft?.external_status && !allowedExternalStatuses.has(draft.external_status)) errors.push('draft.external_status');
  }

  return { ok: errors.length === 0, errors };
}
