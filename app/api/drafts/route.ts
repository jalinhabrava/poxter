import { NextResponse } from 'next/server';
import { listDraftsByBrandSlug } from '../../../src/server/drafts-service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandSlug = url.searchParams.get('brandSlug') ?? '';
  if (!brandSlug) return NextResponse.json({ ok: false, errors: ['brandSlug'] }, { status: 400 });
  const result = await listDraftsByBrandSlug(brandSlug);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json({ ok: true, drafts: result.drafts });
}
