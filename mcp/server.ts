import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { listConfiguredBrands } from '../src/server/brand-registry-service';
import { listScheduledPosts } from '../src/server/calendar-service';
import {
  createDraft,
  dryRunDraft,
  getDraftById,
  listDraftsByBrandSlug,
  setDraftStatus,
  updateDraft
} from '../src/server/drafts-service';
import { getBufferSettings, refreshBufferChannels, saveBufferMapping, verifyBufferConnection } from '../src/server/buffer-settings-service';
import { getOnboardingStatus, upsertLocalBrand } from '../src/server/onboarding-service';
import { dryRunApprovedDrafts, scheduleApprovedDrafts } from '../src/server/scheduling-service';
import { importWeekPlan } from '../src/server/week-plan-import-service';
import { validateWeekPlanContract } from '../src/domain/week-plan-contract';
import { startBufferKeyEntry } from '../scripts/onboarding/buffer-key';

function response(value: unknown) {
  const failed = typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    ...(failed ? { isError: true } : {})
  };
}

function run<T>(operation: () => Promise<T> | T) {
  return async () => {
    try {
      return response(await operation());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unexpected_error';
      const secret = process.env.BUFFER_API_KEY?.trim();
      return response({ ok: false, errors: [secret ? message.replaceAll(secret, '[redacted]') : message] });
    }
  };
}

function parsePlan(json: string) {
  try {
    return { ok: true as const, plan: JSON.parse(json) as unknown };
  } catch {
    return { ok: false as const, errors: ['invalid_json'] };
  }
}

export function createPoxterMcpServer() {
  const server = new McpServer(
    { name: 'poxter', version: '0.1.0' },
    { instructions: 'Poxter manages local drafts and optional Buffer scheduling. For a fresh clone, follow docs/chat-onboarding.md; the Buffer key is entered on a private loopback page, never as a tool argument. Inspect brands and drafts before changing them. Live scheduling calls Buffer; use it only after the user explicitly requests scheduling and review the approved drafts first.' }
  );
  let activeBufferSetup: Awaited<ReturnType<typeof startBufferKeyEntry>> | null = null;

  server.registerTool('onboarding_status', {
    description: 'Check local database, brand registry, Buffer key presence, cached channels, and mappings without exposing secrets or calling Buffer.',
    inputSchema: z.object({})
  }, run(() => getOnboardingStatus()));

  server.registerTool('upsert_local_brand', {
    description: 'Create or update a brand in the private local registry and database. The default platform is X.',
    inputSchema: z.object({ slug: z.string().min(1), name: z.string().min(1), timezone: z.string().optional() })
  }, async (input) => run(() => upsertLocalBrand(input))());

  server.registerTool('list_brands', {
    description: 'List brands configured in this local Poxter installation.',
    inputSchema: z.object({})
  }, run(async () => ({ ok: true, brands: await listConfiguredBrands() })));

  server.registerTool('list_drafts', {
    description: 'List local drafts for one brand.',
    inputSchema: z.object({ brandSlug: z.string().min(1) })
  }, async ({ brandSlug }) => run(() => listDraftsByBrandSlug(brandSlug))());

  server.registerTool('get_draft', {
    description: 'Get one local draft by ID.',
    inputSchema: z.object({ id: z.string().min(1) })
  }, async ({ id }) => run(() => getDraftById(id))());

  server.registerTool('create_draft', {
    description: 'Create a local draft. This does not publish or call Buffer.',
    inputSchema: z.object({
      brandSlug: z.string().min(1),
      title: z.string().optional(),
      body: z.string().optional(),
      scheduleDate: z.string().optional().describe('YYYY-MM-DD'),
      scheduleTimeLocal: z.string().optional().describe('HH:MM'),
      timezone: z.string().optional()
    })
  }, async (input) => run(() => createDraft(input))());

  server.registerTool('update_draft', {
    description: 'Edit the local title, body, or schedule of a draft. This does not publish.',
    inputSchema: z.object({
      id: z.string().min(1),
      title: z.string().optional(),
      body: z.string().optional(),
      scheduleDate: z.string().optional().describe('YYYY-MM-DD'),
      scheduleTimeLocal: z.string().optional().describe('HH:MM'),
      timezone: z.string().optional()
    })
  }, async ({ id, ...input }) => run(() => updateDraft(id, input))());

  server.registerTool('set_draft_status', {
    description: 'Set the local review status of one draft. Approval does not schedule it in Buffer.',
    inputSchema: z.object({
      id: z.string().min(1),
      status: z.enum(['draft', 'needs_review', 'approved', 'rejected'])
    })
  }, async ({ id, status }) => run(() => setDraftStatus(id, status))());

  server.registerTool('dry_run_draft', {
    description: 'Check the publish text and character limit for one draft without calling Buffer.',
    inputSchema: z.object({ id: z.string().min(1) })
  }, async ({ id }) => run(() => dryRunDraft(id))());

  server.registerTool('validate_week_plan', {
    description: 'Validate a week-plan JSON string without importing it.',
    inputSchema: z.object({ json: z.string() })
  }, async ({ json }) => run(() => {
    const parsed = parsePlan(json);
    return parsed.ok ? validateWeekPlanContract(parsed.plan) : parsed;
  })());

  server.registerTool('import_week_plan', {
    description: 'Import valid week-plan JSON into local drafts using external-ID upserts. This does not publish or replace the whole week.',
    inputSchema: z.object({ json: z.string() })
  }, async ({ json }) => run(() => {
    const parsed = parsePlan(json);
    return parsed.ok ? importWeekPlan(parsed.plan) : parsed;
  })());

  server.registerTool('list_scheduled_posts', {
    description: 'List locally recorded scheduled posts and their external statuses.',
    inputSchema: z.object({})
  }, run(() => listScheduledPosts()));

  server.registerTool('get_buffer_settings', {
    description: 'Inspect whether Buffer is configured and see cached channel mappings. Does not call Buffer.',
    inputSchema: z.object({})
  }, run(() => getBufferSettings()));

  server.registerTool('start_buffer_key_setup', {
    description: 'Start a private 127.0.0.1 page where the user can enter and verify a Buffer API key without putting it in the chat. Returns only the local page URL.',
    inputSchema: z.object({})
  }, run(async () => {
    if (!activeBufferSetup) {
      activeBufferSetup = await startBufferKeyEntry();
      void activeBufferSetup.done.then(() => { activeBufferSetup = null; });
    }
    return { ok: true as const, url: activeBufferSetup.url };
  }));

  server.registerTool('verify_buffer_connection', {
    description: 'Verify the locally configured Buffer key with a read-only Buffer API request. Does not publish.',
    inputSchema: z.object({})
  }, run(() => verifyBufferConnection()));

  server.registerTool('refresh_buffer_channels', {
    description: 'Fetch Buffer channels and cache them locally without automatically assigning a brand to a channel. Does not publish.',
    inputSchema: z.object({})
  }, run(() => refreshBufferChannels({ autoMap: false })));

  server.registerTool('save_buffer_mapping', {
    description: 'Save a local mapping from a Poxter brand to a Buffer channel ID. Does not schedule posts.',
    inputSchema: z.object({ brandSlug: z.string().min(1), channelId: z.string().min(1) })
  }, async (input) => run(() => saveBufferMapping(input))());

  server.registerTool('dry_run_approved_drafts', {
    description: 'Preview approved drafts for a brand without calling Buffer.',
    inputSchema: z.object({ brandSlug: z.string().min(1) })
  }, async ({ brandSlug }) => run(() => dryRunApprovedDrafts(brandSlug))());

  server.registerTool('schedule_approved_drafts', {
    description: 'LIVE ACTION: schedule all approved drafts for one brand in Buffer. Use only when the user explicitly requests live scheduling, after checking drafts and settings. Requires the exact confirmation value.',
    inputSchema: z.object({
      brandSlug: z.string().min(1),
      confirmation: z.literal('schedule-approved-in-buffer')
    })
  }, async ({ brandSlug }) => run(() => scheduleApprovedDrafts(brandSlug))());

  return server;
}

void serveStdio(createPoxterMcpServer);
