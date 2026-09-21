// Node-only: load a versioned ruleset from /rules/vNNN.json (deep-merged over its parent chain).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_RULES, mergeRules, type RuleSet } from './ruleset.ts';

export const RULES_DIR = join(import.meta.dirname, '..', '..', 'rules');

export function rulesPath(version: string): string {
  return join(RULES_DIR, `${version}.json`);
}

export function loadRules(version: string): RuleSet {
  if (version === 'base') return structuredClone(BASE_RULES);
  const p = rulesPath(version);
  if (!existsSync(p)) throw new Error(`No ruleset ${p}`);
  const raw = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  const parent = raw.parent as string | null;
  const base = parent ? loadRules(parent) : BASE_RULES;
  const merged = mergeRules(base, (raw.overrides ?? {}) as Record<string, unknown>);
  merged.version = version;
  merged.parent = parent;
  merged.title = (raw.title as string) ?? merged.title;
  return merged;
}

export function listVersions(): string[] {
  return readdirSync(RULES_DIR).filter((f) => /^v\d{3}\.json$/.test(f)).map((f) => f.slice(0, 4)).sort();
}
