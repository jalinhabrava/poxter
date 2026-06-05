import { BufferApiError } from './errors';
import { CREATE_POST_MUTATION, DELETE_POST_MUTATION, LIST_CHANNELS_QUERY } from './graphql';
import { logBufferRequest } from './request-log';

type BufferGraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

function getApiKey() {
  return process.env.BUFFER_API_KEY?.trim() ?? '';
}

async function callBuffer<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new BufferApiError('buffer.api_key_missing', 400);
  const response = await fetch('https://api.bufferapp.com/graphql', {
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
  const data = await callBuffer<{ channels: Array<{ id: string; name?: string | null }> }>(LIST_CHANNELS_QUERY);
  return data.channels ?? [];
}

export async function createPost(input: { channelId: string; text: string; scheduledAt: string }) {
  logBufferRequest('createPost');
  const data = await callBuffer<{ createPost?: { post?: { id?: string | null; status?: string | null; scheduledAt?: string | null } | null } }>(CREATE_POST_MUTATION, { input });
  return data.createPost?.post ?? null;
}

export async function deletePost(id: string) {
  logBufferRequest('deletePost');
  const data = await callBuffer<{ deletePost?: { success?: boolean | null } | null }>(DELETE_POST_MUTATION, { id });
  return data.deletePost?.success === true;
}

export function isBufferConfigured() {
  return getApiKey().length > 0;
}
