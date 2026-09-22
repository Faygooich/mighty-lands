import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Controller } from './controller.ts';
import type { Option } from '../../core/types.ts';
import { Board } from './Board.tsx';
import { BOT_NAMES, COLORS, cardText, decisionHint, isArtifact, optionLabel } from './labels.ts';
import { cardName } from '../../cards/catalog.ts';
import { landsOf, power } from '../../core/state.ts';

const SPEEDS = { 'медленно': 1200, 'нормально': 500, 'быстро': 120, 'мгновенно': 0 } as const;

export function GameView({ ctl, onExit }: { ctl: Controller; onExit: () => void }) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('нормально');
  const [revealAll, setRevealAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const g = ctl.g;
  const d = ctl.pending;

  // Bots play automatically.
  useEffect(() => {
    if (!d || !ctl.botTurn()) return;
    const t = setTimeout(() => { ctl.stepBot(); bump(); }, SPEEDS[speed]);
    return () => clearTimeout(t);
  });

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); });

  const human = d && !ctl.botTurn() ? g.players[d.player] : null;
  const target = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;

  // cells that the current human decision can target (for board highlight / click)
  const cellTargets = useMemo(() => {
    const m = new Map<number, number[]>();
    if (!d || !human) return m;
    d.options.forEach((o, i) => {
      const cell = o.t === 'artifact' ? o.land : o.t === 'spell' && o.card !== 'fireball' && o.card !== 'drain' && o.target >= 0 ? o.target : -1;
      if (cell >= 0) m.set(cell, [...(m.get(cell) ?? []), i]);
    });
    return m;
  }, [d, human]);

  const choose = (i: number) => { ctl.choose(i); bump(); };

  const groups = useMemo(() => {
    if (!d) return [] as Array<{ title: string; text?: string; items: Array<[number, Option]> }>;
    if (d.kind !== 'main') return [{ title: '', items: d.options.map((o, i) => [i, o] as [number, Option]) }];
    const out = new Map<string, { title: string; text?: string; items: Array<[number, Option]> }>();
    d.options.forEach((o, i) => {
      const key = o.t === 'artifact' || o.t === 'spell' ? `${o.t}:${o.card}` : o.t;
      const title = o.t === 'artifact' ? `🔮 Артефакт «${cardName(o.card)}» — положить на:` : o.t === 'spell' ? `✨ Заклятие «${cardName(o.card)}»` : '';
      const text = o.t === 'artifact' || o.t === 'spell' ? cardText(g, o.card) : undefined;
      if (!out.has(key)) out.set(key, { title, text, items: [] });
      out.get(key)!.items.push([i, o]);
    });
    return [...out.values()];
  }, [d, g]);

  return (
    <div className="game">
      <div className="topbar">
        <button onClick={onExit}>← Меню</button>
        <span>Раунд {g.round} · Цель: <b>{target} Земель</b></span>
        <label>Боты: <select value={speed} onChange={(e) => setSpeed(e.target.value as keyof typeof SPEEDS)}>
          {Object.keys(SPEEDS).map((s) => <option key={s}>{s}</option>)}
        </select></label>
        <label><input type="checkbox" checked={revealAll} onChange={(e) => setRevealAll(e.target.checked)} /> показать все руки</label>
        <button onClick={() => { navigator.clipboard?.writeText(ctl.exportCode()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Скопировано ✓' : '📋 Код партии'}</button>
      </div>

      <div className="layout">
        <Board g={g} highlight={new Set(cellTargets.keys())} onCell={(c) => { const opts = cellTargets.get(c); if (opts && opts.length === 1) choose(opts[0]); }}>
          <div className="dice">🎲 {ctl.lastRoll || '–'}</div>
          {g.over ? (
            <div className="victory">
              <div className="crown">🏆</div>
              <h2>{g.winner >= 0 ? `${g.players[g.winner].name} побеждает!` : 'Партия окончена'}</h2>
              <p>{g.endReason === 'lands-target' ? `Собрано ${target} Земель` : g.endReason}</p>
              <button onClick={onExit}>Новая партия</button>
            </div>
          ) : d ? (
            <div className={`decision ${human ? 'mine' : ''}`}>
              <div className="who" style={{ color: COLORS[d.player] }}>{g.players[d.player].name}{human ? ' — ваш выбор' : ' думает…'}</div>
              <div className="reason">{d.reason}</div>
              {human && <div className="hint">💡 {decisionHint(g, d)}</div>}
              {human && (
                <div className="options">
                  {groups.map((grp, gi) => (
                    <div key={gi} className="opt-group">
                      {grp.title && <div className="opt-title" title={grp.text}>{grp.title}{grp.text && <small> — {grp.text}</small>}</div>}
                      <div className="opt-buttons">
                        {grp.items.map(([i, o]) => (
                          <button key={i} className={`opt ${o.t}`} onClick={() => choose(i)}>{optionLabel(g, d, o)}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Board>

        <div className="side">
          {g.players.map((p) => {
            const mine = human?.id === p.id || revealAll || (ctl.seats[p.id].kind === 'human' && ctl.seats.filter((s) => s.kind === 'human').length === 1);
            return (
              <div key={p.id} className={`player ${g.current === p.id ? 'active' : ''}`} style={{ borderColor: COLORS[p.id] }}>
                <div className="pname" style={{ color: COLORS[p.id] }}>{p.name}{ctl.seats[p.id].kind !== 'human' && <small> 🤖 {BOT_NAMES[ctl.seats[p.id].kind] ?? ctl.seats[p.id].kind}</small>}</div>
                <div className="power">МОЩЬ <b>{power(p)}</b></div>
                <div className="tokens">
                  {Array.from({ length: g.rules.maxSlots }, (_, i) => p.tokens[i]).map((t, i) => (
                    <span key={i} className={`token t${t ?? 0}`}>{t ?? ''}</span>
                  ))}
                </div>
                <div className="stats">❤ {p.tokens.length} · 🚩 {landsOf(g, p.id).length}/{target} · 🃏 {p.hand.length}{p.skip ? ' · ⛓ пропуск' : ''}</div>
                {mine && p.hand.length > 0 && (
                  <div className="hand">
                    {p.hand.map((c, i) => (
                      <span key={i} className={`card ${isArtifact(c) ? 'art' : 'spell'}`} title={cardText(g, c)}>{cardName(c)}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="log" ref={logRef}>
            {(g.log ?? []).slice(-150).map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
