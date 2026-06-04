import { NextResponse } from 'next/server';
import { validateWeekPlanContract } from '../../../../../src/domain/week-plan-contract';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = typeof body?.json === 'string' ? JSON.parse(body.json) : body?.json ?? body;
    const result = validateWeekPlanContract(raw);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
}
