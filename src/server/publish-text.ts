export function buildPublishText(input: { title?: string | null; body?: string | null; platform?: string | null }) {
  const text = (input.body ?? '').trim();
  const limit = input.platform === 'x' ? 280 : null;
  const characterCount = text.length;
  const errors: string[] = [];
  if (!text) errors.push('body.empty');
  if (limit !== null && characterCount > limit) errors.push('body.too_long');
  return { ok: errors.length === 0, text, characterCount, limit, errors };
}
