import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { startBufferKeyEntry } from '../../scripts/onboarding/buffer-key';
import { verifyConnection } from '../integrations/buffer/client';
import { persistVerifiedBufferApiKey } from './onboarding-service';

it('accepts a Buffer key only through the loopback page, verifies it, and stores it privately', async () => {
  const temporaryHome = mkdtempSync(join(tmpdir(), 'poxter-buffer-setup-'));
  const previousHome = process.env.HOME;
  const previousKey = process.env.BUFFER_API_KEY;
  process.env.HOME = temporaryHome;
  delete process.env.BUFFER_API_KEY;
  let completed = false;
  const setup = await startBufferKeyEntry(async (key) => {
    if (key !== 'synthetic-valid-key') throw Object.assign(new Error('unauthorized'), { status: 401 });
  });
  try {
    const initial = await fetch(setup.url);
    expect(initial.status).toBe(200);
    const html = await initial.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
    expect(csrf).toBeTruthy();

    const rejected = await fetch(new URL('/connect', setup.url), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: new URL(setup.url).origin },
      body: new URLSearchParams({ csrf: csrf!, apiKey: 'synthetic-invalid-key' })
    });
    expect(rejected.status).toBe(400);
    expect(existsSync(join(temporaryHome, '.config/poxter/env'))).toBe(false);

    const accepted = await fetch(new URL('/connect', setup.url), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: new URL(setup.url).origin },
      body: new URLSearchParams({ csrf: csrf!, apiKey: 'synthetic-valid-key' })
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).not.toContain('synthetic-valid-key');
    await setup.done;
    completed = true;

    const envPath = join(temporaryHome, '.config/poxter/env');
    expect(readFileSync(envPath, 'utf8')).toContain('synthetic-valid-key');
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    await persistVerifiedBufferApiKey("synthetic-'$-rotated-key");
    const updated = readFileSync(envPath, 'utf8');
    expect(updated).toContain('synthetic-');
    expect(updated).not.toContain('synthetic-valid-key');
    const sourced = spawnSync('bash', ['-c', 'source "$1"; test "$BUFFER_API_KEY" = "$2"', 'bash', envPath, "synthetic-'$-rotated-key"]);
    expect(sourced.status).toBe(0);
  } finally {
    if (!completed) setup.close();
    if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
    if (previousKey === undefined) delete process.env.BUFFER_API_KEY; else process.env.BUFFER_API_KEY = previousKey;
    rmSync(temporaryHome, { recursive: true, force: true });
  }
});

it('verifies the supplied key through a read-only Buffer request', async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    expect(init?.headers).toMatchObject({ authorization: 'Bearer synthetic-key' });
    expect(String(init?.body)).toContain('AccountOrganizations');
    return new Response(JSON.stringify({ data: { account: { organizations: [] } } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    await expect(verifyConnection('synthetic-key')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
