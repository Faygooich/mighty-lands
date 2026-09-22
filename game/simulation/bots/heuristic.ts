// Heuristic bots. Every bot scores each legal option in "power units" and picks the best.
// Styles differ only by weights (Aggressive/Defensive/Economic/Survival) or extra features (Tactical).
import type { Decision, GameState, LandState, Option, PlayerState } from '../../core/types.ts';
import { effPower, hp, landsOf, power, standing, distance } from '../../core/state.ts';
import { afterPayment, exchangeOptions, sum } from '../../core/tokens.ts';
import { ARTIFACTS } from '../../cards/catalog.ts';
import { isLandLeader } from '../../core/engine.ts';
import type { Rng } from '../../core/rng.ts';

export interface Weights {
  power: number;      // value of 1 power point
  hp: number;         // base value of 1 HP (power units)
  land: number;       // multiplier on land value
  attack: number;     // multiplier on harm dealt to opponents
  kill: number;       // bonus for eliminating a player
  artifact: number;   // multiplier on artifact placement value
  risk: number;       // multiplier on expected losses
  spellThreshold: number; // minimum value to cast a spell now
  leaderFocus: number;    // 0..1: weight harm by target's standing
  lookahead: number;      // 0/1: use dice-distribution lookahead for teleport/fury/danger
  capturePassBias: number; // flat value added to "pass" (positive = reluctant capturer)
  payLargest: number;  // >0: prefer paying with large tokens to farm change (exploit)
  noise: number;       // random noise amplitude
  cardPrefs: Record<string, number>; // additive preference per card id
}

export const DEFAULT_WEIGHTS: Weights = {
  power: 1, hp: 400, land: 1, attack: 0.6, kill: 1500, artifact: 1, risk: 1,
  spellThreshold: 30, leaderFocus: 0.5, lookahead: 0, capturePassBias: 0, payLargest: 0, noise: 0, cardPrefs: {},
};

export const PROFILES: Record<string, Partial<Weights>> = {
  aggressive: { attack: 1.6, kill: 3000, land: 1.4, hp: 260, risk: 0.6, spellThreshold: 0, cardPrefs: { fireball: 150, trap: 120, usurp: 150, fury: 80 } },
  defensive: { attack: 0.25, hp: 700, risk: 1.8, land: 0.8, cardPrefs: { guardian: 250, ward: 250, heal: 120, shatter: 120, bastion: 200 } },
  economic: { power: 1.6, land: 1.8, attack: 0.35, hp: 350, cardPrefs: { tribute: 150, bigTribute: 250, drain: 150, toll: 200, transmute: 60 } },
  survival: { hp: 1100, risk: 2.6, land: 0.5, attack: 0.15, power: 0.8, cardPrefs: { heal: 300, ward: 300, teleport: 120, guardian: 100 } },
  tactical: { attack: 0.9, kill: 2500, leaderFocus: 1, lookahead: 1, hp: 450, spellThreshold: 60, land: 1.2 },
};

const fleeP = (g: GameState) => (7 - g.rules.fleeMin) / 6;

/** Probability distribution of movement total for moveDice d6 (index = steps). */
const distCache = new Map<number, number[]>();
export function moveDist(dice: number): number[] {
  let d = distCache.get(dice);
  if (d) return d;
  d = [1];
  for (let k = 0; k < dice; k++) {
    const nd = new Array(d.length + 6).fill(0);
    for (let i = 0; i < d.length; i++) for (let f = 1; f <= 6; f++) nd[i + f] += d[i] / 6;
    d = nd;
  }
  distCache.set(dice, d);
  return d;
}

export class HeuristicBot {
  name: string;
  w: Weights;
  rng: Rng;

  constructor(name: string, w: Partial<Weights>, rng: Rng) {
    this.name = name;
    this.w = { ...DEFAULT_WEIGHTS, ...w, cardPrefs: { ...(w.cardPrefs ?? {}) } };
    this.rng = rng;
  }

  choose = (g: GameState, d: Decision): number => {
    const me = g.players[d.player];
    let best = 0;
    let bestV = -Infinity;
    for (let i = 0; i < d.options.length; i++) {
      let v = this.score(g, me, d, d.options[i]);
      if (this.w.noise) v += (this.rng.float() - 0.5) * this.w.noise;
      if (v > bestV) { bestV = v; best = i; }
    }
    return best;
  };

  // ---- valuation helpers ----------------------------------------------------

  hpVal(p: PlayerState, delta = 0): number {
    const h = Math.max(1, hp(p) + delta);
    return this.w.hp * (1 + 2 / h);
  }

  landVal(g: GameState, l: LandState): number {
    const r = g.rules;
    const incomeBonus = r.incomePerLand * 3;
    let v = 450 + 0.3 * l.baseMonster + incomeBonus + (l.owner === -1 ? l.reward * this.w.power : 0);
    if (r.win.landsTarget || r.win.landsTargetBy) v += 900;
    if (r.win.vpTarget) v += 700 + (r.params.vpPerRegionTier ?? 0) * l.region * 500;
    if (r.win.regionWin || r.params.vpRegionBonus || r.params.setSize) {
      let mine = 0;
      let size = 0;
      for (const c of g.cells) if (c.land && c.land.region === l.region) { size++; if (c.land.owner === g.current) mine++; }
      v += 400 * (mine / size) * (r.win.regionWin ? 3 : 1) + (r.params.setSize && mine + 1 === r.params.setSize ? 500 : 0);
    }
    return v * this.w.land;
  }

  /** Expected cost (power units) to `v` of artifact `art` owned by `o`. */
  artHarm(g: GameState, art: string, v: PlayerState, o: PlayerState): number {
    const P = g.rules.params;
    let harm: number;
    switch (art) {
      case 'tribute': harm = Math.min(P.tribute, power(v)) * this.w.power + (P.tribute >= power(v) ? this.w.kill : 0); break;
      case 'bigTribute': harm = Math.min(P.bigTribute, power(v)) * this.w.power + (P.bigTribute >= power(v) ? this.w.kill : 0); break;
      case 'toll': harm = (P.toll ?? 0) * 2 * this.w.power; break;
      case 'trap': harm = hp(v) <= (P.trapDamage || 1) ? this.w.kill + 800 : this.hpVal(v, -1) * (P.trapDamage || 1); break;
      case 'pickpocket': harm = v.hand.length ? 150 : 0; break;
      case 'shackles': harm = 260; break;
      case 'exile': harm = 180; break;
      default: harm = 0;
    }
    const r = g.rules;
    const canFlee = r.artifactFlee === 'always' || (r.artifactFlee === 'stronger' && effPower(v) > power(o)) || (r.artifactFlee === 'weaker' && effPower(v) < power(o));
    return canFlee ? harm * (1 - fleeP(g)) : harm;
  }

  /** Enemy arrivals per round on `cell` (rough). */
  traffic(g: GameState, me: PlayerState, cell: number): number {
    const dist = moveDist(g.rules.moveDice);
    const avg = 3.5 * g.rules.moveDice;
    let t = 0;
    for (const q of g.players) {
      if (!q.alive || q.id === me.id) continue;
      const d = distance(g, q.pos, cell);
      t += 0.5 * (dist[d] ?? 0) + 0.5 / avg;
    }
    return t;
  }

  /** Value for `p` of landing on `cell` with effective power `eff`. */
  cellValue(g: GameState, p: PlayerState, cell: number, eff: number): number {
    const c = g.cells[cell];
    if (!c.land) return 0;
    const l = c.land;
    const r = g.rules;
    if (l.owner === -1) {
      if (r.params.crown && isLandLeader(g, p)) eff -= r.params.crown;
      if (eff > l.monster || (r.tieWins && eff === l.monster)) return Math.max(0, this.landVal(g, l) - this.captureCost(g, l));
      const lossV = hp(p) <= 1 ? this.w.kill + 1000 : this.hpVal(p, -1);
      return -(1 - fleeP(g)) * lossV * this.w.risk;
    }
    if (l.owner === p.id) return 0;
    const o = g.players[l.owner];
    let v = 0;
    if (r.landChallenge && eff > l.baseMonster * r.ownedDefenceFrac) v += this.landVal(g, l) * 0.8;
    else if (l.artifact) v -= this.artHarm(g, l.artifact, p, o) * this.w.risk;
    else if (r.params.setTribute && r.params.setSize) {
      let n = 0;
      for (const c of g.cells) if (c.land && c.land.owner === o.id && c.land.region === l.region) n++;
      if (n >= r.params.setSize) v -= this.artHarm(g, 'tribute', p, o) * this.w.risk;
    }
    return v;
  }

  expectedMove(g: GameState, p: PlayerState, eff: number): number {
    const dist = moveDist(g.rules.moveDice);
    let e = 0;
    const n = g.cells.length;
    for (let s = 1; s < dist.length; s++) {
      if (!dist[s]) continue;
      const cell = (p.pos + s) % n;
      let v = this.cellValue(g, p, cell, eff);
      if (p.pos + s >= n && hp(p) < g.rules.maxSlots) v += g.rules.startIncome * this.w.power + this.hpVal(p) * 0.5;
      e += dist[s] * v;
    }
    return e;
  }

  captureCost(g: GameState, l: LandState): number {
    return Math.ceil((l.baseMonster * g.rules.captureCostFrac) / 100) * 100 * this.w.power;
  }

  threat(g: GameState, t: PlayerState): number {
    const lf = this.w.leaderFocus;
    let avg = 0;
    let n = 0;
    for (const q of g.players) if (q.alive) { avg += standing(g, q); n++; }
    avg /= Math.max(1, n);
    const rel = standing(g, t) / Math.max(1, avg);
    return 1 - lf + lf * rel;
  }

  harmPlayer(g: GameState, t: PlayerState, hpLoss: number, powerLoss: number): number {
    let v = powerLoss * 0.6;
    if (hpLoss > 0) v += hp(t) <= hpLoss ? this.w.kill + 600 : 350 * hpLoss;
    return v * this.w.attack * this.threat(g, t);
  }

  cardValue(g: GameState, me: PlayerState, card: string): number {
    const pref = this.w.cardPrefs[card] ?? 0;
    const P = g.rules.params;
    const base: Record<string, number> = {
      tribute: P.tribute * 0.6, bigTribute: P.bigTribute * 0.6, trap: 400, pickpocket: 150, shackles: 220, exile: 150, guardian: 120,
      bastion: 180, toll: 300, fireball: 450, heal: 380, shatter: 250, usurp: 520, teleport: 300, fury: 260, release: 350, drain: 320,
      ward: 280, transmute: 120, aid: 250, hex: 280,
    };
    let v = (base[card] ?? 100) + pref;
    if (ARTIFACTS[card] && landsOf(g, me.id).length === 0) v *= 0.4; // no outlet yet
    return v;
  }

  // ---- option scoring -------------------------------------------------------

  score(g: GameState, me: PlayerState, d: Decision, o: Option): number {
    const w = this.w;
    const r = g.rules;
    switch (o.t) {
      case 'done': return 0;
      case 'capture': {
        const l = g.cells[me.pos].land!;
        return this.landVal(g, l) - this.captureCost(g, l) - (d.amount && d.amount >= power(me) - 100 ? this.hpVal(me) : 0);
      }
      case 'pass': return w.capturePassBias;
      case 'flee': return -(1 - fleeP(g)) * (hp(me) <= 1 ? w.kill + 1000 : this.hpVal(me, -1)) * w.risk;
      case 'fight': {
        const l = g.cells[me.pos].land!;
        let win = 0;
        const wo = r.params.fightWinOn ?? 0;
        for (let roll = 1; roll <= 6; roll++) if ((wo > 0 && roll >= wo) || effPower(me) + me.fightMod + roll * r.fightRollStep > l.monster) win++;
        const pw = win / 6;
        const loss = hp(me) <= (r.params.fightLossHp || 1) ? w.kill + 1000 : this.hpVal(me, -1) * (r.params.fightLossHp || 1);
        return pw * this.landVal(g, l) - (1 - pw) * loss * w.risk;
      }
      case 'token': return -o.value * w.power;
      case 'pay': {
        if (r.payMode === 'taker' && d.player !== g.current && me.id !== g.current) {
          // I am the receiver choosing an opponent's token (not necessarily my turn): take the biggest
          return o.tokens[0];
        }
        if (r.payMode === 'taker' && me.tokens.indexOf(o.tokens[0]) < 0) return o.tokens[0];
        const amount = d.amount ?? 0;
        const after = afterPayment(me.tokens, o.tokens, amount, r);
        const dh = after.length - me.tokens.length;
        const v = sum(after) * w.power + dh * this.hpVal(me) * (after.length === 0 ? 10 : 1);
        return v + w.payLargest * sum(o.tokens) * 0.01;
      }
      case 'discard': return -this.cardValue(g, me, o.card);
      case 'exchange': {
        const opt = exchangeOptions(me.tokens, r).find((x) => x.give === o.give);
        if (!opt) return -1;
        const dh = o.give > 0 ? opt.take.length - 1 : -(opt.take.length - 1);
        return dh * this.hpVal(me) * 0.9 - 40 - (dh > 0 ? 0 : 200);
      }
      case 'artifact': {
        const l = g.cells[o.land].land!;
        const pref = w.cardPrefs[o.card] ?? 0;
        if (ARTIFACTS[o.card].protects) return 80 + pref + this.landVal(g, l) * 0.05;
        let enemyHarm = 0;
        let n = 0;
        for (const q of g.players) if (q.alive && q.id !== me.id) { enemyHarm += this.artHarm(g, o.card, q, me); n++; }
        enemyHarm /= Math.max(1, n);
        return (40 + enemyHarm * this.traffic(g, me, o.land) * 3 * w.artifact) * (1 + w.attack * 0.2) + pref * 0.3;
      }
      case 'react': {
        const fighter = g.players[d.amount ?? 0];
        const l = g.cells[fighter.pos].land!;
        const bonus = r.params[o.card] ?? 0;
        const eff = effPower(fighter) + fighter.fightMod;
        const wins = (x: number, m: number) => x > m || (r.tieWins && x === m);
        const before = wins(eff, l.monster);
        const sp = o.card === 'aid';
        const after = sp ? wins(eff + bonus, l.monster) : wins(eff, l.monster + bonus);
        if (before === after) return -100; // wasted card
        const theirGain = this.landVal(g, l) * 0.6 + (before ? 0 : (1 - fleeP(g)) * 350);
        const hurt = theirGain * w.attack * this.threat(g, fighter);
        if (sp) return (r.params.aidReward ?? 0) * w.power - hurt * 0.5 - 60;
        return hurt - 60;
      }
      case 'spell': return this.spellValue(g, me, o.card, o.target) + (w.cardPrefs[o.card] ?? 0) * 0.3 - w.spellThreshold;
    }
    return 0;
  }

  spellValue(g: GameState, me: PlayerState, card: string, t: number): number {
    const w = this.w;
    const P = g.rules.params;
    switch (card) {
      case 'fireball': return this.harmPlayer(g, g.players[t], P.fireballDamage || 1, 150);
      case 'drain': {
        const q = g.players[t];
        const paid = Math.min(P.drain, power(q));
        return paid * w.power * 0.8 + this.harmPlayer(g, q, paid >= power(q) ? hp(q) : 0, paid);
      }
      case 'heal': return this.hpVal(me) + P.heal * w.power - (hp(me) >= 4 ? 150 : 0);
      case 'ward': return this.hpVal(me) * 0.45 * w.risk;
      case 'shatter': {
        const l = g.cells[t].land!;
        const o = g.players[l.owner];
        const mine = this.artHarm(g, l.artifact!, me, o) * (w.lookahead ? moveDist(g.rules.moveDice)[distance(g, me.pos, t)] ?? 0 : 0.15) * 3;
        return 120 + mine + 120 * w.attack * this.threat(g, o);
      }
      case 'usurp': {
        const l = g.cells[t].land!;
        return this.landVal(g, l) + this.harmPlayer(g, g.players[l.owner], 0, 300) - (l.artifact ? 0 : 50);
      }
      case 'release': {
        const l = g.cells[t].land!;
        return this.harmPlayer(g, g.players[l.owner], 0, 0.5 * this.landVal(g, l) + (l.artifact ? 250 : 0));
      }
      case 'teleport': {
        const base = w.lookahead ? this.expectedMove(g, me, effPower(me)) : 0;
        const v = this.cellValue(g, me, t, effPower(me));
        return (w.lookahead ? v - base : v * 0.5) - 60;
      }
      case 'fury': {
        if (!w.lookahead) return 90;
        return this.expectedMove(g, me, effPower(me) + (P.fury ?? 0)) - this.expectedMove(g, me, effPower(me));
      }
      case 'transmute': {
        const opt = exchangeOptions(me.tokens, g.rules)[t];
        if (!opt) return -1;
        const dh = opt.give > 0 ? opt.take.length - 1 : -(opt.take.length - 1);
        return dh * this.hpVal(me) * 0.9;
      }
    }
    return 0;
  }
}
