// The lobby: a big room code to read out loud, who is sitting where, bots for the empty seats,
// and — for the host — the button that starts the game.
import { useEffect, useReducer, useState } from 'react';
import { MIN_SEATS, MAX_SEATS } from '../../../net/protocol.ts';
import { BOT_KINDS } from '../../../net/room.ts';
import { joinUrl, rememberName, type Session } from './session.ts';
import { RULES } from '../rules.ts';
import { COLORS } from '../labels.ts';
import { PawnBadge } from '../PlayerMat.tsx';
import { Icon } from '../ui/Icon.tsx';

const BOT_NAMES: Record<string, string> = {
  tactical: 'Бородатый Стратег', aggressive: 'Берсерк', defensive: 'Щитоносец',
  economic: 'Скопидом', survival: 'Выживальщик', random: 'Пьяный Бард',
};

export function Lobby({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const c = session.client;
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [botKind, setBotKind] = useState('tactical');
  const [name, setName] = useState(() => (c.you >= 0 ? c.room?.seats[c.you]?.name : '') ?? '');
  useEffect(() => c.subscribe(bump), [c]);
  // the host's own status (is the code still claimed?) changes outside React — look at it now and then
  useEffect(() => { if (!session.room) return; const t = setInterval(bump, 3000); return () => clearInterval(t); }, [session.room]);

  const room = c.room;
  const seats = room?.seats ?? [];
  const seated = c.you >= 0;
  const goal = RULES.win.landsTargetBy?.[String(Math.max(seats.length, 2))] ?? RULES.win.landsTarget;
  const copy = (what: 'code' | 'link') => {
    navigator.clipboard?.writeText(what === 'code' ? c.code : joinUrl(c.code));
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="screen">
      <div className="screen-inner">
        <button type="button" className="plaque ghost back" onClick={onLeave}>
          <span className="plaque-main"><Icon name="back" /> {c.admin && session.room ? 'Закрыть комнату' : 'Выйти'}</span>
        </button>

        <h2 className="screen-title on-felt">Комната собирается</h2>

        <div className="room-code">
          <div className="rc-label">Код комнаты — назовите его друзьям</div>
          <div className="rc-code" aria-label={`Код комнаты ${c.code.split('').join(' ')}`}>{c.code}</div>
          <div className="rc-actions">
            <button type="button" className="plaque secondary" onClick={() => copy('code')}><span className="plaque-main"><Icon name="copy" /> {copied === 'code' ? 'Скопировано' : 'Копировать код'}</span></button>
            <button type="button" className="plaque secondary" onClick={() => copy('link')}><span className="plaque-main"><Icon name="upload" /> {copied === 'link' ? 'Скопировано' : 'Копировать ссылку'}</span></button>
          </div>
          <p className="muted small">Заходить — на этом же сайте: «Игра по сети» → «Войти по коду». Или просто по ссылке.</p>
        </div>

        <div className={`net-state ${c.status}`}>
          {c.status === 'online'
            ? <><Icon name="check" size={15} /> На связи{c.admin && ' · вы хозяин комнаты'}</>
            : <><span className="spinner" aria-hidden /> {c.status === 'connecting' ? 'Подключаемся…' : 'Связь потеряна — восстанавливаем…'}</>}
          {c.error && <b> {c.error}</b>}
        </div>
        {session.room && (
          session.signalling?.ok === false
            ? <div className="warn"><Icon name="skull" size={16} /> Нет связи с сервером кодов: те, кто уже в комнате, играют дальше, но новые войти не смогут. Пробуем восстановить…</div>
            : <p className="muted small">Комната живёт в этой вкладке: не закрывайте её и не давайте устройству уснуть, пока идёт партия.</p>
        )}

        <div className="setup-count">
          <span>За столом: {seats.length} из {MAX_SEATS}</span>
          <span className="goal-chip"><Icon name="flag" size={15} /> Цель: {goal} Земель</span>
        </div>

        <div className="seats">
          {seats.map((s, i) => (
            <div key={i} className={`seat ${s.kind === 'human' ? 'human' : 'bot'} ${s.person && !s.online ? 'offline' : ''}`} style={{ ['--pc' as string]: COLORS[i] }}>
              <PawnBadge id={i} size={28} />
              <div className="seat-main">
                <div className="seat-name">{s.name}{i === c.you && ' — это вы'}</div>
                <div className="muted small">
                  {!s.person ? <>Бот: {BOT_NAMES[s.kind] ?? s.kind}</>
                    : s.online ? <>Человек{s.admin ? ' · хозяин комнаты' : ''}</>
                    : 'Человек · нет связи'}
                </div>
              </div>
              <div className="seat-meta">
                <span>{i === 0 ? 'ходит первым' : `${i + 1}-й ход`}</span>
                {c.admin && (
                  <div className="seat-admin">
                    {!s.person && (
                      <select value={s.kind} onChange={(e) => c.adminOp({ op: 'setKind', seat: i, kind: e.target.value })} aria-label={`Бот на месте ${i + 1}`}>
                        {BOT_KINDS.map((k) => <option key={k} value={k}>{BOT_NAMES[k] ?? k}</option>)}
                      </select>
                    )}
                    {!s.admin && <button type="button" className="plaque ghost tiny" onClick={() => c.adminOp({ op: 'remove', seat: i })}>Убрать</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {seats.length === 0 && <p className="muted">Пока никто не сел за стол.</p>}
        </div>

        {room && room.spectators.length > 0 && (
          <p className="muted"><Icon name="eye" size={14} /> Смотрят: {room.spectators.join(', ')}</p>
        )}

        <label className="field lobby-name">Ваше имя
          <input
            value={name} maxLength={14} onChange={(e) => setName(e.target.value)}
            onBlur={() => { const n = name.trim(); if (n) { c.rename(n); rememberName(n); } }}
          />
        </label>

        <div className="lobby-actions">
          <button type="button" className="plaque secondary" onClick={() => c.setRole(seated)}>
            <span className="plaque-main"><Icon name={seated ? 'eye' : 'users'} /> {seated ? 'Только смотреть' : 'Сесть за стол'}</span>
          </button>
          {c.admin && (
            <>
              <span className="lobby-bot">
                <select value={botKind} onChange={(e) => setBotKind(e.target.value)} aria-label="Какого бота добавить">
                  {BOT_KINDS.map((k) => <option key={k} value={k}>{BOT_NAMES[k] ?? k}</option>)}
                </select>
                <button type="button" className="plaque secondary" disabled={seats.length >= MAX_SEATS} onClick={() => c.adminOp({ op: 'addBot', kind: botKind })}>
                  <span className="plaque-main"><Icon name="bot" /> Посадить бота</span>
                </button>
              </span>
              <button type="button" className="plaque ghost" disabled={seats.length < 2} onClick={() => c.adminOp({ op: 'shuffle' })}>
                <span className="plaque-main"><Icon name="swap" /> Перемешать места</span>
              </button>
            </>
          )}
        </div>

        {c.admin ? (
          <button type="button" className="plaque primary big start" disabled={seats.length < MIN_SEATS || c.status !== 'online'} onClick={() => c.adminOp({ op: 'start' })}>
            <span className="plaque-main"><Icon name="play" size={20} /> {seats.length < MIN_SEATS ? 'Нужно хотя бы двое' : 'Начать партию'}</span>
          </button>
        ) : (
          <div className="lobby-wait"><span className="spinner" aria-hidden /> Ждём, пока хозяин начнёт партию…</div>
        )}
        <p className="version">Правила {RULES.version} · играем тем же движком, что и офлайн</p>
      </div>
    </div>
  );
}
