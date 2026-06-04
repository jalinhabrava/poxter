import { NextResponse } from 'next/server';
import { prisma } from '../../../src/server/week-plan-import-service';

export async function GET() {
  const scheduledPosts = await prisma.scheduledPost.findMany({ orderBy: { scheduledAt: 'asc' } });
  return NextResponse.json({
    ok: true,
    scheduledPosts: scheduledPosts.map((post) => ({
      id: post.id,
      brandSlug: post.brandSlug,
      draftId: post.draftId,
      title: post.title,
      body: post.body,
      scheduledAt: post.scheduledAt.toISOString(),
      externalStatus: post.externalStatus,
      payload: post.payload ? JSON.parse(post.payload) : null,
      createdAt: post.createdAt.toISOString()
    }))
  });
}
