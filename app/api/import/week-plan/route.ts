import { NextResponse } from 'next/server';
import { importWeekPlan } from '../../../../src/server/week-plan-import-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = typeof body?.json === 'string' ? JSON.parse(body.json) : body?.json ?? body;
    const mode = body?.mode === 'replace_week' ? 'replace_week' : 'upsert_by_external_id';
    const result = await importWeekPlan(raw, mode);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
}
