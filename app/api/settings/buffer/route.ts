import { NextResponse } from 'next/server';
import { saveBufferMapping, getBufferSettings } from '../../../../src/server/buffer-settings-service';

export async function GET() {
  const result = await getBufferSettings();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveBufferMapping(body ?? {});
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
}
