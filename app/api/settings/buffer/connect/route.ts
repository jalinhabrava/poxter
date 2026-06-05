import { NextResponse } from 'next/server';
import { verifyBufferConnection } from '../../../../../src/server/buffer-settings-service';
import { toBufferErrorResponse } from '../../../../../src/server/buffer-api-response';

export async function POST() {
  try {
    const result = await verifyBufferConnection();
    return NextResponse.json(result);
  } catch (error) {
    const payload = toBufferErrorResponse(error);
    return NextResponse.json(payload, { status: payload.status });
  }
}
