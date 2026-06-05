import { asBufferError } from '../integrations/buffer/errors';

export function toBufferErrorResponse(error: unknown) {
  const bufferError = asBufferError(error);
  return {
    ok: false as const,
    source: 'buffer' as const,
    errors: [bufferError.message],
    retryAfterSeconds: bufferError.retryAfterSeconds,
    status: bufferError.status
  };
}
