import { BufferApiError } from './errors';
import { ACCOUNT_ORGANIZATIONS_QUERY, CREATE_POST_MUTATION, DELETE_POST_MUTATION, LIST_CHANNELS_QUERY } from './graphql';
import { logBufferRequest } from './request-log';

type BufferGraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

function getApiKey() {
  return process.env.BUFFER_API_KEY?.trim() ?? '';
}

async function callBuffer<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new BufferApiError('buffer.api_key_missing', 400);
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? '0') || undefined;
    throw new BufferApiError('buffer.rate_limited', 429, retryAfter);
  }
  const payload = await response.json() as BufferGraphqlResponse<T>;
  if (!response.ok) throw new BufferApiError(payload.errors?.[0]?.message ?? 'buffer.request_failed', response.status);
  if (payload.errors?.length) throw new BufferApiError(payload.errors[0]?.message ?? 'buffer.request_failed', 400);
  if (!payload.data) throw new BufferApiError('buffer.empty_response', 502);
  return payload.data;
}

export async function listChannels() {
  logBufferRequest('listChannels');
  const accountData = await callBuffer<{ account?: { organizations?: Array<{ id: string; name?: string | null }> | null } | null }>(ACCOUNT_ORGANIZATIONS_QUERY);
  const organizations = accountData.account?.organizations ?? [];
  const channels = [] as Array<{ id: string; name?: string | null; service?: string | null; organizationId: string }>;
  for (const organization of organizations) {
    const data = await callBuffer<{ channels?: Array<{ id: string; name?: string | null; service?: string | null }> | null }>(LIST_CHANNELS_QUERY, { organizationId: organization.id });
    channels.push(...(data.channels ?? []).map((channel) => ({ ...channel, organizationId: organization.id })));
  }
  return channels;
}

export async function verifyConnection() {
  logBufferRequest('verifyConnection');
  await callBuffer<{ account?: { organizations?: Array<{ id: string; name?: string | null }> | null } | null }>(ACCOUNT_ORGANIZATIONS_QUERY);
  return true;
}

export async function createPost(input: { channelId: string; text: string; scheduledAt: string }) {
  logBufferRequest('createPost');
  const data = await callBuffer<{ createPost?: { post?: { id?: string | null; status?: string | null; dueAt?: string | null } | null; message?: string | null } }>(CREATE_POST_MUTATION, {
    input: { channelId: input.channelId, text: input.text, schedulingType: 'automatic', mode: 'customScheduled', dueAt: input.scheduledAt, assets: [] }
  });
  if (data.createPost?.message) throw new BufferApiError(data.createPost.message, 400);
  return data.createPost?.post ?? null;
}

export async function deletePost(id: string) {
  logBufferRequest('deletePost');
  const data = await callBuffer<{ deletePost?: { postId?: string | null; message?: string | null } | null }>(DELETE_POST_MUTATION, { input: { id } });
  if (data.deletePost?.message) {
    const message = data.deletePost.message.toLowerCase();
    if (message.includes('not found') || message.includes('does not exist')) return false;
    throw new BufferApiError(data.deletePost.message, 400);
  }
  return Boolean(data.deletePost?.postId);
}

export function isBufferConfigured() {
  return getApiKey().length > 0;
}
