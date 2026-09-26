import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyConnection } from '../../src/integrations/buffer/client';
import { persistVerifiedBufferApiKey } from '../../src/server/onboarding-service';

const maximumBodyBytes = 16 * 1024;

function page(csrf: string, message = '', done = false) {
  const feedback = message ? `<p class="message" role="status">${message}</p>` : '';
  const form = done ? '<p>Ya puedes volver al chat para elegir el canal de cada marca.</p>' : `
    <form method="post" action="/connect" autocomplete="off">
      <input type="hidden" name="csrf" value="${csrf}">
      <label for="apiKey">Clave personal de Buffer</label>
      <input id="apiKey" name="apiKey" type="password" required autofocus autocomplete="off" spellcheck="false">
      <button type="submit">Conectar Buffer</button>
    </form>
    <p class="hint">Crea la clave en <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer">Buffer → Ajustes → API</a>. Activa acceso de lectura a la cuenta y escritura de publicaciones.</p>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conectar Buffer · PoXter</title>
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f1e9;color:#2d2923;font:16px/1.5 system-ui,sans-serif}main{width:min(440px,calc(100% - 32px));padding:32px;border:1px solid #d9cdbb;border-radius:20px;background:#fffdfa;box-shadow:0 18px 48px #3027181a}h1{margin:0 0 8px;font-size:28px}p{margin:0 0 20px}label{display:block;margin:20px 0 8px;font-weight:600}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #a89b89;border-radius:9px;font:inherit}button{width:100%;margin-top:16px;padding:14px;border:0;border-radius:9px;background:#2d2923;color:white;font:inherit;font-weight:700;cursor:pointer}.hint{margin:22px 0 0;color:#62594e;font-size:14px}.message{padding:12px;border-radius:8px;background:#eee8da}a{color:#413b83}</style></head><body><main><h1>Conectar Buffer</h1><p>Introduce la clave aquí. No aparecerá en el chat ni en el repositorio.</p>${feedback}${form}</main></body></html>`;
}

function sendHtml(response: ServerResponse, status: number, html: string) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    connection: 'close'
  });
  response.end(html);
}

async function readForm(request: IncomingMessage) {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString('utf8');
    if (Buffer.byteLength(body) > maximumBodyBytes) throw new Error('request_too_large');
  }
  return new URLSearchParams(body);
}

export async function startBufferKeyEntry(verifyKey: (key: string) => Promise<unknown> = (key) => verifyConnection(key, AbortSignal.timeout(20000))) {
  const csrf = randomBytes(24).toString('hex');
  let successful = false;
  let busy = false;
  let finish!: () => void;
  const done = new Promise<void>((resolveDone) => { finish = resolveDone; });
  const server = createServer(async (request, response) => {
    const address = server.address();
    const origin = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
    if (request.method === 'GET' && request.url === '/') return sendHtml(response, 200, page(csrf));
    if (request.method !== 'POST' || request.url !== '/connect') return sendHtml(response, 404, page(csrf, 'Página no encontrada.'));
    if (request.headers.origin && request.headers.origin !== origin) return sendHtml(response, 403, page(csrf, 'Solicitud no válida.'));
    if (busy || successful) return sendHtml(response, 409, page(csrf, 'La conexión ya se está procesando.'));
    busy = true;
    try {
      const form = await readForm(request);
      if (form.get('csrf') !== csrf) return sendHtml(response, 403, page(csrf, 'Solicitud no válida.'));
      const apiKey = form.get('apiKey')?.trim() ?? '';
      if (!apiKey) return sendHtml(response, 400, page(csrf, 'Introduce una clave.'));
      await verifyKey(apiKey);
      await persistVerifiedBufferApiKey(apiKey);
      successful = true;
      sendHtml(response, 200, page(csrf, 'Conexión verificada y guardada.', true));
      server.close();
      finish();
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
      const message = status === 401 || status === 403 ? 'Buffer rechazó la clave o sus permisos.' : status === 429 ? 'Buffer alcanzó el límite de solicitudes. Inténtalo más tarde.' : 'No se pudo verificar la conexión. Revisa la clave y vuelve a intentarlo.';
      sendHtml(response, 400, page(csrf, message));
    } finally {
      busy = false;
    }
  });
  server.requestTimeout = 30000;
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('setup.listen_failed');
  return { url: `http://127.0.0.1:${address.port}/`, done, close: () => server.close() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void startBufferKeyEntry().then(async ({ url, done }) => {
    console.log(`Abre esta pantalla privada para conectar Buffer: ${url}`);
    await done;
    console.log('Buffer conectado. Vuelve al chat para elegir los canales.');
  }).catch(() => {
    console.error('No se pudo iniciar la pantalla local de Buffer.');
    process.exitCode = 1;
  });
}
