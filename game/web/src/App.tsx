import { useState } from 'react';
import { Controller, type SeatSetup } from './controller.ts';
import { RULES } from './rules.ts';
import { GameView } from './GameView.tsx';
import { SimulationView } from './SimulationView.tsx';
import { COLORS } from './labels.ts';

const BOT_KINDS: Array<[string, string]> = [
  ['tactical', 'Тактик'], ['aggressive', 'Агрессор'], ['defensive', 'Защитник'], ['economic', 'Экономист'], ['survival', 'Выживальщик'], ['random', 'Случайный'],
];
const NAMES = ['Аня', 'Борис', 'Вика', 'Гоша', 'Даша', 'Егор', 'Женя'];

type Screen = { s: 'menu' } | { s: 'setup'; mode: 'local' | 'bots' } | { s: 'game'; ctl: Controller } | { s: 'sim' } | { s: 'rules' };

/** ?watch=N — demo: N bots play automatically (handy for showing the game or a screenshot). */
function initialScreen(): Screen {
  const n = Number(new URLSearchParams(location.search).get('watch'));
  if (n >= 2 && n <= 7) {
    const kinds = ['tactical', 'aggressive', 'economic', 'defensive', 'survival', 'tactical', 'aggressive'];
    return { s: 'game', ctl: new Controller(NAMES.slice(0, n).map((name, i) => ({ name, kind: kinds[i] })), 42, RULES) };
  }
  return { s: 'menu' };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  if (screen.s === 'game') return <GameView ctl={screen.ctl} onExit={() => setScreen({ s: 'menu' })} />;
  if (screen.s === 'sim') return <SimulationView onExit={() => setScreen({ s: 'menu' })} />;
  if (screen.s === 'setup') return <Setup mode={screen.mode} onBack={() => setScreen({ s: 'menu' })} onStart={(ctl) => setScreen({ s: 'game', ctl })} />;
  if (screen.s === 'rules') return <RulesView onBack={() => setScreen({ s: 'menu' })} />;
  return (
    <div className="menu">
      <h1>МОЩНЫЕ ЗЕМЛИ</h1>
      <p className="tagline">Стань МОЩНЕЕ. Забери Земли. Не дай соседу победить.</p>
      <div className="menu-buttons">
        <button onClick={() => setScreen({ s: 'setup', mode: 'bots' })}>🤖 Игра против ботов</button>
        <button onClick={() => setScreen({ s: 'setup', mode: 'local' })}>👥 Локальная игра (за одним экраном)</button>
        <button onClick={() => setScreen({ s: 'sim' })}>📊 Режим симуляции</button>
        <button onClick={() => setScreen({ s: 'rules' })}>📖 Краткие правила</button>
        <button onClick={() => { const code = prompt('Вставьте код партии'); if (code) { try { setScreen({ s: 'game', ctl: Controller.fromCode(code, RULES) }); } catch { alert('Неверный код'); } } }}>⤵ Загрузить партию по коду</button>
      </div>
      <p className="version">Правила {RULES.version} · тот же движок, что и в симуляторе (≈ 2,9 млн тестовых партий)</p>
    </div>
  );
}

function Setup({ mode, onBack, onStart }: { mode: 'local' | 'bots'; onBack: () => void; onStart: (c: Controller) => void }) {
  const [n, setN] = useState(4);
  const [seats, setSeats] = useState<SeatSetup[]>(NAMES.map((name, i) => ({ name, kind: mode === 'local' ? 'human' : i === 0 ? 'human' : 'tactical' })));
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const set = (i: number, patch: Partial<SeatSetup>) => setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="setup">
      <button onClick={onBack}>← Назад</button>
      <h2>{mode === 'local' ? 'Локальная игра' : 'Игра против ботов'}</h2>
      <label>Игроков: <select value={n} onChange={(e) => setN(Number(e.target.value))}>{[2, 3, 4, 5, 6, 7].map((k) => <option key={k}>{k}</option>)}</select></label>
      <div className="seats">
        {seats.slice(0, n).map((s, i) => (
          <div key={i} className="seat" style={{ borderColor: COLORS[i] }}>
            <span className="seat-no" style={{ background: COLORS[i] }}>{i + 1}</span>
            <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
            <select value={s.kind} onChange={(e) => set(i, { kind: e.target.value })}>
              <option value="human">Человек</option>
              {BOT_KINDS.map(([k, label]) => <option key={k} value={k}>Бот: {label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <p className="note">Первый игрок ходит первым. Места 2–7 получают стартовые Заклятия: 0/1/1/2/2/3/3. Цель: {RULES.win.landsTargetBy?.[String(n)] ?? RULES.win.landsTarget} Земель.</p>
      <label>Seed: <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></label>
      <button className="primary" onClick={() => onStart(new Controller(seats.slice(0, n), seed, RULES))}>Начать партию</button>
    </div>
  );
}

function RulesView({ onBack }: { onBack: () => void }) {
  return (
    <div className="rules">
      <button onClick={onBack}>← Назад</button>
      <h2>Коротко о правилах</h2>
      <ol>
        <li><b>Жетоны Мощи</b>: сумма чисел — ваша МОЩЬ, число жетонов — жизни (не больше 5).</li>
        <li>Ход: возьми 1 Артефакт + 1 Заклятие → действия → брось кубик → клетка → действия → на руке ≤ 3 карт.</li>
        <li>Прошёл Врата — +100 (если есть свободная ячейка).</li>
        <li><b>Монстр</b>: соперники могут сыграть Подмогу (+500 тебе) или Помеху (+500 монстру). Сильнее — захвати Землю и возьми награду. Не сильнее — беги (5–6) или дерись (6). Неудача — −1 жетон.</li>
        <li><b>Артефакт</b> на чужой Земле срабатывает всегда: Дань (отдай жетон), Капкан (потеряй жетон), Оковы (пропусти ход).</li>
        <li>Не больше 1 Заклятия за свой ход. Подмога и Помеха — только в чужой бой.</li>
        <li>Потерял последний жетон — сбрось Земли и карты, возьми 300, начни с Врат.</li>
        <li><b>Победа</b>: 9/8/7/6/6/6 Земель на 2/3/4/5/6/7 игроков.</li>
      </ol>
      <p>Полные правила — <code>docs/final_rules.md</code>.</p>
    </div>
  );
}
