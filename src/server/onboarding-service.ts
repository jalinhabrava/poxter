import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { getBrandRegistryInfo, type BrandConfig } from '../domain/brand-config';
import { isBufferConfigured } from '../integrations/buffer/client';
import { getBufferSettings } from './buffer-settings-service';
import { ensureBrands } from './brand-registry-service';
import { prisma } from './week-plan-import-service';

export function localConfigPaths() {
  const directory = join(homedir(), '.config', 'poxter');
  return { directory, env: join(directory, 'env'), brands: join(directory, 'brands.local.json') };
}

async function writePrivateFile(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('config.path_not_regular_file');
  }
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export async function persistVerifiedBufferApiKey(rawKey: string) {
  const apiKey = rawKey.trim();
  if (!apiKey || /[\r\n\0]/.test(apiKey)) throw new Error('buffer.api_key_invalid');
  const path = localConfigPaths().env;
  const existing = existsSync(path) ? await readFile(path, 'utf8') : '';
  const lines = existing.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?BUFFER_API_KEY\s*=/.test(line));
  while (lines.length && !lines.at(-1)) lines.pop();
  lines.push(`BUFFER_API_KEY=${shellQuote(apiKey)}`);
  await writePrivateFile(path, `${lines.join('\n')}\n`);
  process.env.BUFFER_API_KEY = apiKey;
  return { ok: true as const, stored: true as const };
}

export async function upsertLocalBrand(input: { slug: string; name: string; timezone?: string }) {
  const slug = input.slug.trim();
  const name = input.name.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('brand.slug_invalid');
  if (!name) throw new Error('brand.name_required');

  const path = localConfigPaths().brands;
  const overriddenPath = process.env.POXTER_BRANDS_FILE?.trim();
  if (overriddenPath && resolve(overriddenPath) !== resolve(path)) throw new Error('brands.file_override_active');
  const existing = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) as { brands?: BrandConfig[] } : { brands: [] };
  if (!Array.isArray(existing.brands)) throw new Error('brands.file_invalid');
  const index = existing.brands.findIndex((item) => item.slug === slug);
  const current = index >= 0 ? existing.brands[index] : null;
  const timezone = input.timezone?.trim() || current?.timezone || 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('brand.timezone_invalid'); }
  const brand: BrandConfig = { slug, name, timezone, platforms: current?.platforms ?? ['x'] };
  if (index >= 0) existing.brands[index] = { ...existing.brands[index], ...brand };
  else existing.brands.push(brand);
  await writePrivateFile(path, `${JSON.stringify({ brands: existing.brands }, null, 2)}\n`);
  await ensureBrands();
  return { ok: true as const, brand, source: 'local' as const };
}

export async function getOnboardingStatus() {
  let databaseReady = false;
  try { await prisma.brand.count(); databaseReady = true; } catch { /* Bootstrap has not created the database yet. */ }

  let brandRegistry: { source: string; brands: Array<{ slug: string; name: string; timezone: string | null }> } | null = null;
  try {
    const registry = getBrandRegistryInfo();
    brandRegistry = {
      source: registry.source,
      brands: registry.brands.map(({ slug, name, timezone }) => ({ slug, name, timezone: timezone ?? null }))
    };
  } catch { /* A missing registry is reported in the status. */ }

  const buffer = { configured: isBufferConfigured(), channelsCached: 0, mappings: [] as Array<{ brandSlug: string; channelName: string | null; channelAvailable: boolean }> };
  if (databaseReady) {
    const settings = await getBufferSettings();
    buffer.channelsCached = settings.channels.length;
    buffer.mappings = settings.mappings.map(({ brandSlug, channelId, channelName }) => ({ brandSlug, channelName, channelAvailable: settings.channels.some((channel) => channel.id === channelId) }));
  }
  return {
    ok: true as const,
    databaseReady,
    brandRegistry,
    buffer,
    usingExampleBrand: brandRegistry?.source === 'example',
    readyForLocalDrafts: databaseReady && Boolean(brandRegistry),
    readyForBufferScheduling: databaseReady && buffer.configured && brandRegistry?.source !== 'example' && Boolean(brandRegistry?.brands.length) && (brandRegistry?.brands.every((brand) => buffer.mappings.some((mapping) => mapping.brandSlug === brand.slug && mapping.channelAvailable)) ?? false)
  };
}
