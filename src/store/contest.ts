import { defineStore } from 'pinia';
import { CallsignHelper } from '../utils/callsign';
import { useRigStore } from './rig';
import { defaultContestRules } from '../services/contestRules';
import { isCallsignWorked } from '../services/workedMultService';
import type {
  ContestDraft,
  ContestProfile,
  ContestQso,
  ContestSession,
  ContestStats,
} from '../types/contest';
import { useQrzStore } from './qrz';

interface ContestState {
  activeSession: ContestSession | null;
  sessions: ContestSession[];
  qsoDraft: ContestDraft;
  recentQsos: ContestQso[];
  stats: ContestStats;
  contestProfile: ContestProfile;
  serialCounter: number;
  scoringState: {
    points: number;
    multipliers: string[];
  };
  activeView: 'contest' | 'voiceKeyer' | 'review';
}

const contestProfiles: ContestProfile[] = [
  {
    id: 'generic-serial',
    name: 'Generic Serial',
    exchangeType: 'serial',
    exchangeFields: [
      { key: 'rstRecv', label: 'RST R', placeholder: '59', required: true },
      { key: 'serialRecv', label: 'Serial R', placeholder: '001', type: 'number', required: true },
    ],
    serialStartsAt: 1,
    multiplierField: 'country',
  },
  {
    id: 'region',
    name: 'Region/State',
    exchangeType: 'region',
    exchangeFields: [
      { key: 'rstRecv', label: 'RST R', placeholder: '59', required: true },
      { key: 'region', label: 'Region', placeholder: 'CA/NY/EA', type: 'text', required: true },
    ],
    serialStartsAt: 1,
    multiplierField: 'region',
  },
];

function createEmptyStats(): ContestStats {
  return {
    totalQsos: 0,
    rates: {
      last1: 0,
      last5: 0,
      last10: 0,
      last60: 0,
    },
    sparkline: new Array(12).fill(0),
    estimatedPoints: 0,
    estimatedScore: 0,
  };
}

function createDraft(): ContestDraft {
  return {
    callsign: '',
    rstSent: '59',
    rstRecv: '59',
    exchange: {},
  };
}

export const useContestStore = defineStore('contest', {
  state: (): ContestState => ({
    activeSession: null,
    sessions: [],
    qsoDraft: createDraft(),
    recentQsos: [],
    stats: createEmptyStats(),
    contestProfile: contestProfiles[0],
    serialCounter: contestProfiles[0].serialStartsAt || 1,
    scoringState: {
      points: 0,
      multipliers: [],
    },
    activeView: 'contest',
  }),

  getters: {
    profiles(): ContestProfile[] {
      return contestProfiles;
    },
    isDraftValid(state): boolean {
      if (!state.qsoDraft.callsign) return false;
      if (!CallsignHelper.isValidCallsign(state.qsoDraft.callsign)) return false;

      return state.contestProfile.exchangeFields.every(field => {
        const value =
          field.key === 'rstRecv' ? state.qsoDraft.rstRecv : state.qsoDraft.exchange[field.key];

        if (field.required && (!value || value.trim() === '')) return false;
        if (field.type === 'number' && value && !/^[0-9]+$/.test(value)) return false;
        return true;
      });
    },
    isCallsignWorkedForBand(state): boolean {
      if (!state.activeSession || !state.qsoDraft.callsign) return false;
      const rigStore = useRigStore();
      return isCallsignWorked(
        state.qsoDraft.callsign,
        state.activeSession,
        rigStore.currentBandName || undefined,
        rigStore.currentMode || undefined
      );
    },
  },

  actions: {
    setActiveView(view: 'contest' | 'voiceKeyer' | 'review') {
      this.activeView = view;
    },
    setContestProfile(profileId: string) {
      const profile = contestProfiles.find(item => item.id === profileId);
      if (!profile) return;
      this.contestProfile = profile;
      this.serialCounter = profile.serialStartsAt || 1;
      this.clearDraft();
    },
    enterContestMode() {
      if (this.activeSession) {
        this.exitContestMode();
      }

      const sessionId = `contest-${Date.now()}`;
      this.activeSession = {
        id: sessionId,
        profileId: this.contestProfile.id,
        startedAt: new Date().toISOString(),
        qsos: [],
      };

      this.serialCounter = this.contestProfile.serialStartsAt || 1;
      this.scoringState = { points: 0, multipliers: [] };
      this.stats = createEmptyStats();
      this.recentQsos = [];
      this.clearDraft();
    },
    exitContestMode() {
      if (!this.activeSession) return;
      this.activeSession.endedAt = new Date().toISOString();
      this.sessions.unshift(this.activeSession);
      this.activeSession = null;
    },
    setDraftCallsign(callsign: string) {
      this.qsoDraft.callsign = callsign.toUpperCase();
    },
    setDraftExchangeField(key: string, value: string) {
      if (key === 'rstSent') {
        this.qsoDraft.rstSent = value;
        return;
      }
      if (key === 'rstRecv') {
        this.qsoDraft.rstRecv = value;
        return;
      }
      this.qsoDraft.exchange[key] = value;
    },
    applySpotToDraft(callsign: string) {
      this.setDraftCallsign(callsign);
    },
    clearDraft() {
      const currentSerial = this.serialCounter;
      this.qsoDraft = createDraft();
      const exchange: Record<string, string> = {};
      this.contestProfile.exchangeFields.forEach(field => {
        if (field.key !== 'rstRecv') {
          exchange[field.key] = '';
        }
      });
      exchange.serialSent = String(currentSerial).padStart(3, '0');
      this.qsoDraft.exchange = exchange;
    },
    logQso() {
      if (!this.activeSession) return;
      if (!this.isDraftValid) return;

      const rigStore = useRigStore();
      const now = new Date();
      const serialSent = this.serialCounter;
      const serialRecv = this.qsoDraft.exchange.serialRecv
        ? Number(this.qsoDraft.exchange.serialRecv)
        : undefined;

      const qso: ContestQso = {
        id: `${now.getTime()}-${this.qsoDraft.callsign}`,
        callsign: this.qsoDraft.callsign.toUpperCase(),
        band: rigStore.currentBandName || 'Unknown',
        mode: rigStore.currentMode || 'SSB',
        datetime: now.toISOString(),
        rstSent: this.qsoDraft.rstSent || '59',
        rstRecv: this.qsoDraft.rstRecv || '59',
        exchange: { ...this.qsoDraft.exchange },
        serialSent,
        serialRecv,
        points: 0,
        isMult: false,
      };

      const points = defaultContestRules.computePoints(qso, this.activeSession);
      const mult = defaultContestRules.computeMultipliers(qso, this.activeSession);

      qso.points = points;
      qso.isMult = mult.isMult;
      qso.multValue = mult.value;

      this.activeSession.qsos.push(qso);
      this.recentQsos = this.activeSession.qsos.slice(-20).reverse();

      this.scoringState.points += points;
      if (mult.isMult && mult.value !== undefined) {
        const value = String(mult.value).toUpperCase();
        if (!this.scoringState.multipliers.includes(value)) {
          this.scoringState.multipliers.push(value);
        }
      }

      if (this.contestProfile.exchangeType === 'serial') {
        this.serialCounter += 1;
      }

      this.refreshStats();
      this.clearDraft();

      const qrzStore = useQrzStore();
      qrzStore.enqueueLookup(qso.callsign);
    },
    refreshStats() {
      if (!this.activeSession) return;
      const now = Date.now();
      const qsos = this.activeSession.qsos;
      const total = qsos.length;

      const rateForWindow = (minutes: number) => {
        const windowMs = minutes * 60 * 1000;
        const count = qsos.filter(qso => now - new Date(qso.datetime).getTime() <= windowMs)
          .length;
        return minutes > 0 ? Math.round((count / minutes) * 60) : 0;
      };

      const buckets = new Array(12).fill(0);
      qsos.forEach(qso => {
        const minutesAgo = (now - new Date(qso.datetime).getTime()) / 60000;
        if (minutesAgo > 60) return;
        const minutesSince = 60 - minutesAgo;
        const bucket = Math.min(11, Math.max(0, Math.floor(minutesSince / 5)));
        buckets[bucket] += 1;
      });

      const multipliersCount = this.scoringState.multipliers.length;
      const estimatedPoints = this.scoringState.points;

      this.stats = {
        totalQsos: total,
        rates: {
          last1: rateForWindow(1),
          last5: rateForWindow(5),
          last10: rateForWindow(10),
          last60: rateForWindow(60),
        },
        sparkline: buckets,
        estimatedPoints,
        estimatedScore: multipliersCount ? estimatedPoints * multipliersCount : estimatedPoints,
      };
    },
  },
});
