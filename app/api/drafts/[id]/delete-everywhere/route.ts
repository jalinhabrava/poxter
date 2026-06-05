import { NextResponse } from 'next/server';
import { deleteDraftEverywhere } from '../../../../../src/server/scheduling-service';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deleteDraftEverywhere(id);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch (error) {
    return NextResponse.json({ ok: false, errors: [error instanceof Error ? error.message : 'delete_failed'] }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return POST(request, context);
}
