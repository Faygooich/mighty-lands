// Own room server: the same Room as in the host's browser, but in Node, with WebSocket clients.
// Also serves the built web version, so one process is a complete online МОЩНЫЕ ЗЕМЛИ:
//
//   VITE_ROOM_SERVER=same npm --prefix game/web run build   # once (see docs/multiplayer.md)
//   npm run server                                          # PORT=8080 by default
//
// HTTP:  POST /api/rooms {token} → {code}   ·   GET /api/health
// WS:    /ws/<CODE>                          (messages: net/protocol.ts)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadRules } from '../rules/load.ts';
import { Room } from './room.ts';
import { normCode, randomCode } from './protocol.ts';
import type { Link } from './transport.ts';

const RULES = loadRules('v029');
const DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));
/** A room with nobody in it is dropped after this long. */
const IDLE_MS = Number(process.env.ROOM_IDLE_MS ?? 30 * 60_000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 500);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon',
};

export interface RoomServer {
  port: number;
  rooms: Map<string, { room: Room; idleSince: number }>;
  close(): Promise<void>;
}

function wsLink(ws: WebSocket): Link {
  const link: Link = {
    send: (s) => { if (ws.readyState === ws.OPEN) ws.send(s); },
    close: () => ws.close(),
    onmessage: null,
    onclose: null,
  };
  ws.on('message', (d) => link.onmessage?.(d.toString()));
  ws.on('close', () => link.onclose?.());
  // a phone that fell asleep or lost the network: ping every 20 s, drop after a missed pong
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const beat = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, 20_000);
  ws.on('close', () => clearInterval(beat));
  return link;
}

export function startServer(port = Number(process.env.PORT ?? 8080)): Promise<RoomServer> {
  const rooms = new Map<string, { room: Room; idleSince: number }>();

  const newCode = (): string => {
    for (let i = 0; i < 1000; i++) { const c = randomCode(); if (!rooms.has(c)) return c; }
    throw new Error('no free room codes');
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, rooms: rooms.size, rules: RULES.version }));
      return;
    }
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 1000) break; }
      let token = '';
      try { token = String((JSON.parse(body) as { token?: string }).token ?? ''); } catch { /* bad json */ }
      if (!/^[0-9a-f]{16,64}$/.test(token) || rooms.size >= MAX_ROOMS) { res.writeHead(400).end(); return; }
      const code = newCode();
      rooms.set(code, { room: new Room({ code, rules: RULES, adminToken: token }), idleSince: Date.now() });
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ code }));
      return;
    }

    // static files of the web version (single page: unknown paths → index.html)
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(normalize(DIST))) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(DIST, 'index.html'); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Сборка не найдена: npm --prefix game/web run build');
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const m = /^\/ws\/([A-Za-z]+)$/.exec(new URL(req.url ?? '/', 'http://x').pathname);
    const entry = m ? rooms.get(normCode(m[1])) : undefined;
    // refuse before the upgrade, so the client sees «no such room» instead of a socket that opens and dies
    if (!entry) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, (ws) => entry.room.attach(wsLink(ws)));
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, e] of rooms) {
      if (e.room.online() > 0) e.idleSince = now;
      else if (now - e.idleSince > IDLE_MS) { e.room.close(); rooms.delete(code); }
    }
  }, 60_000);
  sweep.unref();

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        port: (server.address() as { port: number }).port,
        rooms,
        close: () => new Promise<void>((done) => {
          clearInterval(sweep);
          for (const e of rooms.values()) e.room.close('Сервер остановлен');
          rooms.clear();
          wss.close();
          server.close(() => done());
        }),
      });
    });
  });
}

// started directly (npm run server): listen and say where
if (import.meta.filename === process.argv[1]) {
  const s = await startServer();
  console.log(`МОЩНЫЕ ЗЕМЛИ: сервер комнат на http://localhost:${s.port} (правила ${RULES.version})`);
}
