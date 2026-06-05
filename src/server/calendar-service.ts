import { prisma } from './week-plan-import-service';

function fallbackTitleFromDate(date: Date) {
  return `Post ${date.toISOString().slice(0, 10)} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export async function listScheduledPosts() {
  const scheduledPosts = await prisma.scheduledPost.findMany({ orderBy: { scheduledAt: 'asc' } });
  return {
    ok: true as const,
    scheduledPosts: scheduledPosts.map((post) => ({
      id: post.id,
      brandSlug: post.brandSlug,
      draftId: post.draftId,
      title: post.title.trim() || fallbackTitleFromDate(post.scheduledAt),
      body: post.body,
      scheduledAt: post.scheduledAt.toISOString(),
      externalStatus: post.externalStatus,
      payload: post.payload ? JSON.parse(post.payload) : null,
      createdAt: post.createdAt.toISOString()
    }))
  };
}
