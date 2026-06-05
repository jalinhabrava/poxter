import { NextResponse } from 'next/server';
import { createDraft, listDraftsByBrandSlug } from '../../../src/server/drafts-service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandSlug = url.searchParams.get('brandSlug') ?? '';
  if (!brandSlug) return NextResponse.json({ ok: false, errors: ['brandSlug'] }, { status: 400 });
  const result = await listDraftsByBrandSlug(brandSlug);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json({ ok: true, drafts: result.drafts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDraft(body ?? {});
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
}
