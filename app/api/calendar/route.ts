import { NextResponse } from 'next/server';
import { listScheduledPosts } from '../../../src/server/calendar-service';

export async function GET() {
  return NextResponse.json(await listScheduledPosts());
}
