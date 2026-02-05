import type { ContestQso, ContestSession } from '../types/contest';
import { getMultiplierValue, isMultiplierWorked } from './workedMultService';
import { TextMatcher } from '../utils/textMatcher';

export interface ContestRules {
  computePoints(qso: ContestQso, session: ContestSession): number;
  computeMultipliers(
    qso: ContestQso,
    session: ContestSession
  ): { isMult: boolean; value?: string | number };
  computeMultiplierFactor(qso: ContestQso, session: ContestSession): number;
}

export const defaultContestRules: ContestRules = {
  computePoints(qso, session) {
    void qso;
    void session;
    return 1;
  },
  computeMultipliers(qso, session) {
    const customRules = session.setup?.multipliers || [];
    let bestValue: string | null = null;
    let bestNumeric = Number.NEGATIVE_INFINITY;
    for (const rule of customRules) {
      if (!rule.pattern || !rule.value) continue;
      if (
        TextMatcher.matches(qso.callsign, rule.pattern, {
          useRegex: false,
          useWildcard: true,
          caseSensitive: false,
        })
      ) {
        const numericValue = Number(rule.value);
        const scoreValue = Number.isNaN(numericValue) ? 0 : numericValue;
        if (scoreValue > bestNumeric) {
          bestNumeric = scoreValue;
          bestValue = rule.value;
        }
      }
    }
    if (bestValue) {
      const isMult = !isMultiplierWorked(bestValue, session);
      return { isMult, value: bestValue };
    }
    const value = getMultiplierValue(qso, session);
    if (!value) {
      return { isMult: false };
    }
    const isMult = !isMultiplierWorked(value, session);
    return { isMult, value };
  },
  computeMultiplierFactor(qso, session) {
    let bestCustom = 1;
    const customRules = session.setup?.multipliers || [];
    for (const rule of customRules) {
      if (!rule.pattern || !rule.value) continue;
      if (
        TextMatcher.matches(qso.callsign, rule.pattern, {
          useRegex: false,
          useWildcard: true,
          caseSensitive: false,
        })
      ) {
        const numericValue = Number(rule.value);
        if (!Number.isNaN(numericValue)) {
          bestCustom = Math.max(bestCustom, numericValue);
        }
      }
    }

    const defaultValue = getMultiplierValue(qso, session);
    const defaultNumeric =
      typeof defaultValue === 'number' ? defaultValue : Number(defaultValue ?? 1);
    const safeDefault = Number.isNaN(defaultNumeric) ? 1 : defaultNumeric;
    return Math.max(1, bestCustom, safeDefault);
  },
};
