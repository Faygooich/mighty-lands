// Server transport: the room lives in a Node process (game/net/server.ts), everybody — the host
// included — is an ordinary client over a WebSocket. Chosen with VITE_ROOM_SERVER or ?server=URL.
import type { Dial, Link } from '../../../net/transport.ts';

/** '' (same origin as the page) or an http(s) base URL. */
export function wsDial(base: string): Dial {
  const http = base || location.origin;
  const url = http.replace(/^http/, 'ws').replace(/\/$/, '');
  return (code) => new Promise<Link>((resolve, reject) => {
    const ws = new WebSocket(`${url}/ws/${code}`);
    let open = false;
    const link: Link = {
      send: (s) => { if (ws.readyState === WebSocket.OPEN) ws.send(s); },
      close: () => ws.close(),
      onmessage: null,
      onclose: null,
    };
    ws.onopen = () => { open = true; resolve(link); };
    ws.onmessage = (e) => link.onmessage?.(String(e.data));
    // closed before it ever opened: no such room, or the server is down — NetClient words it
    ws.onclose = () => { if (open) link.onclose?.(); else reject(new Error('')); };
    ws.onerror = () => { if (!open) reject(new Error('')); };
  });
}

export async function createServerRoom(base: string, adminToken: string): Promise<string> {
  const r = await fetch(`${(base || location.origin).replace(/\/$/, '')}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: adminToken }),
  });
  if (!r.ok) throw new Error('Сервер комнат не создал комнату');
  return ((await r.json()) as { code: string }).code;
}
