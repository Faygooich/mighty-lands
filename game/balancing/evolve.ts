// Evolution driver.
//   node game/balancing/evolve.ts explore <base> '<overrides json>' [scale]   quick training-seed check
//   node game/balancing/evolve.ts gen <N>                                    run generation from docs/generations/plans/gen_NNN.json
//   node game/balancing/evolve.ts render <N>                                 re-render markdown from saved results
//   node game/balancing/evolve.ts final <version>                            fresh-seed final holdout
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules, rulesPath, RULES_DIR } from '../rules/load.ts';
import { mergeRules, rulesComplexity, type RuleSet } from '../rules/ruleset.ts';
import { Pool, defaultWorkers } from '../simulation/pool.ts';
import { SEEDS } from '../simulation/experiment.ts';
import { evaluate, suiteDefs, type Evaluation } from './suite.ts';
import { detect, SEV_ORDER, type Finding } from '../statistics/detect.ts';
import { runOne } from '../simulation/runner.ts';
import { SCENARIOS } from '../simulation/experiment.ts';
import { cardName } from '../cards/catalog.ts';
import type { Weights } from '../simulation/bots/heuristic.ts';
import { exploitSearch } from './exploitSearch.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const RES = join(ROOT, 'results');
const DOCS = join(ROOT, 'docs', 'generations');
const pad = (n: number) => String(n).padStart(3, '0');

export interface Tabletop {
  /** The 8 questions of the Tabletop Filter, answered for the NEW mechanic. */
  explain: string; noCalculator: boolean; noWriting: boolean; tempEffects: number; onComponent: boolean; visible: boolean; notSlow: boolean; decision: string;
  /** Loads: 'нет' | 'низкая' | 'средняя' | 'высокая' */
  cognitive: string; arithmetic: string; lookup: string; bookkeeping: string; tableTime: string;
}
export interface Candidate { id: string; title: string; overrides: Record<string, unknown>; rationale?: string; tabletop?: Tabletop }
export interface Plan {
  generation: number;
  base: string;
  focus: string;
  observations?: string;
  hypotheses?: string;
  candidates: Candidate[];
  sideEffects?: string;
  verdict?: string;
  next?: string;
  exploitSearch?: boolean;
  scale?: number;
  /** Designer notes for GAME FEEL / Munchkin sections (after reading the numbers). */
  gameFeel?: string;
  munchkin?: string;
}

interface GenResult {
  generation: number;
  base: string;
  chosen: string;           // candidate id or 'base'
  newVersion: string | null;
  training: Record<string, Evaluation>;
  validation: Record<string, Evaluation>;
  holdout: Evaluation;
  findingsBase: Finding[];
  findingsChosen: Finding[];
  regression: Array<{ id: string; key: string; title: string; before: string; after: string; afterValue: string }>;
  replays: string[];
  exploitGenome: Partial<Weights> | null;
  decision: string;
  workers: number;
  totalGames: number;
  elapsedSec: number;
}

function loadGenome(): Partial<Weights> | undefined {
  const p = join(RES, 'exploit_genome.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')).genome as Partial<Weights>) : undefined;
}

function bugsFile(): Record<string, { id: string; title: string; firstGen: number; history: Array<{ gen: number; severity: string; value: string }> }> {
  const p = join(RES, 'bugs.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

const sevRank = (s: string) => SEV_ORDER.indexOf(s as never);

// ---------------------------------------------------------------------------

async function runGeneration(n: number): Promise<void> {
  const plan = JSON.parse(readFileSync(join(DOCS, 'plans', `gen_${pad(n)}.json`), 'utf8')) as Plan;
  const t0 = performance.now();
  const workers = defaultWorkers();
  const pool = new Pool(workers);
  const scale = plan.scale ?? 0.5;
  const base = loadRules(plan.base);
  let genome = loadGenome();
  let exploitGenome: Partial<Weights> | null = null;
  if (plan.exploitSearch) {
    console.log('exploit search on base ruleset...');
    exploitGenome = await exploitSearch(pool, base, SEEDS.training + 700_000, genome);
    genome = exploitGenome;
    writeFileSync(join(RES, 'exploit_genome.json'), JSON.stringify({ found: `gen ${n} on ${base.version}`, genome }, null, 2));
  }
  const genomes = genome ? { exploit: genome } : undefined;
  const rulesets: Record<string, RuleSet> = { base };
  for (const c of plan.candidates) rulesets[c.id] = mergeRules(base, c.overrides);

  const training: Record<string, Evaluation> = {};
  let totalGames = 0;
  for (const [id, r] of Object.entries(rulesets)) {
    training[id] = await evaluate(pool, r, SEEDS.training, { scale, genomes });
    totalGames += training[id].games;
    console.log(`training ${id}: score ${training[id].score.total.toFixed(1)} (${training[id].elapsedSec.toFixed(0)}s)`);
  }
  // selection: best training score among non-failing; ties (<0.5) prefer base / fewer overrides
  const ids = Object.keys(rulesets).filter((id) => training[id].score.hardFail.length === 0);
  // R3.1: tie-break by complexity of the resulting game; equal complexity → prefer no change
  const complexity = (id: string) => rulesComplexity(rulesets[id]) + (id === 'base' ? 0 : 0.5);
  ids.sort((a, b) => {
    const d = training[b].score.total - training[a].score.total;
    return Math.abs(d) < 0.5 ? complexity(a) - complexity(b) : d;
  });
  let chosen = ids[0] ?? 'base';
  const validation: Record<string, Evaluation> = {};
  let decision = '';
  if (chosen !== 'base') {
    validation.base = await evaluate(pool, base, SEEDS.validation, { scale, genomes });
    validation[chosen] = await evaluate(pool, rulesets[chosen], SEEDS.validation, { scale, genomes });
    totalGames += validation.base.games + validation[chosen].games;
    const dv = validation[chosen].score.total - validation.base.score.total;
    // R3.1: same tolerance as the training tie-break (0.5) — smaller differences are noise
    if (dv < -0.5) {
      decision = `Кандидат ${chosen} лучший на training, но на validation хуже базы (${dv.toFixed(1)}) → изменение отклонено.`;
      chosen = 'base';
    } else {
      decision = `Кандидат ${chosen} лучший на training (${training[chosen].score.total.toFixed(1)}) и подтверждён на validation (${validation[chosen].score.total.toFixed(1)} против ${validation.base.score.total.toFixed(1)} у базы).`;
    }
  } else {
    validation.base = await evaluate(pool, base, SEEDS.validation, { scale, genomes });
    totalGames += validation.base.games;
    decision = 'Ни один кандидат не превзошёл текущие правила на training → правила не меняются (доказательство, что изменение не требуется или кандидаты хуже).';
  }
  const chosenRules = rulesets[chosen];
  const holdout = await evaluate(pool, chosenRules, SEEDS.holdout + n * 10_000, { scale, genomes });
  totalGames += holdout.games;

  // new version
  let newVersion: string | null = null;
  if (chosen !== 'base') {
    const vnum = Number(plan.base.slice(1)) + 1;
    newVersion = `v${pad(vnum)}`;
    if (existsSync(rulesPath(newVersion))) throw new Error(`${newVersion} already exists — never overwrite history`);
    const c = plan.candidates.find((x) => x.id === chosen)!;
    writeFileSync(rulesPath(newVersion), JSON.stringify({ version: newVersion, parent: plan.base, title: c.title, generation: n, changes: [c.title], rationale: c.rationale ?? '', overrides: c.overrides }, null, 2));
    const resolved = loadRules(newVersion);
    mkdirSync(join(RULES_DIR, 'resolved'), { recursive: true });
    writeFileSync(join(RULES_DIR, 'resolved', `${newVersion}.json`), JSON.stringify(resolved, null, 2));
  }

  // findings + regression registry
  const findingsBase = detect(training.base, base.denominations);
  const findingsChosen = detect(training[chosen], chosenRules.denominations);
  const bugs = bugsFile();
  let next = Object.keys(bugs).length + 1;
  for (const f of [...findingsBase, ...findingsChosen]) {
    if (!bugs[f.key] && sevRank(f.severity) <= sevRank('MEDIUM')) {
      bugs[f.key] = { id: `BUG-${pad(next++)}`, title: f.title, firstGen: n, history: [] };
    }
  }
  const regression: GenResult['regression'] = [];
  for (const [key, b] of Object.entries(bugs)) {
    const before = findingsBase.find((f) => f.key === key);
    const after = findingsChosen.find((f) => f.key === key);
    b.history = b.history.filter((h) => h.gen !== n);
    b.history.push({ gen: n, severity: after?.severity ?? 'n/a', value: after?.value ?? '' });
    regression.push({ id: b.id, key, title: b.title, before: before?.severity ?? 'n/a', after: after?.severity ?? 'n/a', afterValue: after?.value ?? '' });
  }
  writeFileSync(join(RES, 'bugs.json'), JSON.stringify(bugs, null, 2));

  // replays of anomalous games (chosen ruleset, training)
  const replays = saveReplays(n, chosenRules, training[chosen], genomes);

  await pool.close();
  const res: GenResult = {
    generation: n, base: plan.base, chosen, newVersion, training, validation, holdout, findingsBase, findingsChosen, regression, replays,
    exploitGenome, decision, workers, totalGames, elapsedSec: (performance.now() - t0) / 1000,
  };
  mkdirSync(RES, { recursive: true });
  writeFileSync(join(RES, `gen_${pad(n)}.json`), JSON.stringify(res));
  render(n);
  console.log(decision);
  console.log(`games: ${totalGames}, time ${res.elapsedSec.toFixed(0)}s → ${newVersion ?? 'no new version'}`);
}

function saveReplays(n: number, rules: RuleSet, e: Evaluation, genomes?: Record<string, Partial<Weights>>): string[] {
  const defs = suiteDefs();
  const out: string[] = [];
  mkdirSync(join(ROOT, 'replays'), { recursive: true });
  const seen = new Set<string>();
  for (const a of e.anomalies) {
    const [key, reason] = a.reason.split(':');
    if (seen.has(reason) || out.length >= 4) continue;
    seen.add(reason);
    const def = defs.find((d) => d.key === key);
    const r = runOne(rules, a.bots, a.seed, { log: true, record: true, genomes, setup: def?.scenario ? SCENARIOS[def.scenario] : undefined, shuffleSeats: !def?.noShuffle });
    const file = `replays/gen_${pad(n)}_${reason}_${a.seed}.txt`;
    const head = [`# Replay: ${reason} (${key})`, `rules: ${rules.version}`, `seed: ${a.seed}`, `lineup: ${a.bots.join(', ')}`, `scenario: ${def?.scenario ?? '-'}`,
      `winner: ${r.rec.winner >= 0 ? r.rec.bots[r.rec.winner] : 'none'} after ${r.rec.rounds} rounds (${r.rec.endReason})`, `choices: ${JSON.stringify(r.choices)}`, ''];
    const log = r.log ?? [];
    const body = log.length > 400 ? [...log.slice(0, 200), `... (${log.length - 400} lines skipped) ...`, ...log.slice(-200)] : log;
    writeFileSync(join(ROOT, file), head.concat(body).join('\n'));
    out.push(file);
  }
  return out;
}

// ---- Markdown ----------------------------------------------------------------

const pct = (x: number | undefined) => (x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const f1 = (x: number | undefined) => (x === undefined ? '—' : x.toFixed(1));

function metricsTable(cols: Array<[string, Evaluation]>): string {
  const rows: Array<[string, (e: Evaluation) => string]> = [
    ['Скор качества', (e) => f1(e.score.total)],
    ['Партий (всего в наборе)', (e) => String(e.games)],
    ['Медиана раундов (4p)', (e) => String(e.summaries.mixed4.medianRounds)],
    ['p10 / p90 раундов', (e) => `${e.summaries.mixed4.p10Rounds} / ${e.summaries.mixed4.p90Rounds}`],
    ['Таймауты (4p)', (e) => pct(e.summaries.mixed4.timeoutRate)],
    ['Таймауты (stall-тест)', (e) => pct(e.summaries.stall?.timeoutRate)],
    ['Win rate мест, зеркало 4p', (e) => e.summaries.mirror4.seatWinRate.map(pct).join(' / ')],
    ['Win rate мест, зеркало 2p', (e) => e.summaries.mirror2?.seatWinRate.map(pct).join(' / ') ?? '—'],
    ['Камбэк (победитель не лидер в середине)', (e) => pct(e.summaries.mixed4.comebackRate)],
    ['Последний в середине → победа', (e) => pct(e.summaries.mixed4.lastHalfWinRate)],
    ['Comeback-тест: лидер старта побеждает', (e) => pct(e.summaries.earlyLead?.seatWinRate[0])],
    ['Первый захват → победа', (e) => pct(e.summaries.mixed4.firstCapturerWinRate)],
    ['Смен лидера за партию', (e) => f1(e.summaries.mixed4.leadChangesPerGame)],
    ['Доля времени выбывшим', (e) => pct(e.summaries.mixed4.deadFraction)],
    ['Содержательных решений / ход', (e) => e.summaries.mixed4.meaningfulPerTurn.toFixed(2)],
    ['HP из сдачи за партию', (e) => e.summaries.mixed4.changeHealPerGame.toFixed(2)],
    ['⏱ Оценка реального времени партии (4p)', (e) => `${e.summaries.mixed4.tableMinutes.toFixed(0)} мин (p90 ≈ ${e.summaries.mixed4.tableMinutesP90.toFixed(0)})`],
    ['⏱ Секунд на ход за столом', (e) => e.summaries.mixed4.secPerTurn.toFixed(0)],
    ['🧮 Арифметических операций на ход', (e) => e.summaries.mixed4.arithPerTurn.toFixed(2)],
    ['🧮 Размен сдачи за партию', (e) => e.summaries.mixed4.changeMakingPerGame.toFixed(1)],
    ['📌 Временных эффектов для отслеживания за партию', (e) => e.summaries.mixed4.trackedEffectsPerGame.toFixed(1)],
    ['ExploitBot win rate (vs 3 Tactical)', (e) => pct(e.summaries.exploit?.winRate.exploit)],
    ['Low HP: медиана / таймауты', (e) => e.summaries.lowHp ? `${e.summaries.lowHp.medianRounds} / ${pct(e.summaries.lowHp.timeoutRate)}` : '—'],
    ['Extreme economy: медиана / таймауты', (e) => e.summaries.extremeEconomy ? `${e.summaries.extremeEconomy.medianRounds} / ${pct(e.summaries.extremeEconomy.timeoutRate)}` : '—'],
    ['Late game: медиана / таймауты', (e) => e.summaries.lateGame ? `${e.summaries.lateGame.medianRounds} / ${pct(e.summaries.lateGame.timeoutRate)}` : '—'],
  ];
  let s = `| Метрика | ${cols.map((c) => c[0]).join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
  for (const [name, fn] of rows) s += `| ${name} | ${cols.map((c) => fn(c[1])).join(' | ')} |\n`;
  return s;
}

function winTable(cols: Array<[string, Evaluation]>): string {
  const bots = ['tactical', 'aggressive', 'defensive', 'economic', 'survival', 'random'];
  let s = `| Бот (mixed4, честная доля 25%) | ${cols.map((c) => c[0]).join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
  for (const b of bots) s += `| ${b} | ${cols.map((c) => pct(c[1].summaries.mixed4.winRate[b])).join(' | ')} |\n`;
  s += `| **дуэль 2p:** tactical / random | ${cols.map((c) => `${pct(c[1].summaries.duel?.winRate.tactical)} / ${pct(c[1].summaries.duel?.winRate.random)}`).join(' | ')} |\n`;
  return s;
}

function scoreTable(tr: Record<string, Evaluation>, plan: Plan): string {
  const keys = Object.keys(tr);
  const pens = Object.keys(tr.base.score.penalties);
  let s = `| Штраф | ${keys.map((k) => (k === 'base' ? 'база' : k)).join(' | ')} |\n|---|${keys.map(() => '---').join('|')}|\n`;
  for (const p of pens) s += `| ${p} | ${keys.map((k) => tr[k].score.penalties[p].toFixed(1)).join(' | ')} |\n`;
  s += `| **Итого скор** | ${keys.map((k) => `**${tr[k].score.total.toFixed(1)}**${tr[k].score.hardFail.length ? ' ⛔' : ''}`).join(' | ')} |\n`;
  s += '\n' + plan.candidates.map((c) => `- **${c.id}** — ${c.title}\n  \`${JSON.stringify(c.overrides)}\``).join('\n') + '\n';
  return s;
}

function findingsTable(fs: Finding[]): string {
  const bad = fs.filter((f) => f.severity !== 'OK').sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  if (!bad.length) return '_Проблем не обнаружено._\n';
  let s = '| Severity | Проблема | Значение | Детали |\n|---|---|---|---|\n';
  for (const f of bad) s += `| ${f.severity} | ${f.title} | ${f.value} | ${f.detail} |\n`;
  return s;
}

function cardTable(e: Evaluation): string {
  const m = e.summaries.mixed4;
  const cards = Object.keys(m.cardPlayRate).sort();
  let s = '| Карта | Разыграно из полученных | Δ win rate при розыгрыше |\n|---|---|---|\n';
  for (const c of cards) s += `| ${cardName(c)} | ${pct(m.cardPlayRate[c])} | ${(m.cardWinDelta[c] * 100).toFixed(1)} п.п. |\n`;
  return s;
}

const mark = (ok: boolean, weak: boolean) => (ok ? '✅' : weak ? '⚠️' : '❌');

function gameFeelTable(e: Evaluation, base: Evaluation, ch: string): string {
  const f = e.summaries.mixed4.feel;
  const b = base.summaries.mixed4.feel;
  const m = e.summaries.mixed4;
  if (!f) return '_нет данных_';
  const pb = m.perBot.tactical ?? {};
  const rows: Array<[string, boolean, boolean, string]> = [
    ['1. Чувствуется ли рост мощности?', f.growth >= 1.8, f.growth >= 1.3, `пик/старт ×${f.growth.toFixed(2)} (было ×${b?.growth.toFixed(2) ?? '—'}); медиана макс. мощи за партию ${f.medianMaxPeak}`],
    ['2. Чувствуется ли опасность потери HP?', f.hp1Share >= 0.3 && f.hp1Share <= 0.8, f.hp1Share >= 0.15, `${(f.hp1Share * 100).toFixed(0)}% игроков доходят до 1 HP; урон ${(pb.hpLost ?? 0).toFixed(1)} HP/партию у Tactical`],
    ['3. Чувствуется ли ценность Земель?', (pb.captures ?? 0) >= 3, (pb.captures ?? 0) >= 1.5, `захватов ${(pb.captures ?? 0).toFixed(1)}/игрок, в конце у игрока ${(pb.landsEnd ?? 0).toFixed(1)} Земель`],
    ['4. Есть ли взаимодействие между игроками?', f.takeThatPerTurn + f.artifactHitsPerTurn >= 0.5, f.takeThatPerTurn + f.artifactHitsPerTurn >= 0.3, `${(f.takeThatPerTurn + f.artifactHitsPerTurn).toFixed(2)} прямых влияний на ход (активных ${f.takeThatPerTurn.toFixed(2)}, Артефакты ${f.artifactHitsPerTurn.toFixed(2)})`],
    ['5. Есть ли неожиданные моменты?', m.leadChangesPerGame >= 4 && f.reactionsPerGame >= 1, m.leadChangesPerGame >= 3, `смен лидера ${m.leadChangesPerGame.toFixed(1)}/партию, карт в чужой ход ${f.reactionsPerGame.toFixed(1)}/партию`],
    ['6. Поводы смеяться/злиться/договариваться?', f.helpsPerGame >= 1 && f.hindersPerGame >= 1, f.reactionsPerGame + f.takeThatPerTurn * 20 >= 3, `Подмог ${f.helpsPerGame.toFixed(1)}, Помех ${f.hindersPerGame.toFixed(1)} за партию`],
    ['7. «Ещё чуть-чуть — и я стану очень сильным»?', f.bossPerGame >= 1 && f.bigGameShare >= 0.5, f.bigGameShare >= 0.3, `встреч с монстрами 4000+ ${f.bossPerGame.toFixed(1)}/партию; партий, где кто-то достиг 2500+: ${(f.bigGameShare * 100).toFixed(0)}%`],
    ['8. «Я НЕ МОГУ ЭТО ПОТЕРЯТЬ»?', f.hp1Share >= 0.3 && (pb.landsEnd ?? 0) >= 1, f.hp1Share >= 0.15, `1 HP и есть что терять: ${(f.hp1Share * 100).toFixed(0)}% игроков`],
    ['9. «ДАААА, Я СТАЛ СИЛЬНЕЕ!»?', f.jumpsPerGame >= 3, f.jumpsPerGame >= 1, `рывков мощи ≥500 за раз: ${f.jumpsPerGame.toFixed(1)}/партию`],
    ['10. «ЧЁРТ, ОН МНЕ ВСЁ СЛОМАЛ»?', f.landsTakenPerGame + f.hindersPerGame >= 2, f.landsTakenPerGame + f.hindersPerGame >= 1, `отнятых Земель ${f.landsTakenPerGame.toFixed(1)}, сорванных Помехой боёв ${f.hindersPerGame.toFixed(1)} за партию`],
  ];
  let s = `| Вопрос | ${ch === 'base' ? 'итог' : ch} | Данные симуляции |\n|---|---|---|\n`;
  for (const [q, ok, weak, txt] of rows) s += `| ${q} | ${mark(ok, weak)} | ${txt} |\n`;
  return s;
}

function munchkinTable(e: Evaluation, base: Evaluation, ch: string): string {
  const f = e.summaries.mixed4.feel;
  if (!f) return '_нет данных_';
  const rows: Array<[string, boolean, boolean, string]> = [
    ['Player Interaction', f.takeThatPerTurn + f.artifactHitsPerTurn >= 0.5, f.takeThatPerTurn + f.artifactHitsPerTurn >= 0.3, `${(f.takeThatPerTurn + f.artifactHitsPerTurn).toFixed(2)} прямых влияний на ход`],
    ['Take That', f.takeThatPerTurn >= 0.35, f.takeThatPerTurn >= 0.2, `${f.takeThatPerTurn.toFixed(2)} активных вредных действий на ход; отнято Земель ${f.landsTakenPerGame.toFixed(1)}/партию`],
    ['Temporary Alliances', f.helpsPerGame >= 1, f.helpsPerGame >= 0.3, `Подмог (помощь чужому бою за награду) ${f.helpsPerGame.toFixed(1)}/партию`],
    ['Negotiation', f.helpsPerGame >= 1, f.helpsPerGame >= 0.3, 'Поводы: «помогу, если отдашь награду / не тронешь мою Землю». Ботами не моделируется, оценивается по числу Подмог'],
    ['Kingmaking', f.kingmakerShare <= 0.25, f.kingmakerShare <= 0.35, `${(f.kingmakerShare * 100).toFixed(0)}% вредных действий совершает игрок на последнем месте`],
    ['Revenge', f.revengeShare >= 0.15, f.revengeShare >= 0.08, `${(f.revengeShare * 100).toFixed(0)}% атак направлены на того, кто последним навредил атакующему`],
    ['Table Talk', f.reactionsPerGame >= 2, f.reactionsPerGame >= 0.5, `карт в чужой ход ${f.reactionsPerGame.toFixed(1)}/партию`],
  ];
  let s = `| Критерий | ${ch === 'base' ? 'итог' : ch} | Данные |\n|---|---|---|\n`;
  for (const [q, ok, weak, txt] of rows) s += `| ${q} | ${mark(ok, weak)} | ${txt} |\n`;
  return s;
}

function tabletopTable(plan: Plan): string {
  const cs = plan.candidates.filter((c) => c.tabletop);
  if (!cs.length) return '_Новых механик нет._';
  const yn = (b: boolean) => (b ? '✅' : '❌');
  let s = '| Вопрос | ' + cs.map((c) => c.id).join(' | ') + ' |\n|---|' + cs.map(() => '---').join('|') + '|\n';
  const rows: Array<[string, (t: Tabletop) => string]> = [
    ['1. Объяснение в 1–2 предложения', (t) => t.explain],
    ['2. Без калькулятора', (t) => yn(t.noCalculator)],
    ['3. Ничего не записывать', (t) => yn(t.noWriting)],
    ['4. Временных эффектов помнить', (t) => String(t.tempEffects)],
    ['5. Вся информация на карте/компоненте', (t) => yn(t.onComponent)],
    ['6. Состояние видно на столе', (t) => yn(t.visible)],
    ['7. Не замедляет игру', (t) => yn(t.notSlow)],
    ['8. Какое решение создаёт', (t) => t.decision],
    ['Cognitive load', (t) => t.cognitive],
    ['Arithmetic load', (t) => t.arithmetic],
    ['Lookup load', (t) => t.lookup],
    ['Bookkeeping load', (t) => t.bookkeeping],
    ['Table time', (t) => t.tableTime],
  ];
  for (const [q, f] of rows) s += `| ${q} | ${cs.map((c) => f(c.tabletop!)).join(' | ')} |\n`;
  return s;
}

export function render(n: number): void {
  const plan = JSON.parse(readFileSync(join(DOCS, 'plans', `gen_${pad(n)}.json`), 'utf8')) as Plan;
  const r = JSON.parse(readFileSync(join(RES, `gen_${pad(n)}.json`), 'utf8')) as GenResult;
  const ch = r.chosen;
  const cand = plan.candidates.find((c) => c.id === ch);
  const defs = suiteDefs(plan.scale ?? 0.5);
  const md = `# Generation ${n}

> Фокус: ${plan.focus}

## Версия правил

- Тестировалась база: **${r.base}** (${loadRules(r.base).title})
- Кандидаты: ${plan.candidates.map((c) => `**${c.id}**`).join(', ') || '—'}
- Итог: ${r.newVersion ? `**${r.newVersion}** ← кандидат ${ch}: ${cand?.title}` : `правила **не изменены** (${r.base})`}

## Что было протестировано

- Всего сыграно партий в поколении: **${r.totalGames.toLocaleString('ru-RU')}** (worker threads: ${r.workers}, время ${r.elapsedSec.toFixed(0)} с)
- Каждый набор правил прогонялся через стандартный набор экспериментов:

| Эксперимент | Партий | Игроков |
|---|---|---|
${defs.map((d) => `| ${d.label} | ${d.games} | ${d.lineup.type === 'fixed' ? d.lineup.bots.length : d.lineup.n} |`).join('\n')}

- Боты: RandomBot, AggressiveBot, DefensiveBot, EconomicBot, TacticalBot, SurvivalBot, ExploitBot${r.exploitGenome ? ' (геном ExploitBot заново найден поиском в этом поколении)' : ''}.
- Seeds: TRAINING ${SEEDS.training}+ (выбор кандидата), VALIDATION ${SEEDS.validation}+ (подтверждение), HOLDOUT ${SEEDS.holdout + n * 10_000}+ (только отчёт, не участвует в решении).

## Результаты

### Скор кандидатов (TRAINING)

${scoreTable(r.training, plan)}

### Ключевые метрики

${metricsTable([['база (train)', r.training.base], ...(ch !== 'base' ? [[`${ch} (train)`, r.training[ch]] as [string, Evaluation]] : []), ...(r.validation[ch] && ch !== 'base' ? [[`${ch} (valid)`, r.validation[ch]] as [string, Evaluation]] : []), [`итог (holdout)`, r.holdout]])}

### Win rate по стратегиям

${winTable([['база', r.training.base], ...(ch !== 'base' ? [[ch, r.training[ch]] as [string, Evaluation]] : []), ['holdout', r.holdout]])}

### Карты (итоговые правила, TRAINING)

${cardTable(r.training[ch])}

## Найденные проблемы

**До изменений (${r.base}):**

${findingsTable(r.findingsBase)}
${ch !== 'base' ? `**После изменений (${r.newVersion}):**\n\n${findingsTable(r.findingsChosen)}` : ''}

## Наблюдения

${plan.observations ?? '_—_'}

## Гипотезы

${plan.hypotheses ?? '_—_'}

## Изменения

${r.newVersion ? `Принят кандидат **${ch}**: ${cand?.title}\n\n\`\`\`json\n${JSON.stringify(cand?.overrides, null, 2)}\n\`\`\`` : 'Правила не изменены.'}

**Решение:** ${r.decision}

## Tabletop Filter (Human Table Test)

${tabletopTable(plan)}

## GAME FEEL

${gameFeelTable(r.training[ch], r.training.base, ch)}

${plan.gameFeel ?? ''}

## Манчкин-критерий (взаимодействие игроков)

${munchkinTable(r.training[ch], r.training.base, ch)}

${plan.munchkin ?? ''}

## Почему

${cand?.rationale ?? plan.candidates.map((c) => `- **${c.id}**: ${c.rationale ?? ''}`).join('\n')}

## Побочные эффекты

${plan.sideEffects ?? '_—_'}

## Регрессионные тесты

| Баг | Проблема | До | После | Значение |
|---|---|---|---|---|
${r.regression.map((x) => `| ${x.id} | ${x.title} | ${x.before} | ${x.after} | ${x.afterValue} |`).join('\n')}

${r.replays.length ? `Сохранены реплеи аномальных партий: ${r.replays.map((f) => `\`${f}\``).join(', ')}` : 'Аномальных партий для реплея не найдено.'}

## Вердикт поколения

${plan.verdict ?? '_(заполняется после анализа результатов)_'}

## Следующее поколение

${plan.next ?? '_—_'}
`;
  writeFileSync(join(DOCS, `gen_${pad(n)}.md`), md);
}

async function explore(baseV: string, overridesJson: string, scale: number, only?: string[]): Promise<void> {
  const pool = new Pool();
  const base = loadRules(baseV);
  const r = overridesJson && overridesJson !== '{}' ? mergeRules(base, JSON.parse(overridesJson)) : base;
  const genome = loadGenome();
  const e = await evaluate(pool, r, SEEDS.training, { scale, genomes: genome ? { exploit: genome } : undefined, only });
  await pool.close();
  const m = e.summaries.mixed4;
  console.log(`score ${e.score.total.toFixed(1)}  games ${e.games}  ${e.elapsedSec.toFixed(0)}s`);
  console.log('penalties', Object.fromEntries(Object.entries(e.score.penalties).map(([k, v]) => [k, +v.toFixed(1)])));
  console.log('values', Object.fromEntries(Object.entries(e.score.values).map(([k, v]) => [k, +v.toFixed(3)])));
  if (m) {
    console.log('winRate', Object.fromEntries(Object.entries(m.winRate).map(([k, v]) => [k, +(v * 100).toFixed(1)])));
    console.log('rounds med/p10/p90', m.medianRounds, m.p10Rounds, m.p90Rounds, 'endReasons', m.endReasons);
    console.log('hpLoss/game', m.hpLossBySource);
    console.log('cardPlay', Object.fromEntries(Object.entries(m.cardPlayRate).map(([k, v]) => [k, +(v * 100).toFixed(0)])));
    console.log('cardDelta', Object.fromEntries(Object.entries(m.cardWinDelta).map(([k, v]) => [k, +(v * 100).toFixed(1)])));
    console.log('denoms', Object.fromEntries(Object.entries(m.denomShare).map(([k, v]) => [k, +(v * 100).toFixed(1)])));
    console.log('powerCurve', m.powerCurve.slice(0, 30).map((x) => Math.round(x)).join(' '));
    const pb = m.perBot.tactical;
    if (pb) console.log('tactical per game', Object.fromEntries(Object.entries(pb).map(([k, v]) => [k, +v.toFixed(2)])));
  }
  for (const f of detect(e, r.denominations)) if (f.severity !== 'OK') console.log(`  [${f.severity}] ${f.title}: ${f.value} — ${f.detail}`);
  if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(e));
}

async function finalHoldout(version: string): Promise<void> {
  const pool = new Pool();
  const r = loadRules(version);
  const genome = loadGenome();
  const e = await evaluate(pool, r, SEEDS.final, { scale: 1, genomes: genome ? { exploit: genome } : undefined });
  const v = await evaluate(pool, r, SEEDS.validation, { scale: 1, genomes: genome ? { exploit: genome } : undefined });
  await pool.close();
  writeFileSync(join(RES, `final_holdout_${version}.json`), JSON.stringify({ fresh: e, validation: v, findings: detect(e, r.denominations) }));
  console.log(`fresh seeds score ${e.score.total.toFixed(1)} vs validation ${v.score.total.toFixed(1)}; games ${e.games + v.games}`);
  for (const f of detect(e, r.denominations)) if (f.severity !== 'OK') console.log(`  [${f.severity}] ${f.title}: ${f.value}`);
}

const [cmd, a1, a2, a3, a4] = process.argv.slice(2);
if (cmd === 'gen') await runGeneration(Number(a1));
else if (cmd === 'render') render(Number(a1));
else if (cmd === 'explore') await explore(a1, a2 ?? '{}', Number(a3 ?? 0.3), a4 ? a4.split(',') : undefined);
else if (cmd === 'final') await finalHoldout(a1);
else console.log('usage: evolve.ts gen N | render N | explore <base> <json> [scale] [only] | final <version>');
