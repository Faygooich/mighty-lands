// Power Token arithmetic. A token is simultaneously 1 HP, 1 hand slot and money.
import type { RuleSet } from '../rules/ruleset.ts';

export function sum(tokens: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < tokens.length; i++) s += tokens[i];
  return s;
}

export function sortDesc(tokens: number[]): number[] {
  return tokens.sort((a, b) => b - a);
}

/**
 * Greedy decomposition of `amount` into at most `slots` tokens (largest first).
 * Returns the tokens; value that doesn't fit is burned (not returned).
 */
export function decompose(amount: number, slots: number, denoms: readonly number[]): number[] {
  const out: number[] = [];
  let left = amount;
  for (let i = 0; i < denoms.length && slots > out.length; i++) {
    const d = denoms[i];
    while (left >= d && out.length < slots) {
      out.push(d);
      left -= d;
    }
  }
  return out;
}

/**
 * Distinct "minimal covers": multisets of the player's tokens whose sum >= amount
 * such that dropping any token would make the sum < amount.
 * If total < amount the only option is all tokens.
 */
export function paymentOptions(tokens: readonly number[], amount: number): number[][] {
  const total = sum(tokens);
  if (amount <= 0) return [[]];
  if (total <= amount) return [tokens.slice()];
  const n = tokens.length;
  const seen = new Set<string>();
  const out: number[][] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    let s = 0;
    let minTok = Infinity;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        s += tokens[i];
        if (tokens[i] < minTok) minTok = tokens[i];
      }
    }
    if (s < amount || s - minTok >= amount) continue;
    const pick: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(tokens[i]);
    pick.sort((a, b) => b - a);
    const key = pick.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(pick);
    }
  }
  return out;
}

/** Remove one token of each listed value from `tokens` (in place). */
export function removeTokens(tokens: number[], values: readonly number[]): void {
  for (const v of values) {
    const i = tokens.indexOf(v);
    if (i >= 0) tokens.splice(i, 1);
  }
}

/** Resulting tokens after paying `pick` for `amount` (with change per rules). Pure. */
export function afterPayment(tokens: readonly number[], pick: readonly number[], amount: number, rules: RuleSet): number[] {
  const rest = tokens.slice();
  removeTokens(rest, pick);
  const change = sum(pick) - amount;
  if (rules.change && change > 0) {
    for (const t of decompose(change, rules.maxSlots - rest.length, rules.denominations)) rest.push(t);
  }
  return sortDesc(rest);
}

/** All equal-value exchanges of a single token into smaller tokens that fit in free slots. */
export function exchangeOptions(tokens: readonly number[], rules: RuleSet): Array<{ give: number; take: number[] }> {
  const out: Array<{ give: number; take: number[] }> = [];
  const free = rules.maxSlots - tokens.length;
  const seen = new Set<number>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    // split t into smaller denominations (greedy using only smaller ones), must fit in free+1 slots
    const smaller = rules.denominations.filter((d) => d < t);
    const take = decompose(t, free + 1, smaller);
    if (take.length >= 2 && sum(take) === t) out.push({ give: t, take });
  }
  // merge: combine smaller tokens into one larger of equal value
  for (const d of rules.denominations) {
    const pool = tokens.filter((x) => x < d);
    const opts = paymentOptions(pool, d).filter((p) => sum(p) === d && p.length >= 2);
    if (opts.length) out.push({ give: -d, take: opts[0] });
  }
  return out;
}
