import { useState } from 'react';
import { Controller, type SeatSetup } from './controller.ts';
import { RULES } from './rules.ts';
import { GameView } from './GameView.tsx';
import { SimulationView } from './SimulationView.tsx';
import { RulesText } from './RulesText.tsx';
import { COLORS } from './labels.ts';
import { Art } from './art/index.tsx';
import { Icon } from './ui/Icon.tsx';
import { PawnBadge } from './PlayerMat.tsx';
import { OnlineMenu } from './net/OnlineMenu.tsx';
import { NetTable } from './net/NetGame.tsx';
import type { Session } from './net/session.ts';
import { normCode } from '../../net/protocol.ts';

const BOT_KINDS: Array<[string, string, string]> = [
  ['tactical', 'Бородатый Стратег', 'считает выгоду, поглаживая бороду'], ['aggressive', 'Берсерк', 'бьёт первым, думает никогда'], ['defensive', 'Щитоносец', 'бережёт жетоны, как последнюю рубаху'],
  ['economic', 'Скопидом', 'копит МОЩЬ, как хомяк протеин'], ['survival', 'Выживальщик', 'не рискует: мама просила вернуться'], ['random', 'Пьяный Бард', 'делает что попало, зато с песней'],
];
const NAMES = ['Громобой', 'Валькирия', 'Бородарь', 'Кувалда', 'Ярополк', 'Броня', 'Хрящ'];

type Screen =
  | { s: 'menu' }
  | { s: 'setup'; mode: 'local' | 'bots' }
  | { s: 'game'; ctl: Controller }
  | { s: 'online'; code?: string }
  | { s: 'net'; session: Session }
  | { s: 'sim' }
  | { s: 'rules' };

/** ?watch=N — demo: N bots play automatically (handy for showing the game or a screenshot).
 *  ?room=ABCD — an invitation link: straight to the join screen with the code filled in. */
function initialScreen(): Screen {
  const q = new URLSearchParams(location.search);
  const room = normCode(q.get('room') ?? '');
  if (room.length === 4) return { s: 'online', code: room };
  const n = Number(q.get('watch'));
  if (n >= 2 && n <= 7) {
    const kinds = ['tactical', 'aggressive', 'economic', 'defensive', 'survival', 'tactical', 'aggressive'];
    return { s: 'game', ctl: new Controller(NAMES.slice(0, n).map((name, i) => ({ name, kind: kinds[i] })), 42, RULES) };
  }
  return { s: 'menu' };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [loadOpen, setLoadOpen] = useState(false);
  if (screen.s === 'game') return <GameView ctl={screen.ctl} onExit={() => setScreen({ s: 'menu' })} />;
  if (screen.s === 'net') return <NetTable session={screen.session} onLeave={() => setScreen({ s: 'menu' })} />;
  if (screen.s === 'online') return <OnlineMenu initialCode={screen.code} onBack={() => setScreen({ s: 'menu' })} onSession={(session) => setScreen({ s: 'net', session })} />;
  if (screen.s === 'sim') return <SimulationView onExit={() => setScreen({ s: 'menu' })} />;
  if (screen.s === 'setup') return <Setup mode={screen.mode} onBack={() => setScreen({ s: 'menu' })} onStart={(ctl) => setScreen({ s: 'game', ctl })} />;
  if (screen.s === 'rules') {
    return (
      <div className="screen">
        <div className="screen-inner narrow">
          <button type="button" className="plaque ghost back" onClick={() => setScreen({ s: 'menu' })}><span className="plaque-main"><Icon name="back" /> Назад</span></button>
          <div className="parchment">
            <h2 className="screen-title">Кодекс МОЩИ вкратце</h2>
            <RulesText />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="screen title-screen">
      <div className="title-fan" aria-hidden>
        {[['Луг Слабаков', 0], ['Дуб Мотивации', 1], ['Пик Грома', 2], ['Око Бездны', 3]].map(([name, region], i) => (
          <div key={i} className="fan-card" style={{ ['--i' as string]: i, ['--dy' as string]: `${Math.abs(i - 1.5) * 12}px` }}><Art of={{ kind: 'land', name: name as string, region: region as number }} /></div>
        ))}
      </div>
      <h1 className="logo">МОЩНЫЕ<br />ЗЕМЛИ</h1>
      <p className="tagline">Стань МОЩНЕЕ. Забери Земли. Не заплачь.</p>
      <nav className="title-menu">
        <button type="button" className="plaque primary big" onClick={() => setScreen({ s: 'setup', mode: 'bots' })}>
          <span className="plaque-main"><Icon name="bot" size={20} /> Игра против ботов</span>
          <span className="plaque-sub">вы и 1–6 соперников с тяжёлым характером</span>
        </button>
        <button type="button" className="plaque primary big" onClick={() => setScreen({ s: 'online' })}>
          <span className="plaque-main"><Icon name="users" size={20} /> Игра по сети</span>
          <span className="plaque-sub">комната с кодом: у каждого своё устройство и своя рука</span>
        </button>
        <button type="button" className="plaque secondary big" onClick={() => setScreen({ s: 'setup', mode: 'local' })}>
          <span className="plaque-main"><Icon name="hand" size={20} /> За одним экраном</span>
          <span className="plaque-sub">2–7 героев передают устройство по кругу</span>
        </button>
        <div className="title-row">
          <button type="button" className="plaque ghost" onClick={() => setScreen({ s: 'rules' })}><span className="plaque-main"><Icon name="book" /> Правила</span></button>
          <button type="button" className="plaque ghost" onClick={() => setLoadOpen(true)}><span className="plaque-main"><Icon name="upload" /> Загрузить партию</span></button>
          <button type="button" className="plaque ghost" onClick={() => setScreen({ s: 'sim' })}><span className="plaque-main"><Icon name="chart" /> Симуляция</span></button>
        </div>
      </nav>
      <p className="version">Правила {RULES.version} · тот же движок, что и в симуляторе (≈ 11 млн тестовых партий, ни одна не заплакала)</p>
      {loadOpen && <LoadGame onClose={() => setLoadOpen(false)} onLoad={(ctl) => setScreen({ s: 'game', ctl })} />}
    </div>
  );
}

function LoadGame({ onClose, onLoad }: { onClose: () => void; onLoad: (c: Controller) => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const load = () => {
    try { onLoad(Controller.fromCode(code.trim(), RULES)); } catch { setErr('Код не распознан. Скопируйте его целиком из меню партии.'); }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Загрузить партию">
        <div className="sheet-title">Загрузить партию <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button></div>
        <p className="muted">Вставьте код из меню партии («Код партии»). Партия восстановится ход в ход.</p>
        <textarea className="code-input" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} rows={5} placeholder='{"rules":"v029","seed":…}' autoFocus />
        {err && <div className="warn">{err}</div>}
        <div className="sheet-actions">
          <button type="button" className="plaque primary" disabled={!code.trim()} onClick={load}><span className="plaque-main"><Icon name="play" /> Продолжить партию</span></button>
        </div>
      </div>
    </div>
  );
}

function Setup({ mode, onBack, onStart }: { mode: 'local' | 'bots'; onBack: () => void; onStart: (c: Controller) => void }) {
  const [n, setN] = useState(4);
  const [seats, setSeats] = useState<SeatSetup[]>(NAMES.map((name, i) => ({ name, kind: mode === 'local' ? 'human' : i === 0 ? 'human' : 'tactical' })));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const set = (i: number, patch: Partial<SeatSetup>) => setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const bonus = RULES.seatBonusCards ?? [];
  const goal = RULES.win.landsTargetBy?.[String(n)] ?? RULES.win.landsTarget;
  return (
    <div className="screen">
      <div className="screen-inner">
        <button type="button" className="plaque ghost back" onClick={onBack}><span className="plaque-main"><Icon name="back" /> Назад</span></button>
        <h2 className="screen-title on-felt">{mode === 'local' ? 'За одним экраном' : 'Игра против ботов'}</h2>
        <div className="setup-count">
          <span>Игроков за столом</span>
          <div className="seg" role="radiogroup" aria-label="Число игроков">
            {[2, 3, 4, 5, 6, 7].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={n === k} className={n === k ? 'on' : ''} onClick={() => setN(k)}>{k}</button>
            ))}
          </div>
          <span className="goal-chip"><Icon name="flag" size={15} /> Цель: {goal} Земель</span>
        </div>
        <div className="seats">
          {seats.slice(0, n).map((s, i) => (
            <div key={i} className={`seat ${s.kind === 'human' ? 'human' : 'bot'}`} style={{ ['--pc' as string]: COLORS[i] }}>
              <PawnBadge id={i} size={28} />
              <div className="seat-main">
                <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Имя игрока ${i + 1}`} maxLength={14} />
                <select value={s.kind} onChange={(e) => set(i, { kind: e.target.value })} aria-label={`Кто играет за место ${i + 1}`}>
                  <option value="human">Человек (герой)</option>
                  {BOT_KINDS.map(([k, label, hint]) => <option key={k} value={k}>Бот: {label} — {hint}</option>)}
                </select>
              </div>
              <div className="seat-meta">
                <span>{i === 0 ? 'ходит первым' : `${i + 1}-й ход`}</span>
                {(bonus[i] ?? 0) > 0 && <span className="bonus">+{bonus[i]} {(bonus[i] ?? 0) > 1 ? 'Заклятия' : 'Заклятие'} на старте</span>}
              </div>
            </div>
          ))}
        </div>
        <details className="advanced">
          <summary>Дополнительно</summary>
          <label className="field">Seed (одинаковый seed — одинаковая раздача)
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
        </details>
        <button type="button" className="plaque primary big start" onClick={() => onStart(new Controller(seats.slice(0, n), seed, RULES))}>
          <span className="plaque-main"><Icon name="play" size={20} /> Сесть за стол и нахмуриться</span>
        </button>
      </div>
    </div>
  );
}
