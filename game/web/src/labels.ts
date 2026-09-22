// Human-readable labels and hints for engine options (presentation only — no rules here).
import type { Decision, GameState, Option } from '../../core/types.ts';
import { ARTIFACTS, SPELLS, cardName } from '../../cards/catalog.ts';
import { effPower, landsOf, power } from '../../core/state.ts';

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
  if (card === 'fireball' || card === 'drain') return g.players[t].name;
  if (card === 'transmute') return `вариант ${t + 1}`;
  const c = g.cells[t];
  if (c.land) return `${c.land.name}${c.land.owner >= 0 ? ` (${g.players[c.land.owner].name})` : ''}`;
  return c.type === 'start' ? 'Врата' : `Перекрёсток (${t})`;
}

export function optionLabel(g: GameState, d: Decision, o: Option): string {
  switch (o.t) {
    case 'done': return d.kind === 'main' ? (g.phase === 'pre' ? '🎲 Бросить кубик' : '✔ Закончить ход') : 'Готово';
    case 'capture': return '🚩 Захватить Землю';
    case 'pass': return d.kind === 'react' ? 'Не вмешиваться' : 'Пройти мимо';
    case 'flee': return '🏃 Бежать (5–6)';
    case 'fight': return '⚔ Драться (6 — победа)';
    case 'token': return `Потерять жетон ${o.value}`;
    case 'pay': return `Отдать жетон ${o.tokens.join('+')}`;
    case 'discard': return `Сбросить «${cardName(o.card)}»`;
    case 'artifact': return `«${cardName(o.card)}» → ${g.cells[o.land].land!.name}`;
    case 'spell': {
      const t = targetLabel(g, o.card, o.target);
      return `✨ ${cardName(o.card)}${t ? ` → ${t}` : ''}`;
    }
    case 'react': return `${o.card === 'aid' ? '🤝' : '💀'} Сыграть «${cardName(o.card)}»`;
    case 'choose': return o.key === 'skip' ? 'Пропустить следующий ход' : 'Отдать 1 жетон';
    case 'exchange': return `Размен ${o.give}`;
  }
  return '?';
}

/** A short hint for the decision (what matters right now). */
export function decisionHint(g: GameState, d: Decision): string {
  const p = g.players[d.player];
  switch (d.kind) {
    case 'capture': return `Ваша мощь больше — Земля ваша, если захотите. Награда: жетон ${g.cells[p.pos].land?.reward ?? 0}.`;
    case 'encounter': return 'Бежать: 2 из 6 без потерь. Драться: 1 из 6 — победа и Земля, иначе −1 жетон. С последним жетоном рискуете всеми Землями!';
    case 'lose': return 'Жетон = жизнь. Обычно отдают самый мелкий, чтобы сохранить мощь.';
    case 'pay': return 'Отдайте один жетон. Мелкий — сохраните мощь, но соперник всё равно получит жетон.';
    case 'discard': return 'В конце хода на руке не больше 3 карт.';
    case 'react': {
      const f = g.players[d.amount ?? 0];
      const l = g.cells[f.pos].land;
      return `${f.name}: мощь ${effPower(f) + f.fightMod} против монстра ${l?.monster ?? '?'}. Подмога +500 ему (и вам 500 при его победе), Помеха +500 монстру.`;
    }
    case 'dilemma': return 'Жетон уйдёт владельцу Заставы; пропуск хода — потеря темпа.';
    case 'main': {
      const target = g.rules.win.landsTargetBy?.[String(g.players.length)] ?? g.rules.win.landsTarget;
      return `У вас ${landsOf(g, p.id).length} из ${target} Земель. Мощь ${power(p)}. ${g.phase === 'pre' ? 'До броска: положите Артефакты, сыграйте ≤1 Заклятие или бросьте кубик.' : 'После хода: Артефакты и Заклятие (если ещё не играли).'}`;
    }
  }
  return '';
}
