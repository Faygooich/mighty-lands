import { useRef, useState } from 'react';
import { runOne } from '../../simulation/runner.ts';
import { RULES } from './rules.ts';
import { Icon } from './ui/Icon.tsx';
import { BOT_NAMES } from './labels.ts';

const POOL = ['tactical', 'aggressive', 'defensive', 'economic', 'survival', 'random'];

interface Stats { games: number; wins: Record<string, number>; apps: Record<string, number>; rounds: number[]; seat: number[]; mins: number; landsTaken: number; reactions: number }

/** Simulation mode: fully automatic games in the browser (same engine as the CLI simulator). */
export function SimulationView({ onExit }: { onExit: () => void }) {
  const [n, setN] = useState(4);
  const [count, setCount] = useState(300);
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const run = () => {
    stop.current = false;
    setRunning(true);
    const st: Stats = { games: 0, wins: {}, apps: {}, rounds: [], seat: Array(n).fill(0), mins: 0, landsTaken: 0, reactions: 0 };
    let seed = Math.floor(Math.random() * 1e8);
    const chunk = () => {
      for (let k = 0; k < 20 && st.games < count; k++) {
        const lineup = Array.from({ length: n }, (_, i) => POOL[(seed + i * 7) % POOL.length]);
        const { rec } = runOne(RULES, lineup, seed++);
        st.games++;
        st.rounds.push(rec.rounds);
        st.mins += rec.tableSec / 60;
        st.landsTaken += rec.feel.landsTaken;
        st.reactions += rec.feel.reactions;
        rec.bots.forEach((b, i) => { st.apps[b] = (st.apps[b] ?? 0) + 1; if (rec.winner === i) st.wins[b] = (st.wins[b] ?? 0) + 1; });
        if (rec.winner >= 0) st.seat[rec.winner]++;
      }
      setStats({ ...st });
      if (st.games < count && !stop.current) setTimeout(chunk, 0);
      else setRunning(false);
    };
    chunk();
  };

  const sorted = stats ? [...stats.rounds].sort((a, b) => a - b) : [];
  return (
    <div className="screen">
      <div className="screen-inner">
      <button type="button" className="plaque ghost back" onClick={onExit}><span className="plaque-main"><Icon name="back" /> Меню</span></button>
      <div className="parchment simview">
      <h2 className="screen-title">Режим симуляции</h2>
      <p>Полностью автоматические партии ботов на движке правил {RULES.version}. Для массовых прогонов используйте CLI: <code>npm run sim</code>.</p>
      <div className="sim-controls">
      <label className="field">Игроков <select value={n} onChange={(e) => setN(Number(e.target.value))}>{[2, 3, 4, 5, 6, 7].map((k) => <option key={k}>{k}</option>)}</select></label>
      <label className="field">Партий <input type="number" value={count} min={10} max={5000} onChange={(e) => setCount(Number(e.target.value))} /></label>
      {running
        ? <button type="button" className="plaque secondary" onClick={() => { stop.current = true; }}><span className="plaque-main">Стоп</span></button>
        : <button type="button" className="plaque primary" onClick={run}><span className="plaque-main"><Icon name="play" /> Запустить</span></button>}
      </div>
      {stats && (
        <div className="simstats">
          <p>Сыграно: <b>{stats.games}</b> · медиана раундов <b>{sorted[Math.floor(sorted.length / 2)]}</b> · оценка времени за столом <b>{(stats.mins / stats.games).toFixed(0)} мин</b> · Земель отнято за партию {(stats.landsTaken / stats.games).toFixed(1)} · карт в чужой ход {(stats.reactions / stats.games).toFixed(1)}</p>
          <table>
            <thead><tr><th>Бот</th><th>Партий</th><th>Побед</th><th>Win rate</th></tr></thead>
            <tbody>
              {Object.keys(stats.apps).map((b) => (
                <tr key={b}><td>{BOT_NAMES[b] ?? b}</td><td>{stats.apps[b]}</td><td>{stats.wins[b] ?? 0}</td><td>{(((stats.wins[b] ?? 0) / stats.apps[b]) * 100).toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
          <p>Победы по местам: {stats.seat.map((w, i) => `${i + 1}: ${((w / stats.games) * 100).toFixed(0)}%`).join(' · ')} (боты рассаживаются случайно)</p>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
