export class BufferApiError extends Error {
  status: number;
  source = 'buffer';
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'BufferApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function asBufferError(error: unknown) {
  if (error instanceof BufferApiError) return error;
  return new BufferApiError(error instanceof Error ? error.message : 'buffer_error', 500);
}
