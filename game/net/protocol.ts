// Network protocol of a МОЩНЫЕ ЗЕМЛИ room. Transport-neutral: the same JSON messages travel over
// WebRTC (PeerJS, the host's browser is the room) or a WebSocket (net/server.ts, a Node process is
// the room). The room is authoritative: it runs the engine, clients only send option indices.
import type { Decision, GameState } from '../core/types.ts';
import type { UiEvent } from '../web/src/controller.ts';

export const PROTOCOL = 1;
export const MAX_SEATS = 7;
export const MIN_SEATS = 2;
/** Letters that cannot be confused when read aloud or off a TV (no I/O/0/1-lookalikes). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export type Phase = 'lobby' | 'game';

export interface SeatInfo {
  name: string;
  /** 'human' or a bot type. A human seat whose player dropped out may be handed to a bot. */
  kind: string;
  /** Seat belongs to a person (they can return and take it back from a bot). */
  person: boolean;
  online: boolean;
  admin: boolean;
}

export interface RoomInfo {
  code: string;
  phase: Phase;
  rules: string;
  seats: SeatInfo[];
  spectators: string[];
  /** Pause between bot moves, ms (chosen by the admin). */
  botDelay: number;
}

/** A GameState with everything the viewer may not know removed (see net/view.ts). */
export type PublicState = Omit<GameState, 'rng' | 'hooks' | 'rules' | 'log'> & { rules: string };

export interface View {
  g: PublicState;
  /** The pending decision; options are empty unless it is the viewer's. */
  pending: Decision | null;
  /** Number of choices made so far: a choice is only accepted for this exact moment. */
  n: number;
  events: UiEvent[];
  seq: number;
  /** New log lines, starting at index logFrom. */
  logFrom: number;
  log: string[];
}

export type AdminOp =
  | { op: 'addBot'; kind: string }
  | { op: 'setKind'; seat: number; kind: string }
  | { op: 'remove'; seat: number }
  | { op: 'shuffle' }
  | { op: 'start'; seed?: number }
  | { op: 'botDelay'; ms: number }
  /** After the game: everybody back to the lobby, same seats. */
  | { op: 'lobby' };

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; token: string; spectate?: boolean }
  | { t: 'choose'; n: number; idx: number }
  /** Toggle own role in the lobby. */
  | { t: 'role'; spectate: boolean }
  | { t: 'rename'; name: string }
  | ({ t: 'admin' } & AdminOp)
  | { t: 'ping' };

export type HostMsg =
  | { t: 'welcome'; you: number; admin: boolean; room: RoomInfo }
  | { t: 'room'; you: number; admin: boolean; room: RoomInfo }
  | { t: 'state'; view: View; full: boolean }
  | { t: 'replay'; code: string }
  | { t: 'error'; msg: string; fatal?: boolean }
  | { t: 'pong' };

export function randomCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}

export function normCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);
}

export function randomToken(): string {
  const a = new Uint8Array(12);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 14) || 'Безымянный';
}
