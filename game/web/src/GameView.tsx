// The game table. Layout: rail (tertiary) · board with the table centre (primary) · opponents,
// stage and recent events (secondary) · the viewer's mat and hand in the dock (primary).
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { TableCtl, UiEvent } from './controller.ts';
import type { Decision, GameState } from '../../core/types.ts';
import type { NetInfo } from './net/NetGame.tsx';
import { cardName } from '../../cards/catalog.ts';
import { CELL_FLAVOR, REGION_FLAVOR, landFlavor } from '../../cards/flavor.ts';
import { Board, STEP_MS, type CellFx, type CellMark } from './Board.tsx';
import { Stage } from './Stage.tsx';
import { Hand, type HandCard } from './Hand.tsx';
import { MyMat, OpponentMat, PawnBadge } from './PlayerMat.tsx';
import { RulesText } from './RulesText.tsx';
import { Art } from './art/index.tsx';
import { COLORS, REGION_NAMES, cardText, cardFlavor, prettyLog } from './labels.ts';
import { cardOptions, optionTarget, targetKind, whyNot } from './play.ts';
import { GameCard, CardBack } from './ui/GameCard.tsx';
import { Dice } from './ui/Dice.tsx';
import { Icon } from './ui/Icon.tsx';
import { Chip } from './ui/Tokens.tsx';
import { reducedMotion, useTransient } from './ui/hooks.ts';

const SPEEDS = { 'медленно': 1200, 'нормально': 600, 'быстро': 160, 'мгновенно': 0 } as const;
type Speed = keyof typeof SPEEDS;

interface Roll { value: number; id: number; label: string; good?: boolean }
interface Cast { card: string; player: number; caption: string; id: number }
interface Banner { text: string; player: number; id: number }

function readPref<T extends string>(k: string, dflt: T): T {
  try { return (localStorage.getItem(k) as T) ?? dflt; } catch { return dflt; }
}
function writePref(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}

export function GameView({ ctl, onExit, net }: { ctl: TableCtl; onExit: () => void; net?: NetInfo }) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeedState] = useState<Speed>(() => { const s = readPref<Speed>('mz.speed', 'нормально'); return s in SPEEDS ? s : 'нормально'; });
  const [motion, setMotionState] = useState<'full' | 'reduced'>(() => readPref('mz.motion', 'full'));
  const [revealAll, setRevealAllState] = useState(false);
  const setRevealAll = (v: boolean) => setRevealAllState(net ? false : v); // over the network nobody peeks
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | 'menu' | 'log' | 'rules'>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<number[] | null>(null);
  const [boardW, setBoardW] = useState(0);
  const [roll, setRoll] = useState<Roll>({ value: 0, id: 0, label: 'Кубик ждёт героя' });
  const [cast, setCast] = useState<Cast | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fx, fireFx] = useTransient<CellFx>(1300);
  const seen = useRef(ctl.seq);
  const busyUntil = useRef(0);
  const g = ctl.g;
  const d = ctl.pending;
  const goal = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;

  const setSpeed = (s: Speed) => { setSpeedState(s); writePref('mz.speed', s); };
  const setMotion = (m: 'full' | 'reduced') => { setMotionState(m); writePref('mz.motion', m); };
  useLayoutEffect(() => {
    if (motion === 'reduced') document.documentElement.dataset.motion = 'reduced';
    else delete document.documentElement.dataset.motion;
  }, [motion]);

  // ---- who is looking at the screen -------------------------------------------------
  // Over the network the viewer is fixed (own seat, or nothing for a spectator); locally the device
  // travels around the table, so a curtain hides the hand until the next player says they are ready.
  const humans = ctl.seats.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const hotSeat = !net && humans.length > 1;
  const pendingHuman = d && !ctl.botTurn() ? d.player : null;
  const [revealed, setRevealed] = useState<number | null>(hotSeat ? null : humans[0] ?? null);
  const curtainFor = hotSeat && !revealAll && pendingHuman !== null && revealed !== pendingHuman && !g.over ? pendingHuman : null;
  const viewer = net ? (net.you >= 0 ? net.you : null) : hotSeat ? (curtainFor !== null ? null : revealed) : humans[0] ?? null;
  const focus = viewer ?? pendingHuman ?? g.current;
  const mine = d !== null && viewer !== null && d.player === viewer && !ctl.botTurn();

  // ---- engine events → animations and feedback -------------------------------------
  const instantBots = speed === 'мгновенно';
  useLayoutEffect(() => {
    if (ctl.seq === seen.current) return;
    const fresh: UiEvent[] = ctl.events.filter((e) => e.seq > seen.current);
    seen.current = ctl.seq;
    const now = Date.now();
    const quiet = reducedMotion();
    const name = (i: number) => g.players[i]?.name ?? '';
    let lastRoll: Roll | null = null;
    let lastCast: Cast | null = null;
    let lastBanner: Banner | null = null;
    for (const e of fresh) {
      const isBot = ctl.seats[e.player]?.kind !== 'human';
      switch (e.type) {
        case 'move':
          if (e.a > 0) {
            lastRoll = { value: e.a, id: e.seq, label: `${name(e.player)}: ${e.a} ${e.a === 1 ? 'шаг' : e.a < 5 ? 'шага' : 'шагов'}` };
            if (!quiet) busyUntil.current = Math.max(busyUntil.current, now + 650 + e.a * STEP_MS);
          }
          break;
        case 'fleeOk': case 'fleeFail': case 'fightWin': case 'fightLose': case 'artifactFleeOk': case 'artifactFleeFail': {
          const good = e.type === 'fleeOk' || e.type === 'fightWin' || e.type === 'artifactFleeOk';
          const what = e.type.startsWith('fight') ? 'Бой' : 'Отступление';
          lastRoll = { value: e.a, id: e.seq, label: `${what}: ${e.a} — ${good ? (what === 'Бой' ? 'ПОБЕДА!' : 'удалось') : (what === 'Бой' ? 'по лицу' : 'не удалось')}`, good };
          if (!quiet) busyUntil.current = Math.max(busyUntil.current, now + 900);
          if (typeof e.b === 'number') fireFx(String(e.b), good ? 'escape' : 'hit');
          break;
        }
        case 'capture': fireFx(String(e.a), 'capture'); break;
        case 'landLost': fireFx(String(e.a), 'lost'); break;
        case 'artifactPlace': fireFx(String(e.a), 'place'); break;
        case 'artifactTrigger': { const v = g.players[e.a]; if (v) fireFx(String(v.pos), 'trigger'); break; }
        case 'spell': {
          if (instantBots && isBot) break;
          const card = String(e.b);
          const t = e.a;
          const toPlayer = ['fireball', 'drain', 'aid', 'hex', 'swap', 'lure', 'ambush', 'intercept', 'mirror'].includes(card);
          const tgt = t >= 0 ? (toPlayer ? name(t) : card === 'transmute' ? '' : g.cells[t]?.land?.name ?? (g.cells[t]?.type === 'start' ? 'Врата' : 'Перекрёсток')) : '';
          lastCast = { card, player: e.player, caption: `${name(e.player)} играет «${cardName(card)}»${tgt ? ` → ${tgt}` : ''}`, id: e.seq };
          break;
        }
        case 'turn':
          if (instantBots && isBot) break;
          lastBanner = { text: e.player === viewer ? 'Ваш ход, герой' : `Ход: ${name(e.player)}`, player: e.player, id: e.seq };
          break;
        case 'skip': lastBanner = { text: `${name(e.player)} пропускает ход: Оковы не отпускают`, player: e.player, id: e.seq }; break;
        case 'respawn': lastBanner = { text: `${name(e.player)} пал и возвращается из Вальхаллы к Вратам`, player: e.player, id: e.seq }; break;
      }
    }
    if (lastRoll) setRoll(lastRoll);
    if (lastCast) setCast(lastCast);
    if (lastBanner) setBanner(lastBanner);
    // a new decision cancels a half-made card choice
    setSelected(null);
    setPreview(null);
  });
  useEffect(() => { if (!cast) return; const t = setTimeout(() => setCast((c) => (c === cast ? null : c)), 1700); return () => clearTimeout(t); }, [cast]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner((b) => (b === banner ? null : b)), 1300); return () => clearTimeout(t); }, [banner]);

  // Movement / dice animations hold the table for a moment so every result is seen.
  const busy = Date.now() < busyUntil.current && !g.over;
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(bump, busyUntil.current - Date.now() + 10);
    return () => clearTimeout(t);
  });

  // Bots play automatically (after the animations settle, unless «мгновенно»). Over the network the
  // room runs them — its own pacing, one truth for everybody.
  useEffect(() => {
    if (!ctl.drivesBots || !d || !ctl.botTurn()) return;
    const wait = instantBots ? 0 : Math.max(SPEEDS[speed], busyUntil.current - Date.now());
    const t = setTimeout(() => { ctl.stepBot(); bump(); }, wait);
    return () => clearTimeout(t);
  });

  const choose = useCallback((i: number) => { setSelected(null); setPreview(null); ctl.choose(i); bump(); }, [ctl]);

  // ---- the selected card and its targets -----------------------------------------------
  const selOpts = useMemo(() => (selected && mine ? cardOptions(d, selected) : []), [selected, mine, d]);
  const selKind = selOpts.length ? targetKind(selOpts[0][1]) : 'none';
  const marks = useMemo(() => {
    const m = new Map<number, CellMark>();
    if (selKind === 'cell') for (const [, o] of selOpts) m.set(optionTarget(o), { kind: 'target' });
    if (preview) {
      const p = g.players[g.current];
      preview.forEach((c) => {
        if (m.has(c)) return;
        const step = (c - p.pos + g.cells.length) % g.cells.length;
        m.set(c, selKind === 'cell' || p.teleportTo >= 0 ? { kind: 'target' } : { kind: 'reach', step });
      });
    }
    return m;
  }, [selOpts, selKind, preview, g]);

  const onCell = (c: number) => {
    if (selKind === 'cell') {
      const hit = selOpts.find(([, o]) => optionTarget(o) === c);
      if (hit) return choose(hit[0]);
    }
    setInfo(c);
  };

  // ---- the hand in the dock --------------------------------------------------------------
  const me = g.players[focus];
  const handHidden = curtainFor !== null || (viewer === null && !revealAll) || (viewer !== null && viewer !== focus && !revealAll);
  const handCards: HandCard[] = me.hand.map((id) => {
    const why = whyNot(g, me, id, d && !ctl.botTurn() && viewer === me.id ? d : null);
    const opts = mine && d!.player === me.id ? cardOptions(d, id) : [];
    const mode = d?.kind === 'discard' && mine ? 'discard' : d?.kind === 'react' && mine && !why ? 'react' : null;
    // Explain «why not» on the card only while the viewer is choosing what to play; otherwise the hand just rests.
    const explain = mine && (d!.kind === 'main' || d!.kind === 'react');
    return {
      id,
      state: { selected: selected === id, disabled: explain ? why : null, playable: !why && mine, mode },
      onClick: () => {
        if (!opts.length) { setZoom(id); return; }
        if (d!.kind === 'main') {
          const kind = targetKind(opts[0][1]);
          if (selected === id) { setSelected(null); return; }
          if (opts.length === 1 && kind === 'none') { setSelected(id); return; }
          setSelected(id);
          return;
        }
        choose(opts[0][0]); // react / discard: the card itself is the choice
      },
    };
  });

  // Esc closes whatever is on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (zoom) setZoom(null); else if (info !== null) setInfo(null); else if (panel) setPanel(null); else if (selected) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, info, panel, selected]);

  const replayCode = ctl.exportCode();
  const copyCode = () => { if (!replayCode) return; navigator.clipboard?.writeText(replayCode); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const stageInside = boardW >= 520;
  // When the stage sits below the board (small screens), bring it into view when it needs the viewer.
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (stageInside || !mine || busy || window.innerWidth >= 960) return;
    asideRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [stageInside, mine, busy, selected, d?.kind]);
  const stage = (
    <Stage
      g={g} d={d} mine={mine} busy={busy} curtainFor={curtainFor} viewerTurn={viewer === g.current} onReveal={() => setRevealed(curtainFor)}
      selected={selKind !== undefined && selOpts.length ? selected : null} onCancelSelect={() => setSelected(null)}
      choose={choose} onPreview={setPreview} onExit={net ? (net.admin ? () => net.op({ op: 'lobby' }) : () => {}) : onExit}
      exitLabel={net ? (net.admin ? 'Ещё партию (все в лобби)' : 'Ждём хозяина комнаты…') : 'Новая партия'}
      canCopy={!!replayCode} onCopy={copyCode} goal={goal} names={g.players.map((p) => p.name)}
    />
  );
  const opponents = g.players.filter((p) => p.id !== focus);
  const compact = opponents.length > 3;

  return (
    <div className={`table ${mine ? 'my-turn' : ''}`} style={{ ['--pc' as string]: COLORS[g.current] }}>
      <header className="rail">
        <button type="button" className="rail-btn" onClick={() => setPanel(panel === 'menu' ? null : 'menu')} aria-expanded={panel === 'menu'} aria-label="Меню" title="Меню">
          <Icon name="gear" /> <span className="hide-sm">Меню</span>
        </button>
        <div className="rail-title">МОЩНЫЕ ЗЕМЛИ{net && <span className="rail-code" title="Код комнаты">{net.room.code}</span>}</div>
        <div className="rail-turn" style={{ ['--pc' as string]: COLORS[g.current] }}>
          <PawnBadge id={g.current} size={16} />
          <span>
            {g.over ? 'Партия окончена'
              : viewer === g.current ? <b>Ваш ход</b>
              : <>Ходит <b>{g.players[g.current].name}</b>{mine && <span className="rail-ask"> · нужно ваше решение</span>}</>}
          </span>
          <span className="rail-round">Раунд {g.round} · цель {goal} Земель</span>
        </div>
        <button type="button" className="rail-btn" onClick={() => setPanel(panel === 'log' ? null : 'log')} aria-expanded={panel === 'log'} aria-label="Журнал" title="Журнал партии">
          <Icon name="scroll" /> <span className="hide-sm">Журнал</span>
        </button>
      </header>

      <main className="arena">
        <section className="opponents" aria-label="Соперники">
          {opponents.map((p) => {
            const tgt = selKind === 'player' ? selOpts.find(([, o]) => optionTarget(o) === p.id) : undefined;
            return (
              <OpponentMat
                key={p.id} g={g} p={p} kind={ctl.seats[p.id].kind} compact={compact}
                active={g.current === p.id && !g.over} deciding={!!d && d.player === p.id}
                showHand={revealAll}
                target={tgt ? { label: `Цель: ${cardName(selected!)}`, onPick: () => choose(tgt[0]) } : null}
              />
            );
          })}
        </section>

        <section className="board-wrap">
          <Board g={g} marks={marks} fx={fx} onCell={onCell} onSize={setBoardW}>
            <div className="tray">
              <div className={`tray-dice ${roll.good === true ? 'good' : roll.good === false ? 'bad' : ''}`}>
                <Dice value={roll.value} rollId={roll.id} size={boardW >= 600 ? 48 : 34} />
                <span className="tray-label">{roll.label}</span>
              </div>
              <div className="tray-decks" title="Колоды: Артефакты и Заклятия">
                <CardBack deck="artifact" count={g.artDeck.length} />
                <CardBack deck="spell" count={g.spellDeck.length} />
              </div>
            </div>
            {stageInside ? stage : <Ticker g={g} />}
            {banner && <div key={banner.id} className="turn-banner" style={{ ['--pc' as string]: COLORS[banner.player] }}>{banner.text}</div>}
            {cast && (
              <div key={cast.id} className="cast" aria-live="polite">
                <GameCard g={g} id={cast.card} size="mini" />
                <div className="cast-caption" style={{ ['--pc' as string]: COLORS[cast.player] }}>{cast.caption}</div>
              </div>
            )}
          </Board>
        </section>

        {!stageInside && <section className="aside-stage" ref={asideRef}>{stage}</section>}

        {stageInside && <Ticker g={g} />}
      </main>

      <footer className={`dock ${mine ? 'active' : ''}`}>
        <MyMat g={g} p={me} kind={ctl.seats[me.id].kind} active={g.current === me.id && !g.over} deciding={mine} hidden={handHidden} />
        <Hand g={g} owner={me.id} cards={handCards} hidden={handHidden} count={me.hand.length} />
      </footer>

      {panel === 'menu' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet menu-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Меню">
            <div className="sheet-title">Меню</div>
            {(!net || net.admin) && (
              <label className="field">Скорость ботов{net && <span className="muted small"> — для всех в комнате</span>}
                <select
                  value={net ? (Object.keys(SPEEDS).find((k) => SPEEDS[k as Speed] === net.room.botDelay) ?? 'нормально') : speed}
                  onChange={(e) => { const s = e.target.value as Speed; if (net) net.op({ op: 'botDelay', ms: SPEEDS[s] }); else setSpeed(s); }}
                >
                  {Object.keys(SPEEDS).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            )}
            <label className="field">Анимации
              <select value={motion} onChange={(e) => setMotion(e.target.value as 'full' | 'reduced')}>
                <option value="full">полные</option><option value="reduced">минимум</option>
              </select>
            </label>
            {!net && <label className="check"><input type="checkbox" checked={revealAll} onChange={(e) => setRevealAll(e.target.checked)} /> Показать все руки (для обучения)</label>}
            {net && <NetSeats net={net} />}
            <div className="sheet-actions">
              <button type="button" className="plaque secondary" onClick={() => setPanel('rules')}><span className="plaque-main"><Icon name="book" /> Правила</span></button>
              {replayCode && <button type="button" className="plaque secondary" onClick={copyCode}><span className="plaque-main"><Icon name="copy" /> {copied ? 'Скопировано' : 'Код партии'}</span></button>}
              <button type="button" className="plaque ghost" onClick={onExit}>
                <span className="plaque-main"><Icon name="back" /> {net ? (net.admin ? 'Закрыть комнату' : 'Выйти из комнаты') : 'Выйти в главное меню'}</span>
              </button>
            </div>
            <p className="muted small">{replayCode ? 'Код партии воспроизводит её целиком: seed + все ходы.' : 'Код партии появится, когда партия закончится: он воспроизводит её целиком.'}</p>
          </div>
        </div>
      )}
      {panel === 'log' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet log-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Журнал партии">
            <div className="sheet-title">Журнал партии <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Закрыть"><Icon name="close" /></button></div>
            <LogList g={g} lines={g.log ?? []} names={g.players.map((p) => p.name)} />
          </div>
        </div>
      )}
      {panel === 'rules' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet rules-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Правила">
            <div className="sheet-title">Кодекс МОЩИ вкратце <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Закрыть"><Icon name="close" /></button></div>
            <RulesText />
          </div>
        </div>
      )}
      {net && <NetStatus net={net} g={g} d={d} />}
      {info !== null && <LandSheet g={g} cell={info} onClose={() => setInfo(null)} />}
      {zoom && (
        <div className="sheet-backdrop" onClick={() => setZoom(null)}>
          <div className="zoom" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={cardName(zoom)}>
            <GameCard g={g} id={zoom} size="lg" />
            <p className="zoom-why">{whyNot(g, me, zoom, mine ? d : null) ?? cardText(g, zoom)}</p>
            <button type="button" className="plaque secondary" onClick={() => setZoom(null)}><span className="plaque-main">Понятно, брат</span></button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Who is in the room, and (for the host) who can be handed over to a bot. */
function NetSeats({ net }: { net: NetInfo }) {
  return (
    <div className="net-seats">
      <div className="sheet-sub">Комната {net.room.code}</div>
      {net.room.seats.map((s, i) => (
        <div key={i} className={`net-seat ${s.online ? '' : 'off'}`} style={{ ['--pc' as string]: COLORS[i] }}>
          <PawnBadge id={i} size={16} />
          <span className="ns-name">{s.name}{i === net.you && ' (вы)'}</span>
          <span className="ns-state">
            {!s.person ? <><Icon name="bot" size={13} /> бот</>
              : s.kind !== 'human' ? <><Icon name="bot" size={13} /> играет бот</>
              : s.online ? <><Icon name="check" size={13} /> на связи</>
              : 'нет связи'}
          </span>
          {net.admin && s.person && s.kind === 'human' && !s.online && (
            <button type="button" className="plaque ghost tiny" onClick={() => net.op({ op: 'setKind', seat: i, kind: 'tactical' })}>Отдать боту</button>
          )}
          {net.admin && s.person && s.kind !== 'human' && s.online && (
            <button type="button" className="plaque ghost tiny" onClick={() => net.op({ op: 'setKind', seat: i, kind: 'human' })}>Вернуть игроку</button>
          )}
        </div>
      ))}
      {net.room.spectators.length > 0 && <div className="muted small"><Icon name="eye" size={13} /> Смотрят: {net.room.spectators.join(', ')}</div>}
    </div>
  );
}

/** Connection trouble and «we are waiting for somebody who dropped out». */
function NetStatus({ net, g, d }: { net: NetInfo; g: GameState; d: Decision | null }) {
  const seat = d && !g.over ? net.room.seats[d.player] : undefined;
  const waiting = seat && seat.person && seat.kind === 'human' && !seat.online;
  if (net.status === 'online' && !waiting) return null;
  const lost = net.status !== 'online';
  return (
    <div className={`net-banner ${lost ? 'lost' : 'wait'}`} role="status" aria-live="polite">
      {lost ? (
        <>
          <span className="spinner" aria-hidden /> {net.status === 'connecting' ? 'Подключаемся к комнате…' : 'Связь с комнатой потеряна — восстанавливаем. Партия ждёт вас.'}
          {net.error && <b> {net.error}</b>}
        </>
      ) : (
        <>
          <span className="spinner" aria-hidden /> Ждём {seat!.name}: игрок потерял связь.
          {net.admin && <button type="button" className="plaque secondary tiny" onClick={() => net.op({ op: 'setKind', seat: d!.player, kind: 'tactical' })}>Пусть доиграет бот</button>}
        </>
      )}
    </div>
  );
}

/** The last few things that happened, newest highlighted. */
function Ticker({ g }: { g: GameState }) {
  const lines = (g.log ?? []).slice(-4);
  const base = (g.log?.length ?? 0) - lines.length;
  return (
    <section className="ticker" aria-label="Последние события" aria-live="polite">
      {lines.map((line, i) => <div key={base + i} className={i === lines.length - 1 ? 'latest' : ''}>{prettyLog(g, line).text}</div>)}
    </section>
  );
}

function LogList({ g, lines, names }: { g: GameState; lines: string[]; names: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [lines.length]);
  return (
    <div className="log-list" ref={ref}>
      {lines.slice(-300).map((line, i, arr) => {
        const { round, text } = prettyLog(g, line);
        const who = names.findIndex((n) => text.startsWith(n));
        const newRound = i === 0 || prettyLog(g, arr[i - 1]).round !== round;
        return (
          <div key={i} style={who >= 0 ? { ['--pc' as string]: COLORS[who] } : undefined} className={`${who >= 0 ? 'by' : ''} ${newRound && round ? 'new-round' : ''}`} data-round={newRound && round ? `Раунд ${round}` : undefined}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

/** A Land (or corner) shown as a large board card. */
function LandSheet({ g, cell, onClose }: { g: GameState; cell: number; onClose: () => void }) {
  const c = g.cells[cell];
  const l = c.land;
  const f = l ? landFlavor(l.name) : undefined;
  const owner = l && l.owner >= 0 ? g.players[l.owner] : null;
  const here = g.players.filter((p) => p.alive && p.pos === cell);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`land-card ${l ? `r${l.region}` : 'corner'}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={l?.name ?? 'Клетка'}>
        <button type="button" className="icon-btn lc-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        <div className="lc-band">{l ? REGION_NAMES[l.region] : 'Особая клетка'}</div>
        <div className="lc-title">{l?.name ?? (c.type === 'start' ? 'Врата' : 'Перекрёсток')}</div>
        <div className="lc-art"><Art of={l ? { kind: 'land', name: l.name, region: l.region } : { kind: 'cell', type: c.type }} /></div>
        {l ? (
          <>
            <div className="lc-monster">
              <div>
                <div className="lc-mname">{f?.monster ?? 'Монстр'}</div>
                <div className="lc-quote">«{f?.monsterText}»</div>
              </div>
              <div className="lc-stats">
                <span className="lc-power" title="МОЩЬ монстра">{l.monster}</span>
                <span className="lc-reward">награда <Chip value={l.reward} size="xs" /></span>
              </div>
            </div>
            <div className={`lc-owner ${owner ? 'owned' : ''}`} style={owner ? { ['--pc' as string]: COLORS[owner.id] } : undefined}>
              {owner ? <><Icon name="flag" size={15} /> Владелец: <b>{owner.name}</b> — монстр повержен</> : 'Дикая Земля: монстр на месте и разминает шею. Встанете сюда — придётся с ним разобраться.'}
            </div>
            {l.artifact && (
              <div className="lc-artifact">
                <GameCard g={g} id={l.artifact} size="mini" />
                <div><b>{cardName(l.artifact)}</b>: {cardText(g, l.artifact)} <i className="muted">«{cardFlavor(l.artifact)}»</i></div>
              </div>
            )}
            <p className="lc-flavor">«{f?.landText}» <span className="muted">{REGION_FLAVOR[l.region]}</span></p>
          </>
        ) : (
          <>
            <p className="lc-flavor">«{CELL_FLAVOR[c.type]}»</p>
            {c.type === 'start' && <p>Прошли или остановились — возьмите жетон <Chip value={100} size="xs" /> (с Золотой Жилой Бицепса — <Chip value={500} size="xs" />): в свободную ячейку или вместо вашего самого мелкого, если новый крупнее.</p>}
          </>
        )}
        {here.length > 0 && <div className="lc-here">Здесь стоят: {here.map((p) => <span key={p.id} style={{ ['--pc' as string]: COLORS[p.id] }}><PawnBadge id={p.id} size={12} /> {p.name}</span>)}</div>}
      </div>
    </div>
  );
}
