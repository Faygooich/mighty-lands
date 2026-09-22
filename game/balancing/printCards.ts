// Generates docs/cards.md — printable texts of every Land/monster and every card of the final ruleset,
// straight from the same data the engine uses (catalog + flavor + rules). Run: node game/balancing/printCards.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from '../rules/load.ts';
import { createGame } from '../core/state.ts';
import { ARTIFACTS, SPELLS } from '../cards/catalog.ts';
import { CARD_FLAVOR, CELL_FLAVOR, LAND_FLAVOR, REGION_FLAVOR } from '../cards/flavor.ts';
import { REGION_NAMES } from '../rules/ruleset.ts';

const version = process.argv[2] ?? 'v029';
const rules = loadRules(version);
const g = createGame(rules, [{ name: 'A', bot: '-' }, { name: 'B', bot: '-' }], 1);
const out: string[] = [];
out.push(`# МОЩНЫЕ ЗЕМЛИ — тексты карт и Земель (правила ${version})`, '');
out.push('Документ сгенерирован из тех же данных, что использует движок (`game/balancing/printCards.ts`). Жирный текст — правило, курсив — просто для смеха.', '');

out.push('## Поле', '');
out.push(`**Врата** — *${CELL_FLAVOR.start}* Прошёл или встал — возьми жетон 100 (если есть свободная ячейка).`, '');
out.push(`**Перекрёсток** — *${CELL_FLAVOR.crossroad}* Ничего не происходит.`, '');

let region = -1;
for (const c of g.cells) {
  const l = c.land;
  if (!l) continue;
  if (l.region !== region) {
    region = l.region;
    out.push(`### ${REGION_NAMES[region]}`, '', `*${REGION_FLAVOR[region]}*`, '');
    out.push('| Земля | Монстр | МОЩЬ | Награда | Земля (текст) | Монстр (текст) |', '|---|---|---|---|---|---|');
  }
  const f = LAND_FLAVOR[l.name];
  out.push(`| **${l.name}** | ${f?.monster ?? '—'} | **${l.baseMonster}** | жетон ${l.reward} | *${f?.landText ?? ''}* | *${f?.monsterText ?? ''}* |`);
  const next = g.cells[c.index + 1];
  if (!next || !next.land) out.push('');
}

const deck = (title: string, spec: Record<string, number>, defs: Record<string, { name: string; text: (gs: typeof g) => string }>) => {
  out.push(`## ${title}`, '');
  out.push('| Карта | Кол-во | Правило | Текст |', '|---|---|---|---|');
  for (const [id, n] of Object.entries(spec)) {
    if (!n) continue;
    out.push(`| **${defs[id].name}** | ${n} | **${defs[id].text(g)}** | *${CARD_FLAVOR[id] ?? ''}* |`);
  }
  out.push('');
};
deck('Артефакты', rules.decks.artifacts, ARTIFACTS);
deck('Заклятия', rules.decks.spells, SPELLS);
out.push('## Вариант «Застава»', '', `| **${ARTIFACTS.outpost.name}** | 5 (вместо Оков) | **${ARTIFACTS.outpost.text(g)}** | *${CARD_FLAVOR.outpost}* |`, '');

writeFileSync(join(import.meta.dirname, '..', '..', 'docs', 'cards.md'), out.join('\n'));
console.log('docs/cards.md written');
