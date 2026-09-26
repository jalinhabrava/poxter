import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd());
let temporaryHome: string;
let child: ChildProcessWithoutNullStreams;
let stderr = '';
let nextId = 1;
const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void }>();

function request(method: string, params: Record<string, unknown>) {
  const id = nextId++;
  return new Promise<any>((resolveReply, rejectReply) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      rejectReply(new Error(`MCP timeout for ${method}: ${stderr}`));
    }, 15000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timeout); resolveReply(value); },
      reject: (error) => { clearTimeout(timeout); rejectReply(error); }
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

async function callTool(name: string, args: Record<string, unknown>) {
  const reply = await request('tools/call', { name, arguments: args });
  expect(reply.error).toBeUndefined();
  return { result: JSON.parse(reply.result.content[0].text), isError: reply.result.isError === true };
}

beforeAll(() => {
  temporaryHome = mkdtempSync(join(tmpdir(), 'poxter-mcp-test-'));
  const databaseUrl = `file:${join(temporaryHome, 'test.db')}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, POXTER_BRANDS_FILE: '' };
  delete env.BUFFER_API_KEY;
  const setup = spawnSync(join(repoRoot, 'node_modules/.bin/prisma'), ['db', 'push', '--skip-generate'], {
    cwd: repoRoot, env, encoding: 'utf8', timeout: 60000
  });
  expect(setup.status, setup.stderr).toBe(0);

  mkdirSync(join(temporaryHome, '.config/poxter'), { recursive: true });
  writeFileSync(join(temporaryHome, '.config/poxter/env'), `DATABASE_URL="${databaseUrl}"\n`);
  child = spawn('bash', [join(repoRoot, 'scripts/mcp/poxter-mcp.sh')], {
    cwd: temporaryHome, env: { ...env, HOME: temporaryHome }, stdio: 'pipe'
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  let buffer = '';
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let reply: any;
      try { reply = JSON.parse(line); } catch { throw new Error(`Invalid MCP stdout: ${line}`); }
      if (typeof reply.id !== 'number') continue;
      pending.get(reply.id)?.resolve(reply);
      pending.delete(reply.id);
    }
  });
  child.on('close', () => {
    for (const request of pending.values()) request.reject(new Error(`MCP server exited: ${stderr}`));
    pending.clear();
  });
}, 60000);

afterAll(async () => {
  if (child && child.exitCode === null) {
    const closed = new Promise<void>((resolveClose) => child.once('close', () => resolveClose()));
    child.kill();
    await closed;
  }
  if (temporaryHome) rmSync(temporaryHome, { recursive: true, force: true });
});

it('serves MCP tools against isolated local data without calling Buffer', async () => {
  const initialized = await request('initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'poxter-test', version: '1.0.0' }
  });
  expect(initialized.result.serverInfo.name).toBe('poxter');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

  const listedTools = await request('tools/list', {});
  expect(listedTools.result.tools.map((tool: any) => tool.name)).toContain('upsert_local_brand');
  expect((await callTool('onboarding_status', {})).result.usingExampleBrand).toBe(true);
  const brand = await callTool('upsert_local_brand', { slug: 'sample-brand', name: 'Sample Brand', timezone: 'UTC' });
  expect(brand.isError).toBe(false);
  expect((await callTool('list_brands', {})).result.brands.map((item: any) => item.slug)).toEqual(['sample-brand']);

  const created = await callTool('create_draft', { brandSlug: 'sample-brand', title: 'MCP test', body: 'Synthetic text' });
  expect(created.isError).toBe(false);
  const id = created.result.draft.id;
  expect((await callTool('get_draft', { id })).result.draft.body).toBe('Synthetic text');
  expect((await callTool('set_draft_status', { id, status: 'approved' })).result.draft.status).toBe('approved');
  const dryRun = await callTool('dry_run_draft', { id });
  expect(dryRun.result.bufferCalled).toBe(false);
  expect((await callTool('list_drafts', { brandSlug: 'sample-brand' })).result.drafts).toHaveLength(1);
  expect((await callTool('validate_week_plan', { json: '{' })).isError).toBe(true);
  const setup = await callTool('start_buffer_key_setup', {});
  expect(setup.result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  expect((await fetch(setup.result.url)).status).toBe(200);
}, 30000);
