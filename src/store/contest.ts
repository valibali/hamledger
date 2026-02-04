import { defineStore } from 'pinia';
import { toRaw } from 'vue';
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
  ContestSetup,
  ContestSessionSnapshot,
} from '../types/contest';
import { useQrzStore } from './qrz';
import '../types/electron';

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
    score: number;
  };
  dxDisplaySettings: {
    multBg: string;
    multBgOpacity: number;
    multOpacity: number;
    multBlink: boolean;
    regularBg: string;
    regularBgOpacity: number;
    regularOpacity: number;
    workedOpacity: number;
    workedHideMinutes: number;
  };
  activeView: 'contest' | 'voiceKeyer' | 'review';
  setupPending: boolean;
  sessionElapsedMs: number;
  sessionLastStartedAt: number | null;
}

const contestProfiles: ContestProfile[] = [
  {
    id: 'dx',
    name: 'DX Log',
    exchangeType: 'none',
    exchangeFields: [],
    multiplierField: 'country',
  },
  {
    id: 'dxpedition',
    name: 'DXpedition',
    exchangeType: 'none',
    exchangeFields: [],
    multiplierField: 'country',
  },
  {
    id: 'dxserial',
    name: 'DX Serial',
    exchangeType: 'serial',
    exchangeFields: [
      { key: 'rstRecv', label: 'RST R', placeholder: '59', required: true },
      { key: 'serialRecv', label: 'Serial R', placeholder: '001', type: 'number', required: true },
      { key: 'exchangeRecv', label: 'Exch R', placeholder: 'Loc/Region', type: 'text' },
    ],
    serialStartsAt: 1,
    multiplierField: 'country',
  },
  {
    id: 'dxsatellit',
    name: 'DX Satellite',
    exchangeType: 'custom',
    exchangeFields: [
      { key: 'exchangeRecv', label: 'Grid', placeholder: 'JN58', type: 'text', validate: 'grid' },
    ],
    multiplierField: 'grid',
  },
  {
    id: 'vhfdx',
    name: 'VHF DX',
    exchangeType: 'custom',
    exchangeFields: [
      { key: 'exchangeRecv', label: 'Grid', placeholder: 'JN58', type: 'text', validate: 'grid' },
    ],
    multiplierField: 'grid',
  },
  {
    id: 'vhfserial',
    name: 'VHF Serial',
    exchangeType: 'serial',
    exchangeFields: [
      { key: 'rstRecv', label: 'RST R', placeholder: '59', required: false },
      { key: 'serialRecv', label: 'Serial R', placeholder: '001', type: 'number', required: true },
      { key: 'exchangeRecv', label: 'Grid', placeholder: 'JN58', type: 'text', validate: 'grid' },
    ],
    serialStartsAt: 1,
    multiplierField: 'grid',
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

const defaultDxDisplaySettings = {
  multBg: '#ff8c00',
  multBgOpacity: 0.1,
  multOpacity: 1,
  multBlink: true,
  regularBg: '#7fb8ff',
  regularBgOpacity: 0.1,
  regularOpacity: 1,
  workedOpacity: 0.3,
  workedHideMinutes: 10,
};

export const useContestStore = defineStore('contest', {
  state: (): ContestState => ({
    activeSession: null,
    sessions: [],
    qsoDraft: createDraft(),
    recentQsos: [],
    stats: createEmptyStats(),
    contestProfile: contestProfiles.find(profile => profile.id === 'dxserial') || contestProfiles[0],
    serialCounter:
      contestProfiles.find(profile => profile.id === 'dxserial')?.serialStartsAt || 1,
    scoringState: {
      points: 0,
      multipliers: [],
      score: 0,
    },
    dxDisplaySettings: { ...defaultDxDisplaySettings },
    activeView: 'contest',
    setupPending: false,
    sessionElapsedMs: 0,
    sessionLastStartedAt: null,
  }),

  getters: {
    profiles(): ContestProfile[] {
      return contestProfiles;
    },
    sessionElapsed(state): number {
      if (state.activeSession?.status === 'running' && state.sessionLastStartedAt) {
        return state.sessionElapsedMs + (Date.now() - state.sessionLastStartedAt);
      }
      return state.sessionElapsedMs;
    },
    isDraftValid(state): boolean {
      if (!state.qsoDraft.callsign) return false;
      if (!CallsignHelper.isValidCallsign(state.qsoDraft.callsign)) return false;

      if (state.qsoDraft.exchange.serialSent && !/^[0-9]+$/.test(state.qsoDraft.exchange.serialSent)) {
        return false;
      }

      return state.contestProfile.exchangeFields.every(field => {
        const value =
          field.key === 'rstRecv' ? state.qsoDraft.rstRecv : state.qsoDraft.exchange[field.key];

        if (field.required && (!value || value.trim() === '')) return false;
        if (field.type === 'number' && value && !/^[0-9]+$/.test(value)) return false;
        if (field.validate === 'grid' && value) {
          const normalized = value.trim().toUpperCase();
          if (!(normalized.length === 4 || normalized.length === 6)) return false;
        }
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
    setSessions(sessions: ContestSession[]) {
      this.sessions = sessions;
    },
    setActiveView(view: 'contest' | 'voiceKeyer' | 'review') {
      this.activeView = view;
    },
    setDxDisplaySettings(settings: ContestState['dxDisplaySettings']) {
      this.dxDisplaySettings = { ...defaultDxDisplaySettings, ...settings };
    },
    setContestProfile(profileId: string) {
      const profile = contestProfiles.find(item => item.id === profileId);
      if (!profile) return;
      this.contestProfile = profile;
      this.serialCounter = profile.serialStartsAt || 1;
      this.clearDraft();
    },
    loadSessionSnapshot(snapshot: ContestSessionSnapshot) {
      const profile = contestProfiles.find(item => item.id === snapshot.session.profileId);
      if (profile) {
        this.contestProfile = profile;
      }
      this.activeSession = snapshot.session;
      this.sessionElapsedMs = snapshot.sessionElapsedMs;
      this.sessionLastStartedAt = snapshot.sessionLastStartedAt;
      this.serialCounter = snapshot.serialCounter;
      this.scoringState = snapshot.scoringState;
      if (this.scoringState.score === undefined) {
        this.scoringState.score = 0;
      }
      this.recentQsos = snapshot.session.qsos.slice(-20).reverse();
      this.stats = createEmptyStats();
      this.clearDraft();
      this.refreshStats();
      this.setupPending = false;
    },
    async persistActiveSession() {
      try {
        const settings = await window.electronAPI.loadSettings();
        if (!settings) return;
        const nextSettings = { ...settings } as Record<string, unknown>;
        const contestSettings = { ...(nextSettings.contest as Record<string, unknown> | undefined) };
        const safeClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
        const activeSessionRaw = this.activeSession ? safeClone(toRaw(this.activeSession)) : null;
        const sessionsRaw = safeClone(toRaw(this.sessions));
        const scoringStateRaw = safeClone(toRaw(this.scoringState));
        if (this.activeSession) {
          contestSettings.activeSession = {
            session: activeSessionRaw,
            sessionElapsedMs: this.sessionElapsedMs,
            sessionLastStartedAt: this.sessionLastStartedAt,
            serialCounter: this.serialCounter,
            scoringState: scoringStateRaw,
          } satisfies ContestSessionSnapshot;
        } else {
          contestSettings.activeSession = null;
        }
        contestSettings.sessions = sessionsRaw;
        nextSettings.contest = contestSettings;
        await window.electronAPI.saveSettings(nextSettings);
      } catch (error) {
        console.warn('Failed to persist contest session', error);
      }
    },
    setSetupPending(value: boolean) {
      this.setupPending = value;
    },
    enterContestMode() {
      if (this.activeSession && this.activeSession.status !== 'closed') {
        this.setupPending = false;
        return;
      }
      this.exitContestMode();
      this.setupPending = true;
      this.sessionElapsedMs = 0;
      this.sessionLastStartedAt = null;
      this.stats = createEmptyStats();
      this.recentQsos = [];
      this.scoringState = { points: 0, multipliers: [], score: 0 };
      this.clearDraft();
    },
    exitContestMode() {
      if (!this.activeSession) {
        this.setupPending = false;
        return;
      }
      if (this.activeSession.status === 'running') {
        this.pauseSession();
      }
      this.activeSession.status =
        this.activeSession.status === 'running' ? 'paused' : this.activeSession.status;
      this.setupPending = false;
      void this.persistActiveSession();
    },
    createSession(setup: ContestSetup, profileIdOverride?: string) {
      const normalizedSetup: ContestSetup = {
        ...setup,
        multipliers: setup.multipliers ? [...setup.multipliers] : [],
      };
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear());
      const sessionId = `contest-${day}${month}${year}`;
      const profileId =
        profileIdOverride ||
        {
          DX: 'dx',
          DXPEDITION: 'dxpedition',
          DXSERIAL: 'dxserial',
          DXSATELLIT: 'dxsatellit',
          VHFDX: 'vhfdx',
          VHFSERIAL: 'vhfserial',
        }[normalizedSetup.logType] || 'dx';
      this.activeSession = {
        id: sessionId,
        profileId,
        startedAt: undefined,
        qsos: [],
        status: 'idle',
        setup: normalizedSetup,
      };
      this.setContestProfile(profileId);
      const startSerial = Number(normalizedSetup.serialSentStart);
      if (!Number.isNaN(startSerial) && startSerial > 0) {
        this.serialCounter = startSerial;
      }
      this.sessionElapsedMs = 0;
      this.sessionLastStartedAt = null;
      this.stats = createEmptyStats();
      this.recentQsos = [];
      this.scoringState = { points: 0, multipliers: [], score: 0 };
      this.clearDraft();
      this.setupPending = false;
      void this.persistActiveSession();
    },
    updateSessionSetup(setup: ContestSetup) {
      if (!this.activeSession) return;
      const normalizedSetup: ContestSetup = {
        ...setup,
        multipliers: setup.multipliers ? [...setup.multipliers] : [],
      };
      this.activeSession.setup = normalizedSetup;
      const startSerial = Number(normalizedSetup.serialSentStart);
      if (!Number.isNaN(startSerial) && startSerial > 0 && this.activeSession.qsos.length === 0) {
        this.serialCounter = startSerial;
      }
      this.clearDraft();
      void this.persistActiveSession();
    },
    startSession() {
      if (!this.activeSession) return;
      if (this.activeSession.status === 'running') return;
      if (!this.activeSession.startedAt) {
        this.activeSession.startedAt = new Date().toISOString();
      }
      this.activeSession.status = 'running';
      this.sessionLastStartedAt = Date.now();
      void this.persistActiveSession();
    },
    pauseSession() {
      if (!this.activeSession || this.activeSession.status !== 'running') return;
      if (this.sessionLastStartedAt) {
        this.sessionElapsedMs += Date.now() - this.sessionLastStartedAt;
      }
      this.sessionLastStartedAt = null;
      this.activeSession.status = 'paused';
      void this.persistActiveSession();
    },
    stopSession() {
      if (!this.activeSession) return;
      if (this.activeSession.status === 'running') {
        this.pauseSession();
      }
      this.activeSession.status = 'stopped';
      this.activeSession.endedAt = new Date().toISOString();
      void this.persistActiveSession();
    },
    closeSession() {
      if (!this.activeSession) return;
      if (this.activeSession.status === 'running') {
        this.pauseSession();
      }
      this.activeSession.status = 'closed';
      this.activeSession.endedAt = new Date().toISOString();
      this.sessions.unshift(this.activeSession);
      this.activeSession = null;
      this.setupPending = false;
      void this.persistActiveSession();
    },
    loadArchivedSession(session: ContestSession) {
      this.activeSession = { ...session, status: 'paused' };
      const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : 0;
      const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
      this.sessionElapsedMs = startedAt ? Math.max(0, endedAt - startedAt) : 0;
      this.sessionLastStartedAt = null;
      this.serialCounter = this.contestProfile.serialStartsAt || 1;
      this.scoringState = { points: 0, multipliers: [], score: 0 };
      this.recentQsos = session.qsos.slice(-20).reverse();
      this.stats = createEmptyStats();
      this.clearDraft();
      this.refreshStats();
      void this.persistActiveSession();
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
      if (this.contestProfile.exchangeType !== 'none') {
        const startSerial = this.activeSession?.setup.serialSentStart;
        const serial =
          startSerial && /^[0-9]+$/.test(startSerial)
            ? startSerial
            : String(currentSerial).padStart(3, '0');
        exchange.serialSent = serial;
      }
      if (!exchange.exchangeSent) {
        exchange.exchangeSent = this.activeSession?.setup.sentExchange || '';
      }
      if (!exchange.exchangeRecv) {
        exchange.exchangeRecv = '';
      }
      this.qsoDraft.exchange = exchange;
    },
    logQso() {
      if (!this.activeSession || this.activeSession.status !== 'running') return;
      if (!this.isDraftValid) return;

      const rigStore = useRigStore();
      const now = new Date();
      const serialSent = this.qsoDraft.exchange.serialSent
        ? Number(this.qsoDraft.exchange.serialSent)
        : this.serialCounter;
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
      const multiplierFactor = defaultContestRules.computeMultiplierFactor(qso, this.activeSession);
      const mult = defaultContestRules.computeMultipliers(qso, this.activeSession);

      qso.points = points;
      qso.multiplierFactor = multiplierFactor;
      qso.isMult = mult.isMult;
      qso.multValue = mult.value;

      this.activeSession.qsos.push(qso);
      this.recentQsos = this.activeSession.qsos.slice(-20).reverse();

      this.scoringState.points += points;
      this.scoringState.score += points * multiplierFactor;
      if (multiplierFactor > 1) {
        const value = String(multiplierFactor);
        if (!this.scoringState.multipliers.includes(value)) {
          this.scoringState.multipliers.push(value);
        }
      }
      if (mult.isMult && mult.value !== undefined) {
        const value = String(mult.value).toUpperCase();
        if (!this.scoringState.multipliers.includes(value)) {
          this.scoringState.multipliers.push(value);
        }
      }

      if (this.contestProfile.exchangeType === 'serial') {
        if (!Number.isNaN(serialSent) && serialSent >= this.serialCounter) {
          this.serialCounter = serialSent + 1;
        } else {
          this.serialCounter += 1;
        }
      }

      this.refreshStats();
      this.clearDraft();

      const qrzStore = useQrzStore();
      qrzStore.enqueueLookup(qso.callsign);
      void this.persistActiveSession();
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

      const estimatedPoints = qsos.reduce((sum, qso) => sum + (qso.points || 0), 0);
      const multiplierSet = new Set<string>();
      const scoreSum = qsos.reduce((sum, qso) => {
        const factor = defaultContestRules.computeMultiplierFactor(qso, this.activeSession);
        qso.multiplierFactor = factor;
        if (factor > 1) {
          multiplierSet.add(String(factor));
        }
        return sum + (qso.points || 0) * factor;
      }, 0);
      this.scoringState.points = estimatedPoints;
      this.scoringState.multipliers = Array.from(multiplierSet);
      this.scoringState.score = scoreSum;
      const multipliersCount = multiplierSet.size;

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
        estimatedScore: scoreSum || estimatedPoints,
      };
    },
  },
});
