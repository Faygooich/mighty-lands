// The networked table: one NetClient drives the lobby and then the very same GameView the local
// game uses. Everything the UI needs to know about the room travels in NetInfo.
import { useEffect, useReducer, useState } from 'react';
import type { Status } from '../../../net/client.ts';
import type { AdminOp, RoomInfo } from '../../../net/protocol.ts';
import type { Session } from './session.ts';
import { GameView } from '../GameView.tsx';
import { Lobby } from './Lobby.tsx';
import { Icon } from '../ui/Icon.tsx';

export interface NetInfo {
  you: number;
  admin: boolean;
  status: Status;
  error: string | null;
  room: RoomInfo;
  op: (op: AdminOp) => void;
}

export function NetTable({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const c = session.client;
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => c.subscribe(bump), [c]);

  const leave = () => { session.leave(); onLeave(); };

  if (c.error && c.status === 'closed') {
    return (
      <div className="screen">
        <div className="screen-inner narrow">
          <div className="parchment">
            <h2 className="screen-title">Связь оборвалась</h2>
            <p>{c.error}</p>
            <button type="button" className="plaque primary" onClick={leave}><span className="plaque-main"><Icon name="back" /> В главное меню</span></button>
          </div>
        </div>
      </div>
    );
  }

  if (!c.room || c.room.phase === 'lobby' || !c.game) {
    return <Lobby session={session} onLeave={leave} />;
  }

  const net: NetInfo = { you: c.you, admin: c.admin, status: c.status, error: c.error, room: c.room, op: (op) => c.adminOp(op) };
  return (
    <>
      <GameView key={`${c.room.code}-${c.g.seed}`} ctl={c} net={net} onExit={() => setConfirmLeave(true)} />
      {confirmLeave && (
        <div className="sheet-backdrop" onClick={() => setConfirmLeave(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Выйти">
            <div className="sheet-title">{c.admin && session.room ? 'Закрыть комнату?' : 'Выйти из комнаты?'}</div>
            <p className="muted">
              {c.admin && session.room
                ? 'Комната живёт в этой вкладке: партия закончится для всех.'
                : 'Ваше место останется за вами — вернётесь по тому же коду и продолжите. Партия будет ждать.'}
            </p>
            <div className="sheet-actions">
              <button type="button" className="plaque danger" onClick={leave}><span className="plaque-main"><Icon name="back" /> {c.admin && session.room ? 'Закрыть комнату' : 'Выйти'}</span></button>
              <button type="button" className="plaque secondary" onClick={() => setConfirmLeave(false)}><span className="plaque-main">Остаться</span></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
