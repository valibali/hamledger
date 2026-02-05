<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { useContestStore } from '../../store/contest';
import { useQsoStore } from '../../store/qso';
import { useRigStore } from '../../store/rig';
import { useQrzStore } from '../../store/qrz';
import ContestDxClusterStrip from './ContestDxClusterStrip.vue';
import GraylineMap from './GraylineMap.vue';
import DxCluster from '../DxCluster.vue';
import VoiceKeyerHotkeysPanel from '../VoiceKeyerHotkeysPanel.vue';
import ContestSetupModal from '../modals/ContestSetupModal.vue';
import ContestSessionsModal from '../modals/ContestSessionsModal.vue';
import ContestSessionStatsModal from '../modals/ContestSessionStatsModal.vue';
import ContestResumeModal from '../modals/ContestResumeModal.vue';
import ContestStopConfirmModal from '../modals/ContestStopConfirmModal.vue';
import ContestStartSessionModal from '../modals/ContestStartSessionModal.vue';
import ContestStatsCardsModal from '../modals/ContestStatsCardsModal.vue';
import ContestStatsSparkline from './ContestStatsSparkline.vue';
import QsoDetailDialog from '../modals/QsoDetailDialog.vue';
import { usePropClockWeather } from '../../composables/usePropClockWeather';
import { usePropagationColors } from '../../composables/usePropagationColors';
import { CallsignHelper } from '../../utils/callsign';
import { configHelper } from '../../utils/configHelper';
import { MaidenheadLocator } from '../../utils/maidenhead';
import { geocodeLocation } from '../../utils/geocoding';
import { useQsoListFilters } from '../../composables/useQsoListFilters';
import contestCatalogRaw from '../../data/contestCatalog.json';
import { resolveStationLocation } from '../../utils/stationLocation';
import { useRigctldConnectionDialog } from '../../composables/useRigctldConnectionDialog';
import type { ContestQso, ContestSetup, ContestSession, ContestSessionSnapshot } from '../../types/contest';
import type { QsoEntry } from '../../types/qso';
import '../../types/electron';

const contestStore = useContestStore();
const rigStore = useRigStore();
const qrzStore = useQrzStore();
const qsoStore = useQsoStore();
const { open: openRigctldDialog } = useRigctldConnectionDialog();

const contestCatalogMap = new Map(
  (contestCatalogRaw as Array<{ id: string; name: string }>).map(entry => [
    entry.id,
    entry.name,
  ])
);
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
const showRecentFilters = ref(false);
const showSessionStatsFilters = ref(false);
const selectedQsoDetail = ref<QsoEntry | null>(null);
const showQsoDetail = ref(false);

const activeSession = computed(() => contestStore.activeSession);
const draft = computed(() => contestStore.qsoDraft);
const { utcTime, propStore, weatherStore } = usePropClockWeather();
const { kIndexColor, aIndexColor, sfiColor } = usePropagationColors();
const isCatOnline = computed(() => rigStore.isConnected);
const startButtonClass = computed(() => {
  if (activeSession.value?.status === 'running') return 'session-btn-pause';
  return 'session-btn-start';
});
const startButtonBlink = computed(() =>
  activeSession.value?.status === 'idle' || activeSession.value?.status === 'paused'
);

const sessionLabel = computed(() => {
  return activeSession.value?.id ?? 'No active session';
});

const contestTitle = computed(() => {
  return (
    activeSession.value?.setup.contestName ||
    activeSession.value?.setup.contestType ||
    activeSession.value?.setup.logType ||
    'No contest selected'
  );
});

const contestProfileLabel = computed(() => {
  return contestStore.contestProfile?.name || '';
});
const isSessionRunning = computed(() => activeSession.value?.status === 'running');

const qsos = computed(() => activeSession.value?.qsos ?? []);
const qsoTimestamps = computed(() =>
  qsos.value.map(qso => new Date(qso.datetime).getTime()).sort((a, b) => a - b)
);
const sessionStart = computed(() => activeSession.value?.startedAt ?? '');

const qsoSequenceMap = computed(() => {
  const map = new Map<string, number>();
  const list = activeSession.value?.qsos ?? [];
  list.forEach((qso, idx) => {
    const key =
      qso.id ||
      `${qso.callsign || 'qso'}-${qso.datetime || 'time'}-${qso.band || 'band'}-${qso.mode || 'mode'}`;
    map.set(key, idx + 1);
  });
  return map;
});

const getQsoSequence = (qso: ContestQso) => {
  if (!qso) return '--';
  const key =
    qso.id ||
    `${qso.callsign || 'qso'}-${qso.datetime || 'time'}-${qso.band || 'band'}-${qso.mode || 'mode'}`;
  return qsoSequenceMap.value.get(key) ?? '--';
};

const sessionStatsEntries = computed(() => {
  if (!sessionStatsSession.value) return [];
  const sessionId = sessionStatsSession.value.id;
  return qsoStore.allQsos.filter(qso => qso.contestSessionId === sessionId);
});

const sessionStatsSummary = computed(() => {
  const session = sessionStatsSession.value;
  if (!session) return null;
  const entries = sessionStatsEntries.value;
  const totalQsos = entries.length;
  const score = entries.reduce(
    (sum, qso) => sum + (qso.contestPoints || 0) * (qso.contestMultiplierFactor || 1),
    0
  );
  const mults = new Set(
    entries
      .map(qso => String(qso.contestMultiplierFactor || 1))
      .filter(value => value !== '1')
  );
  const start = session.startedAt ? new Date(session.startedAt).getTime() : null;
  const end = session.endedAt
    ? new Date(session.endedAt).getTime()
    : entries.length
      ? new Date(entries[entries.length - 1].datetime).getTime()
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

const formatSessionDate = (value?: string | null) => {
  if (!value || value === 'n/a') return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = date.toISOString().replace('T', ' ').replace('Z', '');
  return iso.slice(0, 19);
};

const extractQsoGrid = (qso: QsoEntry): string | null => {
  const exchange = qso.contestExchange || {};
  const candidates = [
    qso.grid,
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
  return sessionStatsEntries.value
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
      if (cached?.lat !== undefined && cached?.lon !== undefined && (cached.lat || cached.lon)) {
        return {
          lat: cached.lat,
          lon: cached.lon,
          callsign: qso.callsign,
          label: cached.qth || cached.country,
          band: qso.band,
          mode: qso.mode,
        };
      }
      const { label } = resolveStationLocation({
        callsign: qso.callsign,
        qth: cached?.qth,
        country: qso.country || cached?.country,
      });
      const cacheKey = label ? `label:${label.toLowerCase()}` : '';
      const fallback = cacheKey ? sessionStatsGeoCache.value[cacheKey] : null;
      if (fallback) {
        return {
          lat: fallback.lat,
          lon: fallback.lon,
          callsign: qso.callsign,
          label: fallback.label || label,
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

const sessionStatsTimestamps = computed(() =>
  sessionStatsEntries.value
    .map(qso => new Date(qso.datetime).getTime())
    .sort((a, b) => a - b)
);

const sessionStatsSequenceMap = computed(() => {
  const map = new Map<string, number>();
  const list = sessionStatsEntries.value;
  list.forEach((qso, idx) => {
    const key =
      qso._id ||
      `${qso.callsign || 'qso'}-${qso.datetime || 'time'}-${qso.band || 'band'}-${qso.mode || 'mode'}`;
    map.set(key, idx + 1);
  });
  return map;
});

const getSessionSequenceFromEntry = (qso: QsoEntry) => {
  const key =
    qso._id ||
    `${qso.callsign || 'qso'}-${qso.datetime || 'time'}-${qso.band || 'band'}-${qso.mode || 'mode'}`;
  return sessionStatsSequenceMap.value.get(key) ?? '--';
};

const recentQsoList = useQsoListFilters<ContestQso>({
  items: computed(() => contestStore.recentQsos),
  getCallsign: qso => qso.callsign || '',
  getBand: qso => qso.band,
  getMode: qso => qso.mode,
  getDateTime: qso => qso.datetime,
  getSequence: qso => getQsoSequence(qso),
  getSearchText: qso => [
    qso.exchange?.serialRecv || '',
    qso.exchange?.exchangeRecv || '',
    qso.exchange?.region || '',
    qso.exchange?.grid || '',
  ],
});

const sessionStatsQsoList = useQsoListFilters<QsoEntry>({
  items: computed(() => sessionStatsEntries.value),
  getCallsign: qso => qso.callsign || '',
  getBand: qso => qso.band,
  getMode: qso => qso.mode,
  getDateTime: qso => qso.datetime,
  getSequence: qso => getSessionSequenceFromEntry(qso),
  getSearchText: qso => [
    qso.contestExchange?.serialRecv || '',
    qso.contestExchange?.exchangeRecv || '',
    qso.contestExchange?.region || '',
    qso.contestExchange?.grid || '',
  ],
});

const recentBands = computed(() => recentQsoList.bands.value);
const recentModes = computed(() => recentQsoList.modes.value);
const sessionBands = computed(() => sessionStatsQsoList.bands.value);
const sessionModes = computed(() => sessionStatsQsoList.modes.value);

const safeRecentQsos = computed(() =>
  (recentQsoList.sortedItems.value as (ContestQso | undefined)[]).filter(
    (qso): qso is ContestQso => Boolean(qso)
  )
);

const safeSessionStatsQsos = computed(() =>
  (sessionStatsQsoList.sortedItems.value as (QsoEntry | undefined)[]).filter(
    (qso): qso is QsoEntry => Boolean(qso)
  )
);

const toRgba = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(v => v + v).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
};

const recentQsoStyle = (qso?: ContestQso) => {
  if (!qso) return {};
  const settings = contestStore.dxDisplaySettings;
  const isMult = (qso.multiplierFactor || 1) > 1;
  if (isMult) {
    return {
      background: toRgba(settings.multBg, settings.multBgOpacity),
      color: '#ff4d4d',
    };
  }
  return {
    background: toRgba(settings.regularBg, settings.regularBgOpacity),
    color: '#ffffff',
  };
};

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

const toggleStatCard = (key: string, value: boolean) => {
  statCardEnabled.value[key] = value;
};

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
  if (!callsign) return null;
  const key = CallsignHelper.extractBaseCallsign(callsign).toUpperCase();
  return qrzStore.cache[key];
};

const qrzLoading = (callsign: string) => {
  if (!callsign) return false;
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

const getElapsedMs = () => {
  const base = contestStore.sessionElapsedMs || 0;
  if (contestStore.activeSession?.status !== 'running') return base;
  const startedAt = contestStore.activeSession.startedAt
    ? new Date(contestStore.activeSession.startedAt).getTime()
    : null;
  const anchor = contestStore.sessionLastStartedAt ?? startedAt;
  if (!anchor) return base;
  return base + (Date.now() - anchor);
};

const formatSessionClock = () => {
  const diff = getElapsedMs();
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
  if (!contestStore.activeSession) return;
  if (contestStore.activeSession.status !== 'running') {
    contestStore.startSession();
  }
  if (contestStore.activeSession.status !== 'running') return;
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
  contestName: 'General contest',
  contestType: 'DX',
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
  sessionStatsEntries.value.forEach(qso => {
    if (qso.grid || qso.country) return;
    const cached = qrzStore.getCached(qso.callsign);
    if (cached?.grid || cached?.country || cached?.qth) return;
    void qrzStore.enqueueLookup(qso.callsign);
  });
};

const closeSessionStats = () => {
  sessionStatsOpen.value = false;
  sessionStatsSession.value = null;
};

const sessionQsoCountMap = computed(() => {
  const map = new Map<string, number>();
  qsoStore.allQsos.forEach(qso => {
    if (!qso.contestSessionId) return;
    map.set(qso.contestSessionId, (map.get(qso.contestSessionId) ?? 0) + 1);
  });
  return map;
});

const sessionScoreMap = computed(() => {
  const map = new Map<string, number>();
  qsoStore.allQsos.forEach(qso => {
    if (!qso.contestSessionId) return;
    const points = (qso.contestPoints || 0) * (qso.contestMultiplierFactor || 1);
    map.set(qso.contestSessionId, (map.get(qso.contestSessionId) ?? 0) + points);
  });
  return map;
});

const sessionAvgRateMap = computed(() => {
  const map = new Map<string, number>();
  const first: Record<string, number> = {};
  const last: Record<string, number> = {};
  const counts: Record<string, number> = {};
  qsoStore.allQsos.forEach(qso => {
    const sessionId = qso.contestSessionId;
    if (!sessionId) return;
    const time = new Date(qso.datetime).getTime();
    if (!Number.isFinite(time)) return;
    counts[sessionId] = (counts[sessionId] ?? 0) + 1;
    if (first[sessionId] === undefined || time < first[sessionId]) {
      first[sessionId] = time;
    }
    if (last[sessionId] === undefined || time > last[sessionId]) {
      last[sessionId] = time;
    }
  });
  Object.keys(counts).forEach(sessionId => {
    const spanMs = Math.max(0, (last[sessionId] ?? 0) - (first[sessionId] ?? 0));
    const hours = spanMs > 0 ? spanMs / (1000 * 60 * 60) : 0;
    const avgRate = hours > 0 ? Math.round(counts[sessionId] / hours) : counts[sessionId];
    map.set(sessionId, avgRate);
  });
  return map;
});

const getSessionQsoCount = (sessionId: string) => {
  return sessionQsoCountMap.value.get(sessionId) ?? 0;
};

const getSessionScore = (sessionId: string) => {
  return sessionScoreMap.value.get(sessionId) ?? 0;
};

const getSessionAvgRate = (sessionId: string) => {
  return sessionAvgRateMap.value.get(sessionId) ?? 0;
};

const getSessionContestName = (session: ContestSession) => {
  return (
    session.setup.contestName ||
    contestCatalogMap.get(session.setup.contestType || session.setup.logType || '') ||
    contestStore.profiles.find(profile => profile.id === session.profileId)?.name ||
    session.setup.contestType ||
    session.setup.logType
  );
};

const isSessionActive = (session: ContestSession) =>
  session.status === 'running' || session.status === 'paused';

const isSessionCompleted = (session: ContestSession) =>
  session.status === 'closed' || Boolean(session.endedAt);

const openQsoDetail = (qso: QsoEntry) => {
  selectedQsoDetail.value = qso;
  showQsoDetail.value = true;
};

const openQsoDetailByCall = (callsign: string) => {
  const qso = sessionStatsEntries.value.find(entry => entry.callsign === callsign);
  if (!qso) return;
  openQsoDetail(qso);
};

const deleteSession = async (sessionId: string) => {
  const isActive = contestStore.activeSession?.id === sessionId;
  const ok = window.confirm(
    isActive
      ? 'This is the active session. Delete it and all its QSOs?'
      : 'Delete this contest session and its QSOs?'
  );
  if (!ok) return;
  await qsoStore.deleteQsosBySession(sessionId);
  await contestStore.deleteSession(sessionId);
  if (sessionStatsSession.value?.id === sessionId) {
    closeSessionStats();
  }
};

const requestCloseSession = () => {
  if (!contestStore.activeSession) return;
  stopConfirmOpen.value = true;
};

const confirmCloseSession = () => {
  stopConfirmOpen.value = false;
  contestStore.closeSession();
};

const normalizeSessionSetup = (session: ContestSession) => {
  const contestType = session.setup.contestType || session.setup.logType || 'DX';
  return {
    ...session,
    setup: {
      ...session.setup,
      contestType,
      logType: undefined,
    },
  };
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
      contestStore.setSessions(savedSessions.map(normalizeSessionSetup));
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
      resumeSnapshot.value = normalizeSnapshot({
        ...snapshot,
        session: normalizeSessionSetup(snapshot.session),
      });
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
  if (
    contestStore.activeSession?.status === 'running' &&
    !contestStore.sessionLastStartedAt
  ) {
    contestStore.startSession();
  }
});

watchEffect(() => {
  if (!sessionStatsOpen.value) return;
  sessionStatsEntries.value.forEach(qso => {
    const normalized = qrzStore.normalize(qso.callsign);
    if (!normalized) return;
    const cached = qrzStore.getCached(qso.callsign);
    const { label } = resolveStationLocation({
      callsign: qso.callsign,
      qth: cached?.qth,
      country: qso.country || cached?.country,
    });
    if (!label) return;
    const cacheKey = `label:${label.toLowerCase()}`;
    if (sessionStatsGeoCache.value[cacheKey] !== undefined) return;
    sessionStatsGeoCache.value[cacheKey] = null;
    void geocodeLocation(label).then(result => {
      if (!result) return;
      sessionStatsGeoCache.value[cacheKey] = {
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
            <span v-if="contestProfileLabel" class="contest-profile-label">
              ({{ contestProfileLabel }})
            </span>
            <button class="setup-cog" type="button" title="Contest setup" @click="openSetupFromTopbar">
              ⚙
            </button>
          </span>
          <span class="session-sub">Session: {{ sessionLabel }}</span>
          <span class="session-timer">{{ sessionClock }}</span>
        </div>
        <div class="session-controls">
          <button
            class="session-btn session-btn-toggle"
            :class="[startButtonClass, { 'session-btn-blink': startButtonBlink }]"
            :disabled="contestStore.activeSession?.status === 'closed'"
            @click="contestStore.activeSession?.status === 'running' ? contestStore.pauseSession() : handleStartSession()"
          >
            {{
              !contestStore.activeSession
                ? 'Start new'
                : contestStore.activeSession.status === 'running'
                  ? 'Pause'
                  : contestStore.activeSession.status === 'paused'
                    ? 'Resume'
                    : 'Start'
            }}
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
          <button
            class="cat-badge cat-badge-button"
            :class="{ 'cat-badge-offline': !isCatOnline }"
            type="button"
            title="CAT settings"
            @click="openRigctldDialog"
          >
            {{ isCatOnline ? 'CAT ONLINE' : 'CAT OFFLINE' }}
          </button>
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
          <section class="entry-panel panel" :class="{ 'is-disabled': !isSessionRunning }">
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
                :disabled="!isSessionRunning"
                @click="focusLockDisabled = !focusLockDisabled"
              >
                Focus: {{ focusLockDisabled ? 'Off' : 'On' }}
              </button>
              <button
                class="log-btn"
                :disabled="!isSessionRunning || !contestStore.isDraftValid"
                @click="handleLogQso"
              >
                Log (Enter)
              </button>
              <button class="clear-btn" :disabled="!isSessionRunning" @click="contestStore.clearDraft">
                Clear (Esc)
              </button>
              <select
                class="profile-select-inline"
                :value="contestStore.contestProfile.id"
                :disabled="!isSessionRunning"
                @change="contestStore.setContestProfile(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="profile in contestStore.profiles" :key="profile.id" :value="profile.id">
                  {{ profile.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div v-if="!isSessionRunning" class="entry-disabled-note">
          Start the session to enable QSO entry.
        </div>

        <div class="entry-grid">
          <div class="entry-field callsign">
            <label>Callsign</label>
            <input
              ref="callsignInputRef"
              type="text"
              :value="draft.callsign"
              :disabled="!isSessionRunning"
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
                :disabled="!isSessionRunning"
                @input="contestStore.setDraftExchangeField('rstSent', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="entry-field">
              <label>Serial S</label>
              <div class="serial-field">
                <input type="text" :value="draft.exchange.serialSent" readonly :disabled="!isSessionRunning" />
              </div>
            </div>
            <div class="entry-field">
              <label>{{ contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid S' : 'Exch S' }}</label>
              <input
                type="text"
                :value="draft.exchange.exchangeSent"
                :placeholder="contestStore.contestProfile.id === 'dxsatellit' || contestStore.contestProfile.id === 'vhfdx' || contestStore.contestProfile.id === 'vhfserial' ? 'Grid' : 'Loc/Region'"
                readonly
                :disabled="!isSessionRunning"
              />
            </div>
          </div>
          <div v-if="contestStore.contestProfile.exchangeType !== 'none'" class="entry-row">
            <div class="entry-field">
              <label>RST R</label>
              <input
                type="text"
                :value="draft.rstRecv"
                :disabled="!isSessionRunning"
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
                :disabled="!isSessionRunning"
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
                :disabled="!isSessionRunning"
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
          <h2 class="panel-title">Contest Log</h2>
          <span class="panel-sub">Last {{ contestStore.recentQsos.length }}</span>
          <button
            class="panel-action filter-toggle"
            type="button"
            :aria-pressed="showRecentFilters"
            @click="showRecentFilters = !showRecentFilters"
          >
            ⛃
          </button>
        </div>
          <div v-if="showRecentFilters" class="recent-filters">
            <div class="filter-group">
              <label>Search</label>
              <input
                v-model="recentQsoList.filters.searchText"
                class="filter-input"
                type="text"
                placeholder="Call / exch"
                :class="{ 'regex-error': recentQsoList.regexError }"
              />
            </div>
            <div class="filter-group">
              <label>Band</label>
              <select v-model="recentQsoList.filters.selectedBand" class="filter-input">
                <option value="">All</option>
                <option v-for="band in recentBands" :key="band" :value="band">
                  {{ band }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label>Mode</label>
              <select v-model="recentQsoList.filters.selectedMode" class="filter-input">
                <option value="">All</option>
                <option v-for="mode in recentModes" :key="mode" :value="mode">
                  {{ mode }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label>From</label>
              <input v-model="recentQsoList.filters.dateFrom" class="filter-input" type="date" />
            </div>
            <div class="filter-group">
              <label>To</label>
              <input v-model="recentQsoList.filters.dateTo" class="filter-input" type="date" />
            </div>
            <div class="filter-options">
              <label>
                <input type="checkbox" v-model="recentQsoList.filters.useWildcard" />
                Wildcard
              </label>
              <label>
                <input type="checkbox" v-model="recentQsoList.filters.useRegex" />
                Regex
              </label>
              <label>
                <input type="checkbox" v-model="recentQsoList.filters.caseSensitive" />
                Case
              </label>
            </div>
          </div>
          <div class="recent-table">
            <div class="recent-row header">
              <span class="sortable" @click="recentQsoList.sortBy('sequence')">
                #
                <span v-if="recentQsoList.sortKey.value === 'sequence'">
                  {{ recentQsoList.sortOrder.value === 'asc' ? '▲' : '▼' }}
                </span>
              </span>
              <span class="sortable" @click="recentQsoList.sortBy('callsign')">
                Call
                <span v-if="recentQsoList.sortKey.value === 'callsign'">
                  {{ recentQsoList.sortOrder.value === 'asc' ? '▲' : '▼' }}
                </span>
              </span>
              <span class="sortable" @click="recentQsoList.sortBy('band')">
                Band
                <span v-if="recentQsoList.sortKey.value === 'band'">
                  {{ recentQsoList.sortOrder.value === 'asc' ? '▲' : '▼' }}
                </span>
              </span>
              <span class="sortable" @click="recentQsoList.sortBy('mode')">
                Mode
                <span v-if="recentQsoList.sortKey.value === 'mode'">
                  {{ recentQsoList.sortOrder.value === 'asc' ? '▲' : '▼' }}
                </span>
              </span>
              <span>Exch</span>
              <span>OP</span>
            </div>
            <div
              v-for="(qso, index) in safeRecentQsos"
              :key="
                qso?.id ||
                `${qso?.callsign || 'qso'}-${qso?.datetime || 'time'}-${qso?.band || 'band'}-${
                  qso?.mode || 'mode'
                }`
              "
              class="recent-row"
              :style="recentQsoStyle(qso)"
              @click="openQsoDetail(qso)"
            >
              <span class="recent-num">{{ getQsoSequence(qso) }}</span>
            <span class="recent-call">{{ qso.callsign }}</span>
            <span>{{ qso.band }}</span>
            <span>{{ qso.mode }}</span>
            <span>
              {{
                qso.exchange?.serialRecv ||
                qso.exchange?.exchangeRecv ||
                qso.exchange?.region ||
                qso.exchange?.grid ||
                '--'
              }}
            </span>
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
    <section class="hotkeys-strip">
      <VoiceKeyerHotkeysPanel />
    </section>
  </div>

  <ContestStatsCardsModal
    :open="statsModalOpen"
    :cards="statsCards"
    :enabled="statCardEnabled"
    :on-toggle="toggleStatCard"
    :on-close="() => (statsModalOpen = false)"
  />

  <ContestResumeModal
    :open="resumeModalOpen"
    :snapshot="resumeSnapshot"
    :on-close="() => (resumeModalOpen = false)"
    :on-start-new="startNewSession"
    :on-resume="resumeSession"
  />

  <ContestStopConfirmModal
    :open="stopConfirmOpen"
    :on-cancel="() => (stopConfirmOpen = false)"
    :on-confirm="confirmCloseSession"
  />

  <ContestStartSessionModal
    :open="newSessionModalOpen"
    :on-cancel="() => (newSessionModalOpen = false)"
    :on-start-default="startDefaultSession"
    :on-go-to-setup="openSetupFromNewSession"
  />

  <ContestSessionsModal
    :open="sessionsModalOpen"
    :sessions="contestStore.sessions"
    :get-session-contest-name="getSessionContestName"
    :format-session-date="formatSessionDate"
    :get-session-qso-count="getSessionQsoCount"
    :get-session-score="getSessionScore"
    :get-session-avg-rate="getSessionAvgRate"
    :is-session-active="isSessionActive"
    :is-session-completed="isSessionCompleted"
    :on-close="closeSessionsModal"
    :on-export-adif="exportSessionAdif"
    :on-open-stats="openSessionStats"
    :on-delete="deleteSession"
  />

  <ContestSessionStatsModal
    :open="sessionStatsOpen"
    :summary="sessionStatsSummary"
    :timestamps="sessionStatsTimestamps"
    :started-at="sessionStatsSummary?.start ?? ''"
    :map-center="sessionMapCenter"
    :map-points="sessionMapPoints"
    :show-filters="showSessionStatsFilters"
    :filters="sessionStatsQsoList.filters"
    :regex-error="!!sessionStatsQsoList.regexError.value"
    :bands="sessionBands"
    :modes="sessionModes"
    :qsos="safeSessionStatsQsos"
    :sort-key="sessionStatsQsoList.sortKey.value"
    :sort-order="sessionStatsQsoList.sortOrder.value"
    :get-sequence="getSessionSequenceFromEntry"
    :format-date="formatSessionDate"
    :on-close="closeSessionStats"
    :on-toggle-filters="() => (showSessionStatsFilters = !showSessionStatsFilters)"
    :on-sort="sessionStatsQsoList.sortBy"
    :on-qso-click="openQsoDetail"
    :on-map-call-click="openQsoDetailByCall"
  />

  <ContestSetupModal
    :open="contestStore.setupPending"
    :profiles="contestStore.profiles"
    :initial-setup="setupSource === 'reconfig' ? contestStore.activeSession?.setup ?? null : null"
    :initial-profile-id="setupSource === 'reconfig' ? contestStore.activeSession?.profileId ?? null : null"
    :setup-mode="setupSource"
    :on-save="handleSetupSave"
    :on-cancel="handleSetupCancel"
  />

  <QsoDetailDialog
    v-if="selectedQsoDetail"
    :qso="selectedQsoDetail"
    :show="showQsoDetail"
    @close="showQsoDetail = false"
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 1rem);
  min-height: 0;
}

.speed-dial-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 0 0 auto;
  margin-top: auto;
}

.hotkeys-strip {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 0 0 auto;
}

:deep(.contest-right .dx-cluster) {
  background: #1b1b1b;
  border-color: #2c2c2c;
  border-radius: 10px;
  flex: 1 1 auto;
  min-height: 0;
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

.contest-profile-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
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

.session-btn-blink {
  animation: sessionStartPulse 1.1s ease-in-out infinite;
}

@keyframes sessionStartPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
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
  align-items: center;
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

.rig-mode {
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

.cat-badge-button {
  cursor: pointer;
}

.cat-badge-button:hover {
  background: rgba(46, 204, 113, 0.28);
  border-color: rgba(46, 204, 113, 0.85);
}

.cat-badge-offline {
  border-color: rgba(148, 163, 184, 0.6);
  background: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
}

.cat-badge-offline:hover {
  background: rgba(148, 163, 184, 0.28);
  border-color: rgba(148, 163, 184, 0.9);
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

.entry-panel.is-disabled {
  opacity: 0.5;
  pointer-events: none;
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

.entry-disabled-note {
  padding: 0.35rem 0.5rem;
  border-radius: var(--border-radius);
  background: rgba(0, 0, 0, 0.25);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: var(--text-secondary);
  font-size: 0.7rem;
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

.recent-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
  align-items: end;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.75);
}

.filter-toggle {
  margin-left: auto;
  font-size: 0.85rem;
}

.recent-filters .filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.recent-filters .filter-input {
  background: #222;
  border: 1px solid #333;
  border-radius: 6px;
  color: #f2f2f2;
  padding: 0.25rem 0.4rem;
  font-size: 0.75rem;
}

.recent-filters .filter-options {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.8rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
}

.recent-filters .regex-error {
  border-color: rgba(255, 96, 96, 0.7);
}

.recent-row {
  display: grid;
  grid-template-columns: 0.4fr 1.2fr 0.7fr 0.7fr 1fr 1.2fr;
  gap: 0.4rem;
  padding: 0.4rem 0.2rem;
  font-size: 0.85rem;
  border-bottom: 1px solid #242424;
}

.recent-row:not(.header) {
  cursor: pointer;
}

.recent-row:not(.header):hover {
  background: rgba(255, 255, 255, 0.06);
}

.recent-row.header {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9a9a9a;
  border-bottom: 1px solid #333;
}

.recent-row.header .sortable {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.recent-num {
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.7);
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

.panel-action.danger {
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.panel-action.icon {
  width: 28px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
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


.session-row {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #2c2c2c;
  align-items: center;
}

.session-row:last-child {
  border-bottom: none;
}

.session-meta {
  min-width: 0;
}

.session-line {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.72rem;
  color: #b9b9b9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-name {
  color: #f2e2a0;
  font-weight: 600;
  font-size: 0.78rem;
}

.session-subline {
  color: #9a9a9a;
}

.session-dot {
  color: #666;
}

.session-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  flex: 0 0 auto;
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
