import { NextResponse } from 'next/server';
import { deleteDraftEverywhere } from '../../../../../src/server/scheduling-service';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteDraftEverywhere(id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
