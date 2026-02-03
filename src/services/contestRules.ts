import type { ContestQso, ContestSession } from '../types/contest';
import { getMultiplierValue, isMultiplierWorked } from './workedMultService';

export interface ContestRules {
  computePoints(qso: ContestQso, session: ContestSession): number;
  computeMultipliers(
    qso: ContestQso,
    session: ContestSession
  ): { isMult: boolean; value?: string | number };
}

export const defaultContestRules: ContestRules = {
  computePoints(_qso, _session) {
    return 1;
  },
  computeMultipliers(qso, session) {
    const value = getMultiplierValue(qso, session);
    if (!value) {
      return { isMult: false };
    }
    const isMult = !isMultiplierWorked(value, session);
    return { isMult, value };
  },
};
