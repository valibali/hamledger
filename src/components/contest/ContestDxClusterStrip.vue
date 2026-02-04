<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { DxSpot } from '../../types/dxCluster';
import { useDxClusterStore } from '../../store/dxCluster';
import { useContestStore } from '../../store/contest';
import { useRigStore } from '../../store/rig';
import { defaultContestRules } from '../../services/contestRules';
import { isCallsignWorked } from '../../services/workedMultService';
import { getCountryCodeForCallsign } from '../../utils/callsign';
import { MaidenheadLocator } from '../../utils/maidenhead';
import { calculateDistance } from '../../utils/distance';
import { configHelper } from '../../utils/configHelper';

const emit = defineEmits<{ (e: 'spot-clicked'): void }>();

const dxStore = useDxClusterStore();
const contestStore = useContestStore();
const rigStore = useRigStore();
const selectedKey = ref<number | null>(null);
const settingsOpen = ref(false);
const speedDialSettings = ref({
  maxCards: 10,
  timeLimitMinutes: 60,
  type: 'topMult' as 'topMult' | 'newest' | 'activeDe' | 'mostReportedDx',
});
const draftSettings = ref({ ...speedDialSettings.value });
const draftDisplaySettings = ref({ ...contestStore.dxDisplaySettings });

const spots = computed(() => dxStore.spots);

const formatFrequency = (freqStr: string) => {
  const freq = parseFloat(freqStr);
  if (Number.isNaN(freq)) return '--';
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(3)} MHz`;
  }
  return `${freq.toFixed(1)} kHz`;
};

const getSpotMeta = (spot: DxSpot) => {
  const session = contestStore.activeSession;
  if (!session) return { worked: false, isMult: false, multValue: '' };
  const band = dxStore.filters.selectedBand || undefined;
  const mode = rigStore.currentMode || undefined;
  const worked = isCallsignWorked(spot.DXCall, session, band, mode);

  const tempQso = {
    id: `spot-${spot.DXCall}-${spot.Frequency}`,
    callsign: spot.DXCall,
    band: band || 'Unknown',
    mode: mode || 'SSB',
    datetime: new Date().toISOString(),
    rstSent: '59',
    rstRecv: '59',
    exchange: {},
    points: 0,
    isMult: false,
  };

  const factor = defaultContestRules.computeMultiplierFactor(tempQso, session);
  return {
    worked,
    isMult: factor > 1,
    multValue: factor > 1 ? factor : '',
  };
};

const handleSpotClick = (spot: DxSpot) => {
  const freqInHz = parseFloat(spot.Frequency) * 1000;
  if (!Number.isNaN(freqInHz)) {
    rigStore.setFrequency(freqInHz);
  }

  let rigMode = spot.Mode || 'USB';
  if (spot.Mode === 'PHONE') {
    const freqKHz = parseFloat(spot.Frequency);
    rigMode = freqKHz < 10000 ? 'LSB' : 'USB';
  } else if (spot.Mode === 'CW') {
    rigMode = 'CW';
  } else if (spot.Mode && (spot.Mode.includes('FT') || spot.Mode === 'RTTY')) {
    rigMode = 'DATA';
  }

  rigStore.setMode(rigMode);
  contestStore.applySpotToDraft(spot.DXCall);
  emit('spot-clicked');
};

const getSpotTime = (spot: DxSpot) => {
  const [day, month, year] = spot.Date.split('/');
  return new Date(`20${year}-${month}-${day}T${spot.Time}:00Z`).getTime();
};

const getSpotAgeMinutes = (spot: DxSpot) => (Date.now() - getSpotTime(spot)) / (1000 * 60);

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

const getSpotDisplay = (spot: DxSpot) => {
  const meta = getSpotMeta(spot);
  const settings = contestStore.dxDisplaySettings;
  if (meta.worked) {
    return {
      meta,
      hidden: getSpotAgeMinutes(spot) > settings.workedHideMinutes,
      opacity: settings.workedOpacity,
      backgroundColor: 'transparent',
      blink: false,
    };
  }
  if (meta.isMult) {
    return {
      meta,
      hidden: false,
      opacity: settings.multOpacity,
      backgroundColor: toRgba(settings.multBg, settings.multBgOpacity),
      blink: settings.multBlink,
    };
  }
  return {
    meta,
    hidden: false,
    opacity: settings.regularOpacity,
    backgroundColor: toRgba(settings.regularBg, settings.regularBgOpacity),
    blink: false,
  };
};

const getSpotCardStyle = (spot: DxSpot, index: number) => {
  const display = getSpotDisplay(spot);
  const selected = selectedKey.value === index;
  return {
    opacity: display.opacity,
    backgroundColor: selected ? 'rgba(34, 197, 94, 0.25)' : display.backgroundColor,
  };
};

const maxCards = computed(() => Math.min(10, Math.max(1, speedDialSettings.value.maxCards)));
const timeLimitMinutes = computed(() =>
  Math.max(1, Number(speedDialSettings.value.timeLimitMinutes) || 1)
);

const rankedSpots = computed(() => {
  const cutoff = Date.now() - timeLimitMinutes.value * 60 * 1000;
  const pool = spots.value
    .map(spot => ({
      spot,
      display: getSpotDisplay(spot),
    }))
    .filter(entry => !entry.display.hidden && getSpotTime(entry.spot) >= cutoff);

  if (speedDialSettings.value.type === 'topMult') {
    return pool
      .filter(entry => entry.display.meta.isMult)
      .sort((a, b) => getSpotTime(b.spot) - getSpotTime(a.spot))
      .map(entry => entry.spot)
      .slice(0, maxCards.value);
  }

  if (speedDialSettings.value.type === 'mostReportedDx') {
    return pool
      .slice()
      .sort((a, b) => {
        const aCount = a.spot.Spotters?.length ?? 0;
        const bCount = b.spot.Spotters?.length ?? 0;
        if (aCount !== bCount) return bCount - aCount;
        return getSpotTime(b.spot) - getSpotTime(a.spot);
      })
      .map(entry => entry.spot)
      .slice(0, maxCards.value);
  }

  if (speedDialSettings.value.type === 'activeDe') {
    const spotterActivity = new Map<string, number>();
    pool.forEach(entry => {
      const spotter = entry.spot.Spotter;
      if (!spotter) return;
      spotterActivity.set(spotter, (spotterActivity.get(spotter) || 0) + 1);
    });

    return pool
      .slice()
      .sort((a, b) => {
        const aCount = spotterActivity.get(a.spot.Spotter) ?? 0;
        const bCount = spotterActivity.get(b.spot.Spotter) ?? 0;
        if (aCount !== bCount) return bCount - aCount;
        return getSpotTime(b.spot) - getSpotTime(a.spot);
      })
      .map(entry => entry.spot)
      .slice(0, maxCards.value);
  }

  return pool
    .slice()
    .sort((a, b) => getSpotTime(b.spot) - getSpotTime(a.spot))
    .map(entry => entry.spot)
    .slice(0, maxCards.value);
});

const localCoords = computed(() => {
  const grid = configHelper.getSetting(['station'], 'grid') as string | undefined;
  if (!grid) return null;
  try {
    return MaidenheadLocator.gridToLatLon(grid);
  } catch {
    return null;
  }
});

const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

const distanceAndAzimuth = (spot: DxSpot) => {
  if (!spot.DXLocator || !localCoords.value) return '';
  try {
    const remote = MaidenheadLocator.gridToLatLon(spot.DXLocator);
    const distanceKm = calculateDistance(
      localCoords.value.lat,
      localCoords.value.lon,
      remote.lat,
      remote.lon
    );
    const azimuth = Math.round(
      calculateBearing(localCoords.value.lat, localCoords.value.lon, remote.lat, remote.lon)
    );
    return `${azimuth}° ${distanceKm}km`;
  } catch {
    return '';
  }
};

const flagUrl = (callsign: string) => {
  const code = getCountryCodeForCallsign(callsign);
  if (!code || code === 'xx') return '';
  return `https://flagcdn.com/h40/${code}.png`;
};

const handleSpeedDialKeydown = (event: KeyboardEvent) => {
  if (!event.ctrlKey) return;
  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;
  const index = digit === 0 ? 9 : digit - 1;
  const spot = rankedSpots.value[index];
  if (!spot) return;
  event.preventDefault();
  selectedKey.value = index;
  handleSpotClick(spot);
};

const openSettings = () => {
  draftSettings.value = { ...speedDialSettings.value };
  draftDisplaySettings.value = { ...contestStore.dxDisplaySettings };
  settingsOpen.value = true;
};

const saveSettings = () => {
  speedDialSettings.value = { ...draftSettings.value };
  contestStore.setDxDisplaySettings(draftDisplaySettings.value);
  settingsOpen.value = false;
};

watch(
  () => rankedSpots.value.map(spot => `${spot.DXCall}-${spot.Frequency}`),
  (next, prev) => {
    if (selectedKey.value === null) return;
    const prevKey = prev?.[selectedKey.value];
    if (!prevKey) return;
    const nextIndex = next.indexOf(prevKey);
    selectedKey.value = nextIndex === -1 ? null : nextIndex;
  }
);

watch(
  () => speedDialSettings.value.maxCards,
  value => {
    const next = Math.min(10, Math.max(1, Number(value) || 1));
    if (next !== value) speedDialSettings.value.maxCards = next;
  }
);

watch(
  () => draftSettings.value.maxCards,
  value => {
    const next = Math.min(10, Math.max(1, Number(value) || 1));
    if (next !== value) draftSettings.value.maxCards = next;
  }
);

watch(
  () => draftSettings.value.timeLimitMinutes,
  value => {
    const next = Math.max(1, Number(value) || 1);
    if (next !== value) draftSettings.value.timeLimitMinutes = next;
  }
);

watch(
  () => draftDisplaySettings.value.workedHideMinutes,
  value => {
    const next = Math.max(1, Number(value) || 1);
    if (next !== value) draftDisplaySettings.value.workedHideMinutes = next;
  }
);

watch(
  () => draftDisplaySettings.value.multBgOpacity,
  value => {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    if (next !== value) draftDisplaySettings.value.multBgOpacity = next;
  }
);

watch(
  () => draftDisplaySettings.value.regularBgOpacity,
  value => {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    if (next !== value) draftDisplaySettings.value.regularBgOpacity = next;
  }
);

watch(
  () => draftDisplaySettings.value.multOpacity,
  value => {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    if (next !== value) draftDisplaySettings.value.multOpacity = next;
  }
);

watch(
  () => draftDisplaySettings.value.regularOpacity,
  value => {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    if (next !== value) draftDisplaySettings.value.regularOpacity = next;
  }
);

watch(
  () => draftDisplaySettings.value.workedOpacity,
  value => {
    const next = Math.min(1, Math.max(0, Number(value) || 0));
    if (next !== value) draftDisplaySettings.value.workedOpacity = next;
  }
);

onMounted(() => {
  dxStore.connectCluster();
  window.addEventListener('keydown', handleSpeedDialKeydown, { capture: true });
});

onBeforeUnmount(() => {
  dxStore.disconnectCluster();
  window.removeEventListener('keydown', handleSpeedDialKeydown, true);
});
</script>

<template>
  <div class="dx-strip">
    <div class="dx-strip-header">
      <h2 class="panel-title">Speed dial</h2>
      <button class="speed-dial-settings" type="button" @click="openSettings">
        ⚙
      </button>
    </div>
    <div class="dx-strip-inner" :style="{ '--speed-dial-cols': maxCards }">
      <div v-if="!rankedSpots.length" class="speed-dial-empty">
        No stations —
        <button class="speed-dial-empty-link" type="button" @click="openSettings">
          open settings
        </button>
        to adjust the station filter.
      </div>
      <div v-for="(spot, index) in rankedSpots" :key="`${spot.DXCall}-${spot.Frequency}`" class="spot">
        <div class="spot-key">Ctrl+{{ index === 9 ? 0 : index + 1 }}</div>
        <button
          class="spot-card"
          :class="{
            'is-mult': getSpotMeta(spot).isMult,
            'is-worked': getSpotMeta(spot).worked,
            'blink-edge': getSpotDisplay(spot).blink,
            'is-selected': selectedKey === index,
          }"
          :style="getSpotCardStyle(spot, index)"
          type="button"
          @click="
            selectedKey = index;
            handleSpotClick(spot);
          "
        >
          <div class="spot-main">
            <div class="spot-flag-wrap">
              <img
                v-if="flagUrl(spot.DXCall)"
                :src="flagUrl(spot.DXCall)"
                :alt="spot.DXCall"
                class="spot-flag"
              />
              <span
                v-if="getSpotMeta(spot).isMult"
                class="mult-asterisk"
                title="Multiplier"
              >
                *
              </span>
            </div>
            <span v-if="distanceAndAzimuth(spot)" class="spot-azdist">
              {{ distanceAndAzimuth(spot) }}
            </span>
            <span class="spot-call">{{ spot.DXCall }}</span>
            <span class="spot-freq">{{ formatFrequency(spot.Frequency) }}</span>
          </div>
          <div class="spot-tags"></div>
        </button>
      </div>
    </div>
  </div>

  <div v-if="settingsOpen" class="speed-dial-modal-backdrop" @click="settingsOpen = false">
    <div class="speed-dial-modal panel" @click.stop>
      <div class="modal-header">
        <h3 class="panel-title">Speed Dial Settings</h3>
      </div>
      <div class="modal-body">
        <label class="toggle-row">
          <span>Max cards</span>
          <input
            v-model.number="draftSettings.maxCards"
            type="number"
            min="1"
            max="10"
          />
        </label>
        <label class="toggle-row">
          <span>Time limit (min)</span>
          <input v-model.number="draftSettings.timeLimitMinutes" type="number" min="1" />
        </label>
        <label class="toggle-row">
          <span>Suggestion type</span>
          <select v-model="draftSettings.type">
            <option value="topMult">Top multiplier stations</option>
            <option value="newest">Newest stations</option>
            <option value="activeDe">Most active DE station</option>
            <option value="mostReportedDx">Most reported DX station</option>
          </select>
        </label>
        <div class="modal-section">
          <div class="modal-section-title">Display rules</div>
          <div class="modal-section-note">Applies to DX Cluster and Speed Dial.</div>
          <label class="toggle-row">
            <span>Multiplier background</span>
            <div class="inline-controls">
              <input v-model="draftDisplaySettings.multBg" type="color" />
              <input
                v-model.number="draftDisplaySettings.multBgOpacity"
                type="number"
                min="0"
                max="1"
                step="0.05"
              />
            </div>
          </label>
          <label class="toggle-row">
            <span>Multiplier opacity</span>
            <input
              v-model.number="draftDisplaySettings.multOpacity"
              type="number"
              min="0"
              max="1"
              step="0.05"
            />
          </label>
          <label class="toggle-row">
            <span>Multiplier blink edge</span>
            <input v-model="draftDisplaySettings.multBlink" type="checkbox" />
          </label>
          <label class="toggle-row">
            <span>Regular background</span>
            <div class="inline-controls">
              <input v-model="draftDisplaySettings.regularBg" type="color" />
              <input
                v-model.number="draftDisplaySettings.regularBgOpacity"
                type="number"
                min="0"
                max="1"
                step="0.05"
              />
            </div>
          </label>
          <label class="toggle-row">
            <span>Regular opacity</span>
            <input
              v-model.number="draftDisplaySettings.regularOpacity"
              type="number"
              min="0"
              max="1"
              step="0.05"
            />
          </label>
          <label class="toggle-row">
            <span>Worked opacity</span>
            <input
              v-model.number="draftDisplaySettings.workedOpacity"
              type="number"
              min="0"
              max="1"
              step="0.05"
            />
          </label>
          <label class="toggle-row">
            <span>Hide worked after (min)</span>
            <input
              v-model.number="draftDisplaySettings.workedHideMinutes"
              type="number"
              min="1"
              step="1"
            />
          </label>
        </div>
        <label class="toggle-row is-disabled">
          <input type="checkbox" disabled />
          <span>Rotate antenna to station (hamlib)</span>
        </label>
      </div>
      <div class="modal-footer">
        <button class="modal-save" type="button" @click="saveSettings">Save &amp; Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dx-strip {
  width: 100%;
}

.dx-strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: var(--spacing-sm);
}

.speed-dial-settings {
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #e6e6e6;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.dx-strip-inner {
  display: grid;
  grid-template-columns: repeat(var(--speed-dial-cols, 10), minmax(0, 1fr));
  gap: 0.5rem;
  align-items: stretch;
}

.speed-dial-empty {
  grid-column: 1 / -1;
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  text-align: center;
  gap: 0.3rem;
}

.speed-dial-empty-link {
  background: none;
  border: none;
  color: #9bd1ff;
  font-size: 0.8rem;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}

.speed-dial-empty-link:hover {
  color: #cfe6ff;
}

.spot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;
  min-width: 0;
}

.spot-key {
  font-size: 0.7rem;
  color: #f2f2f2;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-align: center;
}

.spot-card {
  background: transparent;
  border: 1px solid #2e2e2e;
  border-radius: 8px;
  color: #ff6a4d;
  padding: 0.35rem 0.45rem;
  min-width: 0;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.spot-card.blink-edge {
  animation: contest-mult-blink 2s steps(2, end) infinite;
}

.spot-card.is-selected {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.8);
  color: #d1fae5;
}

.spot-card.is-worked {
  border-color: rgba(255, 255, 255, 0.2);
}

.spot-card.is-selected .spot-call {
  color: #d1fae5;
}

.spot-card:hover {
  border-color: #ffa500;
  box-shadow: 0 0 0 1px rgba(255, 165, 0, 0.3);
}

.spot-main {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  font-weight: 700;
  gap: 0.2rem;
  align-items: flex-start;
}

.spot-flag-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.spot-flag {
  width: 18px;
  height: 12px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.mult-asterisk {
  color: #ff4d4d;
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1;
  margin-left: -2px;
}

.spot-azdist {
  font-size: 0.65rem;
  color: #b7b7b7;
  white-space: nowrap;
}

.spot-call {
  color: #ff6a4d;
  white-space: nowrap;
}

.spot-freq {
  color: #9bd1ff;
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
}

.spot-tags {
  display: flex;
  gap: 0.35rem;
}

.tag {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.tag-mult {
  background: rgba(255, 165, 0, 0.2);
  color: #ffb347;
  border-color: rgba(255, 165, 0, 0.45);
}

.modal-section {
  padding-top: 0.6rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.modal-section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
}

.modal-section-note {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.55);
  margin-top: -0.2rem;
}

.inline-controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

@keyframes contest-mult-blink {
  0% {
    border-color: rgba(255, 255, 255, 0.9);
  }
  50% {
    border-color: rgba(255, 68, 68, 0.9);
  }
  100% {
    border-color: rgba(255, 255, 255, 0.9);
  }
}

.speed-dial-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2200;
}

.speed-dial-modal {
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
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #d6d6d6;
  min-width: 45%;
}

.toggle-row.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-row select,
.toggle-row input[type='number'] {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
}

.modal-save {
  border-radius: 8px;
  border: 1px solid rgba(255, 165, 0, 0.5);
  background: rgba(255, 165, 0, 0.16);
  color: #ffcc80;
  font-size: 0.75rem;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}
</style>
