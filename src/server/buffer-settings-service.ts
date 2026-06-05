import { prisma } from './week-plan-import-service';
import { isBufferConfigured, listChannels } from '../integrations/buffer/client';

function parsePayload(payload: string | null) {
  return payload ? JSON.parse(payload) : null;
}

export async function getBufferSettings() {
  const [mappings, channels] = await Promise.all([
    prisma.bufferChannelMapping.findMany({ orderBy: { brandSlug: 'asc' } }),
    prisma.bufferChannelCache.findMany({ orderBy: { channelName: 'asc' } })
  ]);
  return {
    ok: true as const,
    configured: isBufferConfigured(),
    mappings: mappings.map((item) => ({ brandSlug: item.brandSlug, channelId: item.channelId, channelName: item.channelName, payload: parsePayload(item.payload ?? null) })),
    channels: channels.map((item) => ({ id: item.channelId, name: item.channelName, payload: parsePayload(item.payload ?? null) }))
  };
}

export async function refreshBufferChannels() {
  const channels = await listChannels();
  for (const channel of channels) {
    await prisma.bufferChannelCache.upsert({
      where: { channelId: channel.id },
      update: { channelName: channel.name ?? null, payload: JSON.stringify(channel) },
      create: { channelId: channel.id, channelName: channel.name ?? null, payload: JSON.stringify(channel) }
    });
  }
  return getBufferSettings();
}

export async function saveBufferMapping(input: { brandSlug?: unknown; channelId?: unknown }) {
  const brandSlug = typeof input.brandSlug === 'string' ? input.brandSlug : '';
  const channelId = typeof input.channelId === 'string' ? input.channelId : '';
  if (!brandSlug) return { ok: false as const, status: 400, errors: ['brand.slug'] };
  if (!channelId) return { ok: false as const, status: 400, errors: ['buffer.channel_id'] };
  const channel = await prisma.bufferChannelCache.findUnique({ where: { channelId } });
  await prisma.bufferChannelMapping.upsert({
    where: { brandSlug },
    update: { channelId, channelName: channel?.channelName ?? null, payload: channel?.payload ?? null },
    create: { brandSlug, channelId, channelName: channel?.channelName ?? null, payload: channel?.payload ?? null }
  });
  return { ok: true as const };
}

export async function getBufferMapping(brandSlug: string) {
  return prisma.bufferChannelMapping.findUnique({ where: { brandSlug } });
}
