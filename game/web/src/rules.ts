// Web-only: the final ruleset, the same file the simulator resolves (rules/resolved/v014.json).
import type { RuleSet } from '../../rules/ruleset.ts';
import resolved from '../../../rules/resolved/v014.json';

export const RULES = resolved as unknown as RuleSet;
