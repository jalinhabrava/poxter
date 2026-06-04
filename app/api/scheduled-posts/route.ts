import { NextResponse } from 'next/server';
import { persistScheduledPost } from '../../../src/server/scheduled-posts-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await persistScheduledPost(body ?? {});
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
}
