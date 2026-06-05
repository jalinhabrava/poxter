import { NextResponse } from 'next/server';
import { listConfiguredBrands } from '../../../src/server/brand-registry-service';

export async function GET() {
  const brands = await listConfiguredBrands();
  return NextResponse.json({ ok: true, brands });
}
