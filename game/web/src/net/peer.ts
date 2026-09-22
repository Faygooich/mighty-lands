// P2P transport: WebRTC data channels through PeerJS. The public PeerJS cloud is only the
// "phone book" (signalling) and a TURN relay for strict NATs; game traffic goes host ↔ guest.
// The host's peer id is derived from the room code, so a guest needs nothing but the code.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { Dial, Link } from '../../../net/transport.ts';

const PREFIX = 'moshchnye-zemli-103-';
export const peerId = (code: string) => PREFIX + code;

/** Optional own signalling server: VITE_PEER_HOST=peer.example.com (see docs/multiplayer.md). */
function options(): PeerOptions {
  const env = import.meta.env;
  const o: PeerOptions = { debug: 1 };
  if (env.VITE_PEER_HOST) {
    o.host = env.VITE_PEER_HOST;
    o.port = Number(env.VITE_PEER_PORT ?? 443);
    o.path = env.VITE_PEER_PATH ?? '/';
    o.secure = (env.VITE_PEER_SECURE ?? 'true') !== 'false';
  }
  return o;
}

function wrap(conn: DataConnection, onGone?: () => void): Link {
  let closed = false;
  const link: Link = {
    send: (s) => { if (!closed && conn.open) conn.send(s); },
    close: () => { if (!closed) { conn.close(); fire(); } },
    onmessage: null,
    onclose: null,
  };
  const fire = () => { if (closed) return; closed = true; link.onclose?.(); onGone?.(); };
  conn.on('data', (d) => { if (!closed) link.onmessage?.(typeof d === 'string' ? d : String(d)); });
  conn.on('close', fire);
  conn.on('error', fire);
  // a data channel whose ICE dies can linger without a 'close' — watch the peer connection too
  conn.peerConnection?.addEventListener('iceconnectionstatechange', () => {
    const st = conn.peerConnection?.iceConnectionState;
    if (st === 'failed' || st === 'closed') fire();
  });
  return link;
}

export interface PeerHost {
  close(): void;
}

/** Claim the room code on the signalling server and hand every guest's channel to onLink. */
export function listenPeer(code: string, onLink: (l: Link) => void, onStatus?: (online: boolean) => void): Promise<PeerHost> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId(code), options());
    let ready = false;
    peer.on('open', () => {
      ready = true;
      onStatus?.(true);
      resolve({ close: () => peer.destroy() });
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => onLink(wrap(conn)));
    });
    // Lost the signalling server: the games already running keep running (WebRTC is direct), but
    // nobody new can join until the code is claimed again — so keep trying, not just once.
    peer.on('disconnected', () => {
      onStatus?.(false);
      const again = () => {
        if (peer.destroyed || !peer.disconnected) return;
        try { peer.reconnect(); } catch { /* still down */ }
        setTimeout(again, 3000);
      };
      setTimeout(again, 1000);
    });
    peer.on('close', () => onStatus?.(false));
    peer.on('error', (err) => {
      if (!ready) {
        peer.destroy();
        reject(Object.assign(new Error(err.type === 'unavailable-id' ? 'Код занят' : `Сеть: ${err.type}`), { type: err.type }));
      }
    });
  });
}

/** Connect to a room by its code. */
export const dialPeer: Dial = (code) => new Promise<Link>((resolve, reject) => {
  const peer = new Peer(options());
  let done = false;
  const fail = (msg: string) => { if (done) return; done = true; clearTimeout(timer); peer.destroy(); reject(new Error(msg)); };
  const timer = setTimeout(() => fail('Хозяин комнаты не отвечает'), 10000);
  peer.on('error', (err) => fail(err.type === 'peer-unavailable' ? `Комнаты ${code} нет. Проверьте код — или хозяин закрыл вкладку.` : `Сеть: ${err.type}`));
  // the signalling socket is only needed to set the call up, but keep it alive for renegotiation
  peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1500); });
  peer.on('open', () => {
    const conn = peer.connect(peerId(code), { reliable: true, serialization: 'raw' });
    conn.on('open', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(wrap(conn, () => peer.destroy()));
    });
    conn.on('error', () => fail('Не удалось установить соединение'));
  });
});
