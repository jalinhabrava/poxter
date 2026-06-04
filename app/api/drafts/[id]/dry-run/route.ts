import { NextResponse } from 'next/server';
import { dryRunDraft } from '../../../../../src/server/drafts-service';
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await dryRunDraft(id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
