const requestLog: Array<{ action: string; at: string }> = [];

export function logBufferRequest(action: string) {
  requestLog.push({ action, at: new Date().toISOString() });
}

export function readBufferRequestLog() {
  return [...requestLog];
}

export function resetBufferRequestLog() {
  requestLog.length = 0;
}
