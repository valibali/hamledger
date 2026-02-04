<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { useContestStore } from '../../store/contest';
import { useQsoStore } from '../../store/qso';
import { useRigStore } from '../../store/rig';
import { useQrzStore } from '../../store/qrz';
import { LMap, LTileLayer, LCircleMarker, LTooltip } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import ContestStatsSparkline from './ContestStatsSparkline.vue';
import ContestDxClusterStrip from './ContestDxClusterStrip.vue';
import GraylineMap from './GraylineMap.vue';
import DxCluster from '../DxCluster.vue';
import ContestSetupModal from './ContestSetupModal.vue';
import { usePropClockWeather } from '../../composables/usePropClockWeather';
import { usePropagationColors } from '../../composables/usePropagationColors';
import { CallsignHelper } from '../../utils/callsign';
import { configHelper } from '../../utils/configHelper';
import { MaidenheadLocator } from '../../utils/maidenhead';
import { geocodeLocation } from '../../utils/geocoding';
import type { ContestQso, ContestSetup, ContestSession, ContestSessionSnapshot } from '../../types/contest';
import '../../types/electron';

const contestStore = useContestStore();
const rigStore = useRigStore();
const qrzStore = useQrzStore();
const qsoStore = useQsoStore();

const callsignInputRef = ref<HTMLInputElement | null>(null);
const serialRecvInputRef = ref<HTMLInputElement | null>(null);
const sessionClock = ref('00:00:00');
const focusLockDisabled = ref(false);
const showFocusToggle = ref(false);
const suggestionsOpen = ref(false);
const suggestionIndex = ref(0);
const callsignIndex = ref<string[]>([]);
const bigramIndex = ref<Map<string, string[]>>(new Map());
let timerHandle: number | undefined;
let statsHandle: number | undefined;
const stopConfirmOpen = ref(false);
const resumeModalOpen = ref(false);
const resumeSnapshot = ref<ContestSessionSnapshot | null>(null);
const setupSource = ref<'new' | 'reconfig' | null>(null);
const newSessionModalOpen = ref(false);
const sessionsModalOpen = ref(false);
const sessionStatsOpen = ref(false);
const sessionStatsSession = ref<ContestSession | null>(null);
const sessionStatsGeoCache = ref<Record<string, { lat: number; lon: number; label?: string } | null>>(
  {}
);

const activeSession = computed(() => contestStore.activeSession);
const draft = computed(() => contestStore.qsoDraft);
const { utcTime, propStore, weatherStore } = usePropClockWeather();
const { kIndexColor, aIndexColor, sfiColor } = usePropagationColors();
const isCatOnline = computed(() => rigStore.isConnected);

const sessionLabel = computed(() => {
  return activeSession.value?.id ?? 'No active session';
});

const contestTitle = computed(() => {
  return activeSession.value?.setup.logType || 'No contest selected';
});

const qsos = computed(() => activeSession.value?.qsos ?? []);
const qsoTimestamps = computed(() =>
  qsos.value.map(qso => new Date(qso.datetime).getTime()).sort((a, b) => a - b)
);
const sessionStart = computed(() => activeSession.value?.startedAt ?? '');

const sessionStatsQsos = computed(() => {
  if (!sessionStatsSession.value) return [];
  return [...sessionStatsSession.value.qsos].sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  );
});

const sessionStatsSummary = computed(() => {
  const session = sessionStatsSession.value;
  if (!session) return null;
  const totalQsos = session.qsos.length;
  const score = session.qsos.reduce(
    (sum, qso) => sum + (qso.points || 0) * (qso.multiplierFactor || 1),
    0
  );
  const mults = new Set(
    session.qsos
      .map(qso => String(qso.multiplierFactor || 1))
      .filter(value => value !== '1')
  );
  const start = session.startedAt ? new Date(session.startedAt).getTime() : null;
  const end = session.endedAt
    ? new Date(session.endedAt).getTime()
    : session.qsos.length
      ? new Date(session.qsos[session.qsos.length - 1].datetime).getTime()
      : null;
  const durationHours =
    start && end && end > start ? (end - start) / (1000 * 60 * 60) : 0;
  const avgRate = durationHours > 0 ? Math.round(totalQsos / durationHours) : 0;
  return {
    totalQsos,
    score,
    mults: mults.size,
    avgRate,
    start: session.startedAt || 'n/a',
    end: session.endedAt || 'n/a',
  };
});

const extractQsoGrid = (qso: ContestQso): string | null => {
  const exchange = qso.exchange || {};
  const candidates = [
    exchange.grid,
    exchange.exchangeRecv,
    exchange.exchangeSent,
    exchange.region,
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (MaidenheadLocator.isValidLocatorFormat(candidate)) {
      return MaidenheadLocator.normalizeLocator(candidate);
    }
  }
  return null;
};

const sessionMapPoints = computed(() => {
  const session = sessionStatsSession.value;
  if (!session) return [];
  return session.qsos
    .map(qso => {
      const grid = extractQsoGrid(qso);
      if (grid) {
        const coords = MaidenheadLocator.gridToLatLon(grid);
        return {
          ...coords,
          callsign: qso.callsign,
          label: grid,
          band: qso.band,
          mode: qso.mode,
        };
      }
      const cached = qrzStore.getCached(qso.callsign);
      if (cached?.lat !== undefined && cached?.lon !== undefined && (cached.lat || cached.lon)) {
        return {
          lat: cached.lat,
          lon: cached.lon,
          callsign: qso.callsign,
          label: cached.qth,
          band: qso.band,
          mode: qso.mode,
        };
      }
      if (cached?.grid && MaidenheadLocator.isValidLocatorFormat(cached.grid)) {
        const coords = MaidenheadLocator.gridToLatLon(cached.grid);
        return {
          ...coords,
          callsign: qso.callsign,
          label: cached.grid,
          band: qso.band,
          mode: qso.mode,
        };
      }
      const key = qrzStore.normalize(qso.callsign);
      const fallback = sessionStatsGeoCache.value[key];
      if (fallback) {
        return {
          lat: fallback.lat,
          lon: fallback.lon,
          callsign: qso.callsign,
          label: fallback.label,
          band: qso.band,
          mode: qso.mode,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{
    lat: number;
    lon: number;
    callsign: string;
    label?: string;
    band: string;
    mode: string;
  }>;
});

const sessionMapCenter = computed<[number, number]>(() => {
  if (!sessionMapPoints.value.length) return [20, 0];
  const sum = sessionMapPoints.value.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lon += point.lon;
      return acc;
    },
    { lat: 0, lon: 0 }
  );
  return [sum.lat / sessionMapPoints.value.length, sum.lon / sessionMapPoints.value.length];
});

const rateFromLastN = (count: number) => {
  const list = qsos.value;
  if (list.length < 2) return 0;
  const slice = list.slice(-count);
  if (slice.length < 2) return 0;
  const start = new Date(slice[0].datetime).getTime();
  const end = new Date(slice[slice.length - 1].datetime).getTime();
  const minutes = Math.max(1 / 60, (end - start) / 60000);
  return Math.round((slice.length / minutes) * 60);
};

const rateLastHour = computed(() => {
  const now = Date.now();
  const count = qsos.value.filter(qso => now - new Date(qso.datetime).getTime() <= 3600000)
    .length;
  return Math.round((count / 60) * 60);
});

const thisHourRate = computed(() => {
  const now = new Date();
  const hourStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0)
  ).getTime();
  const elapsedMinutes = Math.max(1 / 60, (Date.now() - hourStart) / 60000);
  const count = qsos.value.filter(qso => new Date(qso.datetime).getTime() >= hourStart).length;
  return Math.round((count / elapsedMinutes) * 60);
});

const last10QsoRate = computed(() => rateFromLastN(10));
const last100QsoRate = computed(() => rateFromLastN(100));
const multiplierCount = computed(() => contestStore.scoringState.multipliers.length);

const rateForWindow = (minutes: number) => {
  const now = Date.now();
  const windowMs = minutes * 60 * 1000;
  const count = qsos.value.filter(qso => now - new Date(qso.datetime).getTime() <= windowMs)
    .length;
  return minutes > 0 ? Math.round((count / minutes) * 60) : 0;
};

const movingAvg20 = computed(() => rateForWindow(20));
const movingAvg30 = computed(() => rateForWindow(30));
const movingAvg60 = computed(() => rateForWindow(60));

const bestRateForWindow = (minutes: number) => {
  const times = qsoTimestamps.value;
  if (!times.length) return 0;
  const windowMs = minutes * 60 * 1000;
  let maxCount = 0;
  let left = 0;
  for (let right = 0; right < times.length; right += 1) {
    while (times[right] - times[left] > windowMs) {
      left += 1;
    }
    const count = right - left + 1;
    if (count > maxCount) maxCount = count;
  }
  return Math.round((maxCount / minutes) * 60);
};

const best10MinRate = computed(() => bestRateForWindow(10));
const bestHourRate = computed(() => bestRateForWindow(60));

const statsModalOpen = ref(false);
const statsCards = computed(() => [
  { key: 'last10', label: 'Last 10 QSOs', value: last10QsoRate.value, unit: 'QSO/h' },
  { key: 'last100', label: 'Last 100 QSOs', value: last100QsoRate.value, unit: 'QSO/h' },
  { key: 'last60', label: 'Last 60 min', value: rateLastHour.value, unit: 'QSO/h' },
  { key: 'thisHour', label: 'This hour', value: thisHourRate.value, unit: 'QSO/h' },
  { key: 'best10', label: 'Best 10 min', value: best10MinRate.value, unit: 'QSO/h' },
  { key: 'best60', label: 'Best hour', value: bestHourRate.value, unit: 'QSO/h' },
  { key: 'avg20', label: 'Avg 20 min', value: movingAvg20.value, unit: 'QSO/h' },
  { key: 'avg30', label: 'Avg 30 min', value: movingAvg30.value, unit: 'QSO/h' },
  { key: 'avg60', label: 'Avg 60 min', value: movingAvg60.value, unit: 'QSO/h' },
  { key: 'mults', label: 'Multipliers', value: multiplierCount.value, unit: 'mult' },
  { key: 'score', label: 'Score', value: contestStore.stats.estimatedScore, unit: 'pts' },
]);

const statCardEnabled = ref(
  Object.fromEntries(statsCards.value.map(card => [card.key, true]))
);

const visibleStatCards = computed(() =>
  statsCards.value.filter(card => statCardEnabled.value[card.key])
);

const frequencyMain = computed(() => rigStore.currentFrequencyParts?.main || '--.--');
const frequencyHz = computed(() => {
  const hz = rigStore.currentFrequencyParts?.hz || '00';
  return hz.slice(0, 2);
});

const kIndexTint = computed(() => kIndexColor(propStore.propData.kIndex));
const aIndexTint = computed(() => aIndexColor(propStore.propData.aIndex));
const sfiTint = computed(() => sfiColor(propStore.propData.sfi));

const qrzInfo = (callsign: string) => {
  const key = CallsignHelper.extractBaseCallsign(callsign).toUpperCase();
  return qrzStore.cache[key];
};

const qrzLoading = (callsign: string) => {
  const key = CallsignHelper.extractBaseCallsign(callsign).toUpperCase();
  return qrzStore.inFlight[key] === true;
};

const buildCallsignIndex = () => {
  const set = new Set<string>();
  qsoStore.allQsos.forEach(qso => {
    if (qso.callsign) {
      set.add(CallsignHelper.extractBaseCallsign(qso.callsign).toUpperCase());
    }
  });
  const list = Array.from(set);
  callsignIndex.value = list;

  const nextBigramIndex = new Map<string, string[]>();
  list.forEach(callsign => {
    if (callsign.length < 2) return;
    const seen = new Set<string>();
    for (let i = 0; i < callsign.length - 1; i += 1) {
      const key = callsign.slice(i, i + 2);
      if (seen.has(key)) continue;
      seen.add(key);
      const bucket = nextBigramIndex.get(key) ?? [];
      bucket.push(callsign);
      nextBigramIndex.set(key, bucket);
    }
  });
  bigramIndex.value = nextBigramIndex;
};

const escapeRegex = (value: string) => value.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

const getSuggestionParts = (callsign: string) => {
  const query = draft.value.callsign.trim().toUpperCase();
  if (query.length < 2) return [{ text: callsign, match: false }];
  if (query.includes('*') || query.includes('?')) return [{ text: callsign, match: false }];
  const source = callsign.toUpperCase();
  const index = source.indexOf(query);
  if (index === -1) return [{ text: callsign, match: false }];
  const before = callsign.slice(0, index);
  const match = callsign.slice(index, index + query.length);
  const after = callsign.slice(index + query.length);
  const parts = [];
  if (before) parts.push({ text: before, match: false });
  parts.push({ text: match, match: true });
  if (after) parts.push({ text: after, match: false });
  return parts;
};

const callsignSuggestions = computed(() => {
  if (!suggestionsOpen.value) return [];
  const query = draft.value.callsign.trim().toUpperCase();
  if (query.length < 2) return [];

  const hasWildcard = query.includes('*') || query.includes('?');
  let matcher: RegExp | null = null;

  if (hasWildcard) {
    const pattern = escapeRegex(query).replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
    matcher = new RegExp(pattern, 'i');
  }

  const sourceList =
    !hasWildcard && query.length >= 2
      ? bigramIndex.value.get(query.slice(0, 2)) ?? callsignIndex.value
      : callsignIndex.value;

  const results = sourceList.filter(callsign => {
    if (!query) return false;
    if (matcher) return matcher.test(callsign);
    return callsign.includes(query);
  });

  return results.slice(0, 10);
});

const applySuggestion = (callsign: string) => {
  contestStore.setDraftCallsign(callsign);
  suggestionsOpen.value = false;
  focusCallsign();
};

const focusCallsign = () => {
  if (!callsignInputRef.value) return;
  callsignInputRef.value.focus();
  const length = callsignInputRef.value.value.length;
  callsignInputRef.value.setSelectionRange(length, length);
};

const formatSessionClock = () => {
  const diff = contestStore.sessionElapsed;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  sessionClock.value = [hours, minutes, seconds]
    .map(val => String(val).padStart(2, '0'))
    .join(':');
};

const isModalOpen = () => {
  return Boolean(
    document.querySelector('dialog[open]') ||
      document.querySelector('[aria-modal="true"]') ||
      document.querySelector('.modal')
  );
};

const isEditableElement = (el: Element | null) => {
  if (!el) return false;
  if (el === callsignInputRef.value) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
};

const isSuggestionElement = (el: Element | null) => {
  if (!el) return false;
  return Boolean((el as HTMLElement).closest('.callsign-suggest'));
};

const focusSuggestion = (index: number) => {
  const items = document.querySelectorAll<HTMLButtonElement>('.callsign-suggest .suggest-item');
  const target = items[index];
  if (target) target.focus();
};

const focusSerialRecv = () => {
  if (serialRecvInputRef.value) {
    serialRecvInputRef.value.focus();
    if (serialRecvInputRef.value.type !== 'number') {
      const length = serialRecvInputRef.value.value.length;
      serialRecvInputRef.value.setSelectionRange(length, length);
    }
  }
};

const insertAtCursor = (input: HTMLInputElement, text: string) => {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const nextValue = input.value.slice(0, start) + text + input.value.slice(end);
  contestStore.setDraftCallsign(nextValue);
  suggestionsOpen.value = true;
  suggestionIndex.value = 0;
  input.value = nextValue;
  const caret = start + text.length;
  input.setSelectionRange(caret, caret);
};

const deleteAtCursor = (input: HTMLInputElement) => {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  if (start === end && start > 0) {
    const nextValue = input.value.slice(0, start - 1) + input.value.slice(end);
    contestStore.setDraftCallsign(nextValue);
    suggestionsOpen.value = true;
    suggestionIndex.value = 0;
    input.value = nextValue;
    input.setSelectionRange(start - 1, start - 1);
  } else if (start !== end) {
    const nextValue = input.value.slice(0, start) + input.value.slice(end);
    contestStore.setDraftCallsign(nextValue);
    suggestionsOpen.value = true;
    suggestionIndex.value = 0;
    input.value = nextValue;
    input.setSelectionRange(start, start);
  }
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (focusLockDisabled.value) return;
  if (contestStore.activeView !== 'contest') return;
  if (isModalOpen()) return;

  const activeEl = document.activeElement as Element | null;
  if (isEditableElement(activeEl) || isSuggestionElement(activeEl)) {
    if (activeEl === callsignInputRef.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const query = draft.value.callsign.trim();
      if (query.length >= 2) {
        suggestionsOpen.value = true;
        if (!callsignSuggestions.value.length) return;
        event.preventDefault();
        suggestionIndex.value =
          event.key === 'ArrowDown'
            ? Math.min(suggestionIndex.value + 1, callsignSuggestions.value.length - 1)
            : Math.max(suggestionIndex.value - 1, 0);
        requestAnimationFrame(() => focusSuggestion(suggestionIndex.value));
        return;
      }
    }
    if (callsignSuggestions.value.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        suggestionIndex.value = Math.min(
          suggestionIndex.value + 1,
          callsignSuggestions.value.length - 1
        );
        focusSuggestion(suggestionIndex.value);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        suggestionIndex.value = Math.max(suggestionIndex.value - 1, 0);
        focusSuggestion(suggestionIndex.value);
        return;
      }
      if (event.key === 'Escape') {
        suggestionsOpen.value = false;
        return;
      }
    }
    if (event.key === 'Enter' && contestStore.isDraftValid) {
      event.preventDefault();
      contestStore.logQso();
      focusCallsign();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      suggestionsOpen.value = false;
      contestStore.clearDraft();
      focusCallsign();
    }
    return;
  }

  const input = callsignInputRef.value;
  if (!input) return;

  if (event.key === 'Enter') {
    if (contestStore.isDraftValid) {
      event.preventDefault();
      contestStore.logQso();
      focusCallsign();
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    suggestionsOpen.value = false;
    contestStore.clearDraft();
    focusCallsign();
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    focusCallsign();
    deleteAtCursor(input);
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (/^[a-zA-Z0-9/]$/.test(event.key)) {
    event.preventDefault();
    focusCallsign();
    insertAtCursor(input, event.key.toUpperCase());
  }
};

const handleCallsignKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const query = draft.value.callsign.trim();
    if (query.length < 2) return;
    if (!callsignSuggestions.value.length) {
      suggestionsOpen.value = true;
      return;
    }
    event.preventDefault();
    suggestionIndex.value =
      event.key === 'ArrowDown'
        ? Math.min(suggestionIndex.value + 1, callsignSuggestions.value.length - 1)
        : Math.max(suggestionIndex.value - 1, 0);
    requestAnimationFrame(() => focusSuggestion(suggestionIndex.value));
    return;
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    const trimmed = draft.value.callsign.trim();
    if (CallsignHelper.isValidCallsign(trimmed)) {
      event.preventDefault();
      suggestionsOpen.value = false;
      focusSerialRecv();
      return;
    }
    if (callsignSuggestions.value.length && suggestionsOpen.value) {
      const selection = callsignSuggestions.value[suggestionIndex.value];
      if (selection) {
        event.preventDefault();
        applySuggestion(selection);
        focusSerialRecv();
      }
    }
  }
};

const handleLogQso = () => {
  if (!contestStore.isDraftValid) return;
  if (!contestStore.activeSession || contestStore.activeSession.status !== 'running') return;
  suggestionsOpen.value = false;
  contestStore.logQso();
  focusCallsign();
};

const handleSetupSave = (setup: ContestSetup, profileId: string) => {
  if (setupSource.value === 'reconfig' && contestStore.activeSession) {
    contestStore.updateSessionSetup(setup);
    contestStore.setContestProfile(profileId);
    setupSource.value = null;
    return;
  }
  contestStore.createSession(setup, profileId);
  contestStore.startSession();
  setupSource.value = null;
};

const handleSetupCancel = () => {
  contestStore.setSetupPending(false);
  setupSource.value = null;
};

const handleStartSession = () => {
  if (!contestStore.activeSession) {
    setupSource.value = 'new';
    contestStore.setSetupPending(true);
    return;
  }
  contestStore.startSession();
};

const normalizeSnapshot = (snapshot: ContestSessionSnapshot): ContestSessionSnapshot => {
  const sessionElapsedMs = snapshot.sessionElapsedMs ?? 0;
  const lastStarted = snapshot.sessionLastStartedAt;
  if (snapshot.session.status === 'running' && lastStarted) {
    return {
      ...snapshot,
      session: { ...snapshot.session, status: 'paused' },
      sessionElapsedMs: sessionElapsedMs + (Date.now() - lastStarted),
      sessionLastStartedAt: null,
    };
  }
  return snapshot;
};

const resumeSession = () => {
  if (!resumeSnapshot.value) return;
  contestStore.loadSessionSnapshot(resumeSnapshot.value);
  void contestStore.persistActiveSession();
  resumeSnapshot.value = null;
  resumeModalOpen.value = false;
};

const startNewSession = () => {
  resumeSnapshot.value = null;
  resumeModalOpen.value = false;
  setupSource.value = 'new';
  contestStore.setSetupPending(true);
  void contestStore.persistActiveSession();
};

const createDefaultSetup = (): ContestSetup => ({
  logType: 'DX',
  modeCategory: 'MIXED',
  operatorCategory: 'SINGLE-OP',
  assistedCategory: 'UNASSISTED',
  powerCategory: 'LOW',
  bandCategory: 'ALL',
  overlayCategory: 'NONE',
  sentExchange: '',
  serialSentStart: '001',
  multipliers: [],
  startTime: new Date().toISOString(),
});

const startDefaultSession = () => {
  contestStore.createSession(createDefaultSetup());
  contestStore.startSession();
  newSessionModalOpen.value = false;
};

const openSetupFromNewSession = () => {
  newSessionModalOpen.value = false;
  setupSource.value = 'new';
  contestStore.setSetupPending(true);
};

const openSetupFromTopbar = () => {
  if (!contestStore.activeSession) {
    setupSource.value = 'new';
  } else {
    setupSource.value = 'reconfig';
  }
  contestStore.setSetupPending(true);
};

const openSessionsModal = () => {
  sessionsModalOpen.value = true;
};

const closeSessionsModal = () => {
  sessionsModalOpen.value = false;
};

const exportSessionAdif = async (sessionId: string) => {
  const session = contestStore.sessions.find(item => item.id === sessionId);
  if (!session) return;
  const qsos = session.qsos.map(qso => ({
    callsign: qso.callsign,
    band: qso.band,
    freqRx: 0,
    mode: qso.mode,
    rstr: qso.rstRecv,
    rstt: qso.rstSent,
    datetime: qso.datetime,
    remark: [
      qso.exchange.serialRecv ? `RR ${qso.exchange.serialRecv}` : null,
      qso.exchange.exchangeRecv ? `EXR ${qso.exchange.exchangeRecv}` : null,
      qso.exchange.serialSent ? `RS ${qso.exchange.serialSent}` : null,
      qso.exchange.exchangeSent ? `EXS ${qso.exchange.exchangeSent}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  }));
  const result = await qsoStore.exportAdif(qsos as any);
  if (!result.success) {
    alert(result.error || 'ADIF export failed');
  }
};

const openSessionStats = (sessionId: string) => {
  const session = contestStore.sessions.find(item => item.id === sessionId);
  if (!session) return;
  sessionStatsSession.value = session;
  sessionStatsOpen.value = true;
  session.qsos.forEach(qso => void qrzStore.enqueueLookup(qso.callsign));
};

const closeSessionStats = () => {
  sessionStatsOpen.value = false;
  sessionStatsSession.value = null;
};

const requestCloseSession = () => {
  if (!contestStore.activeSession) return;
  stopConfirmOpen.value = true;
};

const confirmCloseSession = () => {
  stopConfirmOpen.value = false;
  contestStore.closeSession();
};

onMounted(async () => {
  contestStore.setActiveView('contest');
  focusCallsign();
  formatSessionClock();
  contestStore.refreshStats();
  buildCallsignIndex();

  try {
    await configHelper.initSettings();
  } catch {
    // Ignore config load errors, contest mode can still function
  }

  try {
    const settings = await window.electronAPI.loadSettings();
    const savedSessions = (settings as any)?.contest?.sessions as ContestSession[] | undefined;
    if (savedSessions) {
      contestStore.setSessions(savedSessions);
    }
  } catch {
    // Ignore session load errors
  }

  focusLockDisabled.value =
    configHelper.getSetting(['contest'], 'focusLockDisabled') === true ||
    localStorage.getItem('hamledger:contestFocusLockDisabled') === '1';
  showFocusToggle.value = configHelper.getSetting(['contest'], 'showFocusToggle') === true;

  try {
    const settings = await window.electronAPI.loadSettings();
    const snapshot = (settings as any)?.contest?.activeSession as ContestSessionSnapshot | null;
    if (!contestStore.activeSession && snapshot?.session && snapshot.session.status !== 'closed') {
      resumeSnapshot.value = normalizeSnapshot(snapshot);
      resumeModalOpen.value = true;
      contestStore.setSetupPending(false);
    } else if (!contestStore.activeSession) {
      newSessionModalOpen.value = true;
      contestStore.setSetupPending(false);
    }
  } catch {
    if (!contestStore.activeSession) {
      newSessionModalOpen.value = true;
      contestStore.setSetupPending(false);
    }
  }

  timerHandle = window.setInterval(formatSessionClock, 1000);
  statsHandle = window.setInterval(() => contestStore.refreshStats(), 5000);
  window.addEventListener('keydown', handleGlobalKeydown, { capture: true });
});

onBeforeUnmount(() => {
  if (timerHandle) window.clearInterval(timerHandle);
  if (statsHandle) window.clearInterval(statsHandle);
  window.removeEventListener('keydown', handleGlobalKeydown, true);
});

watchEffect(() => {
  const session = sessionStatsSession.value;
  if (!session) return;
  session.qsos.forEach(qso => {
    const key = qrzStore.normalize(qso.callsign);
    if (!key || sessionStatsGeoCache.value[key] !== undefined) return;
    const cached = qrzStore.getCached(qso.callsign);
    if (!cached?.qth) return;
    sessionStatsGeoCache.value[key] = null;
    void geocodeLocation(cached.qth).then(result => {
      if (!result) return;
      sessionStatsGeoCache.value[key] = {
        lat: result.lat,
        lon: result.lon,
        label: result.display_name,
      };
    });
  });
});

watch(
  () => qsoStore.allQsos.length,
  () => {
    buildCallsignIndex();
  }
);

watch(
  () => draft.value.callsign,
  value => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      suggestionsOpen.value = false;
      suggestionIndex.value = 0;
      return;
    }
    suggestionsOpen.value = true;
    suggestionIndex.value = 0;
  }
);
</script>

<template>
  <div class="contest-mode">
    <div class="contest-topbar panel">
      <div class="topbar-left">
        <div class="session-info">
          <span class="session-label">
            {{ contestTitle }}
            <button class="setup-cog" type="button" title="Contest setup" @click="openSetupFromTopbar">
              ⚙
            </button>
          </span>
          <span class="session-sub">Session: {{ sessionLabel }}</span>
          <span class="session-timer">{{ sessionClock }}</span>
        </div>
        <div class="session-controls">
          <button
            class="session-btn session-btn-start"
            :disabled="contestStore.activeSession?.status === 'running'"
            @click="handleStartSession"
          >
            Start
          </button>
          <button
            class="session-btn session-btn-pause"
            :disabled="contestStore.activeSession?.status !== 'running'"
            @click="contestStore.pauseSession"
          >
            Pause
          </button>
          <button
            class="session-btn session-btn-stop"
            :disabled="!contestStore.activeSession || contestStore.activeSession.status === 'closed'"
            @click="requestCloseSession"
          >
            Stop
          </button>
          <button class="session-btn session-btn-sessions" type="button" @click="openSessionsModal">
            Sessions
          </button>
        </div>
      </div>
      <div class="topbar-center">
        <div class="rig-info">
          <span v-if="isCatOnline" class="cat-badge">CAT</span>
          <span class="rig-frequency">
            <span class="freq-main">{{ frequencyMain }}</span
            ><span class="freq-dot">.</span><span class="freq-hz">{{ frequencyHz }}</span>
            <span class="freq-unit">MHz</span>
          </span>
          <span class="vfo-badge">{{ rigStore.currentVfo || 'VFO' }}</span>
          <span class="rig-mode">{{ rigStore.currentMode }}</span>
        </div>
        <div class="rig-status" :class="rigStore.rigState.ptt ? 'tx' : 'rx'">
          {{ rigStore.rigState.ptt ? 'TX' : 'RX' }}
        </div>
      </div>
      <div class="topbar-right">
        <div class="prop-compact">
          <div class="prop-row" :class="{ 'is-loading': propStore.isLoading }">
            <span class="prop-key">SFI</span>
            <span class="prop-val" :style="{ color: sfiTint }">{{ propStore.propData.sfi }}</span>
            <span class="prop-key">A</span>
            <span class="prop-val" :style="{ color: aIndexTint }">
              {{ propStore.propData.aIndex }}
            </span>
            <span class="prop-key">K</span>
            <span class="prop-val" :style="{ color: kIndexTint }">
              {{ propStore.propData.kIndex }}
            </span>
            <span v-if="propStore.propData.aurora !== undefined" class="prop-key">Aur</span>
            <span v-if="propStore.propData.aurora !== undefined" class="prop-val">
              {{ propStore.propData.aurora ? 'YES' : 'NO' }}
            </span>
          </div>
          <div class="prop-row">
            <span class="prop-key">UTC</span>
            <span class="prop-val">{{ utcTime }}</span>
            <span class="prop-key">WX</span>
            <span class="prop-val" :class="{ 'is-loading': weatherStore.isLoading }">
              {{ weatherStore.weatherInfo }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="contest-body">
      <div class="contest-layout">
        <div class="contest-left">
          <div class="contest-grid">
          <section class="entry-panel panel">
        <div class="entry-header">
          <div>
            <h2 class="panel-title">QSO Entry</h2>
            <p class="entry-hint">Type anywhere to focus callsign · Tab to move · Enter logs</p>
          </div>
          <div class="entry-status">
            <span class="status-pill" :class="contestStore.isDraftValid ? 'ok' : 'warn'">
              {{ contestStore.isDraftValid ? 'Callsign OK' : 'Enter callsign' }}
            </span>
            <span class="status-pill" v-if="contestStore.isCallsignWorkedForBand">
              Worked
            </span>
            <div class="entry-actions">
              <button
                v-if="showFocusToggle"
                class="focus-toggle"
                type="button"
                @click="focusLockDisabled = !focusLockDisabled"
              >
                Focus: {{ focusLockDisabled ? 'Off' : 'On' }}
              </button>
              <button class="log-btn" :disabled="!contestStore.isDraftValid" @click="handleLogQso">
                Log (Enter)
              </button>
              <button class="clear-btn" @click="contestStore.clearDraft">Clear (Esc)</button>
              <select
                class="profile-select-inline"
                :value="contestStore.contestProfile.id"
                @change="contestStore.setContestProfile(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="profile in contestStore.profiles" :key="profile.id" :value="profile.id">
                  {{ profile.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="entry-grid">
          <div class="entry-field callsign">
            <label>Callsign</label>
            <input
              ref="callsignInputRef"
              type="text"
              :value="draft.callsign"
              @input="
                contestStore.setDraftCallsign(($event.target as HTMLInputElement).value);
                suggestionsOpen = true;
                suggestionIndex = 0;
              "
              @keydown="handleCallsignKeydown"
              placeholder="K1ABC"
              class="callsign-input"
            />
            <div v-if="callsignSuggestions.length" class="callsign-suggest">
              <button
                v-for="suggestion in callsignSuggestions"
                :key="suggestion"
                type="button"
                class="suggest-item"
                tabindex="-1"
                :class="{ active: callsignSuggestions[suggestionIndex] === suggestion }"
                @click="applySuggestion(suggestion)"
              >
                <span
                  v-for="(part, index) in getSuggestionParts(suggestion)"
                  :key="`${suggestion}-${index}`"
                  :class="{ 'match-highlight': part.match }"
                >
                  {{ part.text }}
                </span>
              </button>
            </div>
          </div>
          <div v-if="contestStore.contestProfile.exchangeType !== 'none'" class="entry-row">
            <div class="entry-field">
              <label>RST S</label>
              <input
                type="text"
                :value="draft.rstSent"
                @input="contestStore.setDraftExchangeField('rstSent', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="entry-field">
              <label>Serial S</label>
              <div class="serial-field">
                <input type="text" :value="draft.exchange.serialSent" readonly />
              </div>
            </div>
            <div class="entry-field">
              <label>{{ contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid S' : 'Exch S' }}</label>
              <input
                type="text"
                :value="draft.exchange.exchangeSent"
                :placeholder="contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid' : 'Loc/Region'"
                readonly
              />
            </div>
          </div>
          <div v-if="contestStore.contestProfile.exchangeType !== 'none'" class="entry-row">
            <div class="entry-field">
              <label>RST R</label>
              <input
                type="text"
                :value="draft.rstRecv"
                @input="contestStore.setDraftExchangeField('rstRecv', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="entry-field">
              <label>Serial R</label>
              <input
                type="text"
                :value="draft.exchange.serialRecv"
                placeholder="001"
                ref="serialRecvInputRef"
                @input="
                  contestStore.setDraftExchangeField(
                    'serialRecv',
                    ($event.target as HTMLInputElement).value
                  )
                "
              />
            </div>
            <div class="entry-field">
              <label>{{ contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid R' : 'Exch R' }}</label>
              <input
                type="text"
                :value="draft.exchange.exchangeRecv"
                :placeholder="contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid' : 'Loc/Region'"
                @input="
                  contestStore.setDraftExchangeField(
                    'exchangeRecv',
                    ($event.target as HTMLInputElement).value
                  )
                "
              />
            </div>
          </div>
        </div>
      </section>

          <section class="recent-panel panel">
        <div class="panel-header">
          <h2 class="panel-title">Recent QSOs</h2>
          <span class="panel-sub">Last {{ contestStore.recentQsos.length }}</span>
        </div>
        <div class="recent-table">
          <div class="recent-row header">
            <span>Call</span>
            <span>Band</span>
            <span>Mode</span>
            <span>Exch</span>
            <span>Pts</span>
            <span>QRZ</span>
          </div>
          <div
            v-for="qso in contestStore.recentQsos"
            :key="qso.id"
            class="recent-row"
          >
            <span class="recent-call">{{ qso.callsign }}</span>
            <span>{{ qso.band }}</span>
            <span>{{ qso.mode }}</span>
            <span>
              {{
                qso.exchange.serialRecv ||
                qso.exchange.exchangeRecv ||
                qso.exchange.region ||
                qso.exchange.grid ||
                '--'
              }}
            </span>
            <span>{{ (qso.points || 0) * (qso.multiplierFactor || 1) }}</span>
            <span class="qrz-cell">
              <span v-if="qrzLoading(qso.callsign)" class="spinner"></span>
              <span v-else>
                {{ qrzInfo(qso.callsign)?.name || '--' }}
              </span>
            </span>
          </div>
        </div>
      </section>

      <section class="stats-panel panel">
        <div class="panel-header">
          <h2 class="panel-title">Rate & Score</h2>
          <span class="panel-sub">QSOs: {{ contestStore.stats.totalQsos }}</span>
          <button class="panel-action" type="button" @click="statsModalOpen = true">
            Customize
          </button>
        </div>
        <div class="stats-grid compact">
          <div v-for="card in visibleStatCards" :key="card.key" class="stat">
            <span class="stat-label">{{ card.label }}</span>
            <span class="stat-value">
              {{ card.value }}
              <span v-if="card.unit" class="stat-unit">{{ card.unit }}</span>
            </span>
          </div>
        </div>
        <ContestStatsSparkline
          :timestamps="qsoTimestamps"
          :started-at="sessionStart"
        />
      </section>

          <section class="map-panel panel">
        <div class="panel-header">
          <h2 class="panel-title">Grayline Map</h2>
          <span class="panel-sub">Always on screen</span>
        </div>
        <div class="map-shell">
          <GraylineMap />
        </div>
      </section>
          </div>
        </div>
        <div class="contest-right">
          <DxCluster :contest-mode="true" />
        </div>
      </div>
    </div>

    <section class="speed-dial-panel panel">
      <ContestDxClusterStrip @spot-clicked="focusCallsign" />
    </section>
  </div>

  <div v-if="statsModalOpen" class="stats-modal-backdrop" @click="statsModalOpen = false">
    <div class="stats-modal panel" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Rate & Score Cards</h3>
        <button class="panel-action" type="button" @click="statsModalOpen = false">Close</button>
      </div>
      <div class="modal-body">
        <label v-for="card in statsCards" :key="card.key" class="toggle-row">
          <input v-model="statCardEnabled[card.key]" type="checkbox" />
          <span>{{ card.label }}</span>
        </label>
      </div>
    </div>
  </div>

  <div v-if="resumeModalOpen" class="stats-modal-backdrop">
    <div class="stats-modal panel" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Resume contest session?</h3>
      </div>
      <div class="modal-body resume-body">
        <div class="resume-row">
          <span class="resume-key">Log type</span>
          <span class="resume-val">{{ resumeSnapshot?.session.setup.logType }}</span>
        </div>
        <div class="resume-row">
          <span class="resume-key">Status</span>
          <span class="resume-val">{{ resumeSnapshot?.session.status }}</span>
        </div>
        <div class="resume-row">
          <span class="resume-key">QSOs</span>
          <span class="resume-val">{{ resumeSnapshot?.session.qsos.length }}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary" type="button" @click="startNewSession">
          Start New
        </button>
        <button class="modal-primary" type="button" @click="resumeSession">
          Resume
        </button>
      </div>
    </div>
  </div>

  <div v-if="stopConfirmOpen" class="stats-modal-backdrop">
    <div class="stats-modal panel" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Close contest session?</h3>
      </div>
      <div class="modal-body">
        Closing will end this session and remove it from the resume prompt.
      </div>
      <div class="modal-footer">
        <button class="modal-secondary" type="button" @click="stopConfirmOpen = false">
          Cancel
        </button>
        <button class="modal-primary" type="button" @click="confirmCloseSession">
          Close Session
        </button>
      </div>
    </div>
  </div>

  <div v-if="newSessionModalOpen" class="stats-modal-backdrop">
    <div class="stats-modal panel" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Start new contest session?</h3>
      </div>
      <div class="modal-body">
        No active session was found. Would you like to configure a contest setup first?
      </div>
      <div class="modal-footer">
        <button class="modal-secondary" type="button" @click="startDefaultSession">
          Start Default
        </button>
        <button class="modal-primary" type="button" @click="openSetupFromNewSession">
          Go to Setup
        </button>
      </div>
    </div>
  </div>

  <div v-if="sessionsModalOpen" class="stats-modal-backdrop" @click="closeSessionsModal">
    <div class="stats-modal panel sessions-modal" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Contest Sessions</h3>
        <button class="panel-action" type="button" @click="closeSessionsModal">Close</button>
      </div>
      <div class="modal-body sessions-body">
        <div v-if="!contestStore.sessions.length" class="sessions-empty">
          No archived sessions yet.
        </div>
        <div v-for="session in contestStore.sessions" :key="session.id" class="session-row">
          <div class="session-meta">
            <div class="session-name">{{ session.setup.logType }}</div>
            <div class="session-subline">
              {{ session.startedAt || 'n/a' }} → {{ session.endedAt || 'n/a' }}
            </div>
            <div class="session-subline">QSOs: {{ session.qsos.length }}</div>
          </div>
          <div class="session-actions">
            <button class="panel-action" type="button" @click="exportSessionAdif(session.id)">
              Export ADIF
            </button>
            <button class="panel-action" type="button" @click="openSessionStats(session.id)">
              Session statistics
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="sessionStatsOpen" class="stats-modal-backdrop" @click="closeSessionStats">
    <div class="stats-modal panel session-stats-modal" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Session statistics</h3>
        <button class="panel-action" type="button" @click="closeSessionStats">Close</button>
      </div>
      <div class="modal-body session-stats-body">
        <div class="session-stats-summary">
          <div class="stat">
            <span class="stat-label">QSOs</span>
            <span class="stat-value">{{ sessionStatsSummary?.totalQsos ?? 0 }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Score</span>
            <span class="stat-value">{{ sessionStatsSummary?.score ?? 0 }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Multipliers</span>
            <span class="stat-value">{{ sessionStatsSummary?.mults ?? 0 }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Avg rate</span>
            <span class="stat-value">{{ sessionStatsSummary?.avgRate ?? 0 }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Start</span>
            <span class="stat-value">{{ sessionStatsSummary?.start ?? 'n/a' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">End</span>
            <span class="stat-value">{{ sessionStatsSummary?.end ?? 'n/a' }}</span>
          </div>
        </div>
        <div class="session-stats-map">
          <LMap
            :zoom="2"
            :center="sessionMapCenter"
            :use-global-leaflet="false"
            class="leaflet-map"
          >
            <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LCircleMarker
              v-for="point in sessionMapPoints"
              :key="`${point.callsign}-${point.lat}-${point.lon}`"
              :lat-lng="[point.lat, point.lon]"
              :radius="5"
              :color="'#ffa500'"
              :fill-color="'#ffa500'"
              :fill-opacity="0.7"
            >
              <LTooltip>{{ point.callsign }} {{ point.band }} {{ point.mode }}</LTooltip>
            </LCircleMarker>
          </LMap>
          <div v-if="!sessionMapPoints.length" class="map-empty">
            No location data available yet.
          </div>
        </div>
        <div class="session-stats-qsos">
          <div class="session-qso-row header">
            <span>Time</span>
            <span>Call</span>
            <span>Band</span>
            <span>Mode</span>
            <span>Exch</span>
            <span>Score</span>
          </div>
          <div v-for="qso in sessionStatsQsos" :key="qso.id" class="session-qso-row">
            <span>{{ qso.datetime }}</span>
            <span class="session-qso-call">{{ qso.callsign }}</span>
            <span>{{ qso.band }}</span>
            <span>{{ qso.mode }}</span>
            <span>
              {{
                qso.exchange.serialRecv ||
                qso.exchange.exchangeRecv ||
                qso.exchange.region ||
                qso.exchange.grid ||
                '--'
              }}
            </span>
            <span>{{ (qso.points || 0) * (qso.multiplierFactor || 1) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ContestSetupModal
    :open="contestStore.setupPending"
    :profiles="contestStore.profiles"
    :initial-setup="setupSource === 'reconfig' ? contestStore.activeSession?.setup ?? null : null"
    :initial-profile-id="setupSource === 'reconfig' ? contestStore.activeSession?.profileId ?? null : null"
    :setup-mode="setupSource"
    :on-save="handleSetupSave"
    :on-cancel="handleSetupCancel"
  />
</template>

<style scoped>
.contest-mode {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  overflow: hidden;
  font-size: 0.92rem;
  zoom: 0.92;
  --contest-pad: 0.35rem;
  box-sizing: border-box;
}

.contest-layout {
  display: flex;
  gap: 0.6rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.contest-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.contest-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.contest-right {
  width: 300px;
  min-width: 300px;
  overflow: hidden;
}

.speed-dial-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 0 0 auto;
  margin-top: auto;
}

:deep(.contest-right .dx-cluster) {
  background: #1b1b1b;
  border-color: #2c2c2c;
  border-radius: 10px;
}

.session-stats-modal {
  width: min(1200px, 95vw);
  max-height: 90vh;
}

.session-stats-body {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.6rem;
  max-height: 80vh;
  overflow: hidden;
}

.session-stats-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
}

.session-stats-summary .stat {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-stats-map {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 260px;
}

.session-stats-map .leaflet-map {
  width: 100%;
  height: 100%;
}

.map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.25);
}

.session-stats-qsos {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: auto;
  max-height: 260px;
  display: flex;
  flex-direction: column;
}

.session-qso-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 0.6fr 0.6fr 0.8fr 0.6fr;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.session-qso-row.header {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.03);
}

.session-qso-row:last-child {
  border-bottom: none;
}

.session-qso-call {
  font-weight: 700;
  color: #ffb347;
}

@media (max-width: 1280px) {
  .contest-layout {
    flex-direction: column;
  }

  .contest-right {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 980px) {
  .contest-grid {
    grid-template-columns: 1fr;
  }
}

.contest-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.topbar-left,
.topbar-right,
.topbar-center {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.topbar-center {
  flex: 1;
  justify-content: center;
  gap: 0.6rem;
}

.topbar-right {
  align-items: flex-start;
}

.prop-compact {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-end;
  font-size: 0.75rem;
  color: #cfcfcf;
}

.prop-row {
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
}

.prop-key {
  color: #9a9a9a;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
}

.prop-val {
  color: #f2f2f2;
  font-weight: 600;
}

.is-loading {
  opacity: 0.5;
}


.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-label {
  font-size: 0.85rem;
  color: #f2e2a0;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.setup-cog {
  background: transparent;
  border: none;
  color: #f2e2a0;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
}

.session-sub {
  font-size: 0.75rem;
  color: #9f9f9f;
}

.session-timer {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffa500;
}

.session-controls {
  display: flex;
  gap: 0.4rem;
}

.session-btn {
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #f2f2f2;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}

.session-btn-start {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.6);
  color: #d1fae5;
}

.session-btn-pause {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.6);
  color: #fef3c7;
}

.session-btn-stop {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
  color: #fee2e2;
}

.session-btn-sessions {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.6);
  color: #e2e8f0;
}

.session-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rig-info {
  display: flex;
  gap: 0.5rem;
  font-weight: 700;
  align-items: baseline;
}

.rig-frequency {
  font-weight: 800;
  color: #9bd1ff;
  letter-spacing: 0.04em;
}

.freq-main {
  font-size: 1.45rem;
}

.freq-dot {
  font-size: 0.95rem;
  opacity: 0.8;
}

.freq-hz {
  font-size: 0.85rem;
  opacity: 0.8;
}

.freq-unit {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-left: 0.3rem;
}

.rig-status {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid #3a3a3a;
  font-weight: 700;
  font-size: 0.85rem;
}

.vfo-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid #3a3a3a;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.75rem;
  color: #f2f2f2;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cat-badge {
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  border: 1px solid #2ecc71;
  background: rgba(46, 204, 113, 0.18);
  color: #9bf1c9;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rig-status.tx {
  background: rgba(255, 74, 74, 0.2);
  color: #ff5b5b;
}

.rig-status.rx {
  background: rgba(87, 255, 168, 0.15);
  color: #7bffb0;
}

.log-btn,
.clear-btn {
  background: #2e2e2e;
  color: #fff;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.profile-select-inline {
  background: #2e2e2e;
  color: #fff;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
}

.focus-toggle {
  background: #1f1f1f;
  color: #ffc37a;
  border: 1px dashed #444;
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.log-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contest-grid {
  display: grid;
  grid-template-columns: 1fr 420px;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.6rem;
  height: 100%;
  flex: 1;
  min-height: 0;
}

.entry-panel {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}


.entry-hint {
  font-size: 0.85rem;
  color: #bdbdbd;
}

.entry-status {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.entry-actions {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-left: auto;
}

.status-pill {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid #3a3a3a;
  color: #cfcfcf;
}

.status-pill.ok {
  background: rgba(87, 255, 168, 0.15);
  color: #7bffb0;
}

.status-pill.warn {
  background: rgba(255, 183, 77, 0.2);
  color: #ffc37a;
}

.entry-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.entry-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 0.75rem;
}

.entry-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.serial-field input {
  width: 100%;
}

.entry-field.callsign {
  position: relative;
}

.entry-field label {
  font-size: 0.75rem;
  color: #b9b9b9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.entry-field input {
  background: #2b2b2b;
  color: #fff;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  font-size: 1rem;
}

.callsign {
  width: 100%;
}

.callsign-input {
  font-size: 1.6rem;
  letter-spacing: 0.1em;
  font-weight: 800;
  color: #b8ff8a;
  text-transform: uppercase;
}

.callsign-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: #181818;
  border: 1px solid #2b2b2b;
  border-radius: 6px;
  padding: 0.35rem;
  z-index: 20;
  min-width: 240px;
}

.suggest-item {
  background: #232323;
  border: 1px solid #2f2f2f;
  color: #fff;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  text-align: left;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.match-highlight {
  background: rgba(127, 211, 255, 0.35);
  border-radius: 3px;
  padding: 0 2px;
}

.suggest-item:hover {
  border-color: #ffa500;
  color: #ffa500;
}

.suggest-item.active {
  border-color: #ffa500;
  color: #ffa500;
  background: rgba(255, 165, 0, 0.15);
}

.recent-panel {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: hidden;
}

.panel-sub {
  color: #9a9a9a;
  font-size: 0.8rem;
}

.recent-table {
  display: grid;
  gap: 0.4rem;
  overflow-y: auto;
}

.recent-row {
  display: grid;
  grid-template-columns: 1.2fr 0.7fr 0.7fr 1fr 0.5fr 1.2fr;
  gap: 0.4rem;
  padding: 0.4rem 0.2rem;
  font-size: 0.85rem;
  border-bottom: 1px solid #242424;
}

.recent-row.header {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9a9a9a;
  border-bottom: 1px solid #333;
}

.recent-call {
  font-weight: 700;
  color: #fff;
}

.qrz-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffa500;
  animation: spin 0.8s linear infinite;
}

.stats-panel {
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.stats-grid.compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.stat {
  background: #222;
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  border: 1px solid #2f2f2f;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-height: 64px;
}

.stat-label {
  font-size: 0.7rem;
  color: #9f9f9f;
  text-transform: uppercase;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f5f5f5;
  margin-top: auto;
  display: flex;
  align-items: baseline;
}

.stat-unit {
  font-size: 0.7rem;
  color: #9a9a9a;
  margin-left: 0.25rem;
  font-weight: 500;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: space-between;
}

.panel-action {
  margin-left: auto;
  background: #2c2c2c;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #e6e6e6;
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}

.stats-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2200;
}

.stats-modal {
  width: min(420px, 90vw);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-header,
.modal-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.modal-body {
  justify-content: space-between;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.modal-primary {
  border-radius: 8px;
  border: 1px solid rgba(46, 204, 113, 0.7);
  background: rgba(46, 204, 113, 0.18);
  color: #9bf1c9;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.modal-secondary {
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #f2f2f2;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.resume-body {
  flex-direction: column;
  width: 100%;
}

.resume-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #d6d6d6;
}

.resume-key {
  color: #8c8c8c;
}

.resume-val {
  color: #f2f2f2;
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #d6d6d6;
  min-width: 45%;
}

.sessions-modal {
  width: min(680px, 92vw);
}

.sessions-body {
  flex-direction: column;
  width: 100%;
}

.sessions-empty {
  font-size: 0.85rem;
  color: #b0b0b0;
}

.session-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #2c2c2c;
}

.session-row:last-child {
  border-bottom: none;
}

.session-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.session-name {
  font-size: 0.9rem;
  color: #f2e2a0;
  font-weight: 600;
}

.session-subline {
  font-size: 0.75rem;
  color: #9a9a9a;
}

.session-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.map-panel {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.map-shell {
  flex: 1;
  min-height: 240px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
