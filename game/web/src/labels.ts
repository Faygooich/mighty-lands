// Human-readable labels and hints for engine options (presentation only — no rules here).
import type { Decision, GameState, Option } from '../../core/types.ts';
import { ARTIFACTS, SPELLS, cardName } from '../../cards/catalog.ts';
import { effPower, landsOf, power } from '../../core/state.ts';
import { CARD_FLAVOR } from '../../cards/flavor.ts';

export function cardFlavor(id: string): string {
  return CARD_FLAVOR[id] ?? '';
}

export const BOT_NAMES: Record<string, string> = {
  tactical: 'Тактик', aggressive: 'Агрессор', defensive: 'Защитник', economic: 'Экономист', survival: 'Выживальщик', random: 'Случайный', exploit: 'Эксплойтер',
};

export const COLORS = ['#e8453c', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6'];
export const REGION_COLORS = ['#7cb342', '#2e7d32', '#78909c', '#6a1b9a'];

export function cardText(g: GameState, id: string): string {
  return ARTIFACTS[id]?.text(g) ?? SPELLS[id]?.text(g) ?? '';
}

export function isArtifact(id: string): boolean {
  return !!ARTIFACTS[id];
}

function targetLabel(g: GameState, card: string, t: number): string {
  if (t < 0) return '';
  if (card === 'fireball' || card === 'drain' || card === 'swap' || card === 'lure') return g.players[t].name;
  if (card === 'transmute') return `вариант ${t + 1}`;
  const c = g.cells[t];
  if (c.land) return `${c.land.name}${c.land.owner >= 0 ? ` (${g.players[c.land.owner].name})` : ''}`;
  return c.type === 'start' ? 'Врата' : `Перекрёсток (${t})`;
}

export function optionLabel(g: GameState, d: Decision, o: Option): string {
  switch (o.t) {
    case 'done': return d.kind === 'main' ? (g.phase === 'pre' ? 'Бросить кубик' : 'Закончить ход') : 'Готово';
    case 'capture': return 'Захватить Землю';
    case 'pass': return d.kind === 'react' ? 'Не вмешиваться' : d.kind === 'trigger' ? 'Не играть' : 'Пройти мимо';
    case 'flee': return `Бежать (${g.rules.fleeMin}–6)`;
    case 'fight': return 'Драться (6 — победа)';
    case 'token': return `Потерять жетон ${o.value}`;
    case 'pay': return `Отдать жетон ${o.tokens.join('+')}`;
    case 'discard': return `Сбросить «${cardName(o.card)}»`;
    case 'artifact': return `«${cardName(o.card)}» → ${g.cells[o.land].land!.name}`;
    case 'spell': {
      const t = targetLabel(g, o.card, o.target);
      return `${cardName(o.card)}${t ? ` → ${t}` : ''}`;
    }
    case 'react': return o.card === 'courage' ? `Драться с «Отвагой» (${g.rules.params.courageWinOn || 4}–6 — победа)` : `Сыграть «${cardName(o.card)}»`;
    case 'choose':
      if (o.key.startsWith('roll:')) return `Идти на ${o.key.slice(5)}`;
      if (o.key === 'hand') return 'Сбросить все карты';
      return o.key === 'skip' ? 'Пропустить следующий ход' : d.reason.startsWith('Алтарь') ? 'Потерять 1 жетон' : 'Отдать 1 жетон';
    case 'exchange': return `Размен ${o.give}`;
  }
  return '?';
}

/** A short hint for the decision (what matters right now). */
export function decisionHint(g: GameState, d: Decision): string {
  const p = g.players[d.player];
  switch (d.kind) {
    case 'capture': return `Ваша мощь больше — Земля ваша, если захотите. Награда: жетон ${g.cells[p.pos].land?.reward ?? 0}.`;
    case 'encounter': return `Бежать: ${d6Chance(g.rules.fleeMin)} без потерь. Драться: ${d6Chance(g.rules.params.fightWinOn ?? 6)} — победа и Земля, иначе −1 жетон${p.hand.includes('courage') ? `; с Отвагой — ${d6Chance(g.rules.params.courageWinOn || 4)}` : ''}. С последним жетоном рискуете всеми Землями!`;
    case 'lose': return 'Жетон = жизнь. Обычно отдают самый мелкий, чтобы сохранить мощь.';
    case 'pay': return 'Отдайте один жетон. Мелкий — сохраните мощь, но соперник всё равно получит жетон.';
    case 'discard': return `В конце хода на руке не больше ${g.rules.handLimit === 'hp' ? 'числа жетонов' : g.rules.handLimit} карт.`;
    case 'react': {
      const f = g.players[d.amount ?? 0];
      const l = g.cells[f.pos].land;
      return `${f.name}: мощь ${effPower(f) + f.fightMod} против монстра ${l?.monster ?? '?'}. Подмога +500 ему (и вам 500 при его победе), Помеха +500 монстру.`;
    }
    case 'dilemma':
      if (d.reason.startsWith('Попутный')) return 'Выберите, на сколько клеток идти.';
      if (d.reason.startsWith('Алтарь')) return 'Жетон — это жизнь и мощь; карты — ваши будущие ходы.';
      return 'Жетон уйдёт владельцу Заставы; пропуск хода — потеря темпа.';
    case 'trigger': return 'Карта-ответ: играется только в такой момент. Можно приберечь.';
    case 'main': {
      const target = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;
      return `У вас ${landsOf(g, p.id).length} из ${target} Земель. Мощь ${power(p)}. ${g.phase === 'pre' ? 'До броска: положите Артефакты, сыграйте ≤1 Заклятие или бросьте кубик.' : 'После хода: Артефакты и Заклятие (если ещё не играли).'}`;
    }
  }
  return '';
}

// ---- Card presentation (still presentation only: numbers are read from the ruleset params) ----

export type CardFrame = 'artifact' | 'spell' | 'help' | 'hinder';

/** Visual family of a card: Artifacts, ordinary Spells and the two fight reactions. */
export function cardFrame(id: string): CardFrame {
  if (ARTIFACTS[id]) return 'artifact';
  const r = SPELLS[id]?.reaction;
  const t = SPELLS[id]?.trigger;
  if (t === 'counter' || t === 'courage') return 'help';
  if (t === 'ambush' || t === 'intercept') return 'hinder';
  return r === 'help' ? 'help' : r === 'hinder' ? 'hinder' : 'spell';
}

/** Type line printed under the illustration: what the card is and when it can be played. */
export function cardTypeLine(id: string): string {
  const f = cardFrame(id);
  if (f === 'artifact') return 'Артефакт · на свою Землю';
  const trig = SPELLS[id]?.trigger;
  if (trig === 'courage') return 'Ответ · в свой бой';
  if (trig) return 'Ответ · в чужой ход';
  if (f === 'help' || f === 'hinder') return 'Реакция · в чужой бой';
  const ph = SPELLS[id]?.phases ?? [];
  return ph.length === 1 && ph[0] === 'pre' ? 'Заклятие · до броска' : 'Заклятие · в свой ход';
}

/** The headline number printed in the corner of a card (e.g. «300», «+500», «−1 ♥»), or null. */
export function cardBadge(g: GameState, id: string): string | null {
  const P = (k: string) => g.rules.params[k] ?? 0;
  switch (id) {
    case 'tribute': return g.rules.payMode === 'sum' ? String(P('tribute')) : '1♥';
    case 'bigTribute': return String(P('bigTribute'));
    case 'toll': return String(P('toll'));
    case 'trap': return `−${P('trapDamage') || 1}♥`;
    case 'fireball': return `−${P('fireballDamage') || 1}♥`;
    case 'heal': return `+${P('heal')}`;
    case 'drain': return g.rules.payMode === 'sum' ? String(P('drain')) : '1♥';
    case 'fury': return `+${P('fury')}`;
    case 'aid': return `+${P('aid')}`;
    case 'hex': return `+${P('hex')}`;
    case 'bastion': return `+${P('bastion')}`;
    case 'vein': return String(P('veinIncome') || 300);
    case 'mimic': return `+${P('mimicGift') || 300}`;
    case 'quicksand': return `−${P('quicksand') || 3}`;
    case 'secondWind': return `+${P('secondWind') || 500}`;
    case 'ambush': case 'quake': return '−1♥';
    case 'courage': return `${P('courageWinOn') || 4}–6`;
    case 'forge': return '↑';
  }
  return null;
}

/** Stable ASCII keys for illustrations (used for custom art file names, see src/art/README.md). */
export const LAND_ART_KEY: Record<string, string> = {
  'Тихий Луг': 'meadow', 'Ручьи': 'streams', 'Мельница': 'mill', 'Овечий Холм': 'sheep-hill', 'Старый Мост': 'old-bridge',
  'Опушка': 'forest-edge', 'Грибная Чаща': 'mushroom-thicket', 'Волчья Тропа': 'wolf-trail', 'Дуб Шептун': 'whisper-oak', 'Сердце Леса': 'forest-heart',
  'Перевал': 'pass', 'Рудники': 'mines', 'Орлиное Гнездо': 'eagle-nest', 'Ледник': 'glacier', 'Пик Грома': 'thunder-peak',
  'Пепельный Край': 'ash-land', 'Чёрный Провал': 'black-pit', 'Трон Костей': 'bone-throne', 'Кипящее Озеро': 'boiling-lake', 'Око Бездны': 'abyss-eye',
};

export const REGION_NAMES = ['Долина', 'Лес', 'Горы', 'Бездна'];

/** Chance (in sixths) to roll at least `min` on a d6. */
export function d6Chance(min: number): string {
  const n = Math.max(0, Math.min(6, 7 - min));
  return `${n} из 6`;
}

export const END_REASON: Record<string, string> = {
  'lands-target': 'собрана цель по Землям', 'round-cap': 'лимит раундов', 'last-standing': 'остался последним', 'all-dead': 'никто не выжил',
  'first-death': 'первое выбывание', 'power-target': 'цель по мощи', 'vp-target': 'цель по очкам', region: 'захвачен регион',
};

/** Log line for display: strips the «[р12]» round prefix and names cells instead of numbering them. */
export function prettyLog(g: GameState, line: string): { round: string; text: string } {
  const m = /^\[р(\d+)\]\s*/.exec(line);
  const text = (m ? line.slice(m[0].length) : line).replace(/клетк([аеу]) (\d+)/g, (s, _end: string, n: string) => {
    const c = g.cells[Number(n)];
    if (!c) return s;
    return c.land ? `«${c.land.name}»` : c.type === 'start' ? 'Врата' : 'Перекрёсток';
  }).replace(/^🏆\s*/, '').replace(/\((lands-target|round-cap|last-standing|all-dead|first-death|power-target|vp-target|region)\)/, (_s, r: string) => `(${END_REASON[r] ?? r})`);
  return { round: m?.[1] ?? '', text };
}
