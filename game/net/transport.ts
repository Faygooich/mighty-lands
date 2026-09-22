// The only thing a Room and a client know about the network: a bidirectional string channel.
// Implementations: loopback (the host plays in the tab that runs the room), PeerJS/WebRTC
// (web/src/net/peer.ts), WebSocket (web/src/net/ws.ts ↔ net/server.ts).

export interface Link {
  send(data: string): void;
  close(): void;
  onmessage: ((data: string) => void) | null;
  onclose: (() => void) | null;
}

/** A way for a client to reach a room by its code. */
export type Dial = (code: string) => Promise<Link>;

/** Two Links wired to each other, asynchronously like a real network. */
export function loopback(): [Link, Link] {
  let open = true;
  const mk = (): Link => ({ send: () => {}, close: () => {}, onmessage: null, onclose: null });
  const a = mk();
  const b = mk();
  const wire = (from: Link, to: Link) => {
    // messages sent before close() are still delivered, like a real channel flushing its buffer
    from.send = (s) => { if (open) queueMicrotask(() => to.onmessage?.(s)); };
    from.close = () => {
      if (!open) return;
      open = false;
      queueMicrotask(() => { a.onclose?.(); b.onclose?.(); });
    };
  };
  wire(a, b);
  wire(b, a);
  return [a, b];
}
