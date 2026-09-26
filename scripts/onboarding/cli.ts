import { getBrandRegistry } from '../../src/domain/brand-config';
import { getBufferSettings, refreshBufferChannels, saveBufferMapping } from '../../src/server/buffer-settings-service';
import { getOnboardingStatus, upsertLocalBrand } from '../../src/server/onboarding-service';

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  if (command === 'status') return getOnboardingStatus();
  if (command === 'brand') {
    const slug = option('slug');
    const name = option('name');
    if (!slug || !name) throw new Error('usage: onboard brand --slug SLUG --name NAME [--timezone AREA/CITY]');
    return upsertLocalBrand({ slug, name, timezone: option('timezone') });
  }
  if (command === 'channels') {
    const settings = await refreshBufferChannels({ autoMap: false });
    return {
      ok: true as const,
      channels: settings.channels.map((channel, index) => ({
        index: index + 1,
        name: channel.name,
        service: typeof channel.payload === 'object' && channel.payload && 'service' in channel.payload ? channel.payload.service : null,
        organization: typeof channel.payload === 'object' && channel.payload && 'organizationName' in channel.payload ? channel.payload.organizationName : null
      }))
    };
  }
  if (command === 'map') {
    const brandSlug = option('brand');
    const channelIndex = Number(option('channel'));
    if (!brandSlug || !Number.isInteger(channelIndex) || channelIndex < 1) throw new Error('usage: onboard map --brand SLUG --channel INDEX');
    if (!getBrandRegistry().some((brand) => brand.slug === brandSlug)) throw new Error('brand.slug_unknown');
    const settings = await getBufferSettings();
    const channel = settings.channels[channelIndex - 1];
    if (!channel) throw new Error('buffer.channel_index_unknown');
    await saveBufferMapping({ brandSlug, channelId: channel.id });
    return { ok: true as const, brandSlug, channelName: channel.name };
  }
  throw new Error('usage: onboard status | brand | buffer | channels | map');
}

void main().then((result) => console.log(JSON.stringify(result))).catch((error) => {
  const message = error instanceof Error ? error.message : 'onboarding_failed';
  const secret = process.env.BUFFER_API_KEY?.trim();
  console.error(JSON.stringify({ ok: false, error: secret ? message.replaceAll(secret, '[redacted]') : message }));
  process.exitCode = 1;
});
