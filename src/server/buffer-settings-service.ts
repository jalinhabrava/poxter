import { prisma } from './week-plan-import-service';
import { isBufferConfigured, listChannels, verifyConnection } from '../integrations/buffer/client';
import { getBrandRegistry } from '../domain/brand-config';

const brandAliases: Record<string, string[]> = {
  textifai: ['textifai'],
  ont: ['ont', 'oujanotsue', 'ouja no tsue'],
  bitcoinpendium: ['bitcoinpendium', 'davidbitcoinpendium', 'david bitcoinpendium']
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesBrand(channel: { id: string; name?: string | null }, brandSlug: string, brandName: string) {
  const haystack = normalize(`${channel.name ?? ''} ${channel.id}`);
  const tokens = [brandSlug, brandName, ...(brandAliases[brandSlug] ?? [])].map(normalize);
  return tokens.some((token) => token && haystack.includes(token));
}

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
  for (const brand of getBrandRegistry()) {
    const existing = await prisma.bufferChannelMapping.findUnique({ where: { brandSlug: brand.slug } });
    if (existing) continue;
    const match = channels.find((channel) => matchesBrand(channel, brand.slug, brand.name));
    if (!match) continue;
    await prisma.bufferChannelMapping.create({
      data: {
        brandSlug: brand.slug,
        channelId: match.id,
        channelName: match.name ?? null,
        payload: JSON.stringify(match)
      }
    });
  }
  return getBufferSettings();
}

export async function verifyBufferConnection() {
  await verifyConnection();
  return { ok: true as const, connected: true as const };
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
