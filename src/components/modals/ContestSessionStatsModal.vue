<script lang="ts">
import { LMap, LTileLayer, LCircleMarker, LTooltip } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import ContestStatsSparkline from '../contest/ContestStatsSparkline.vue';
import BaseModal from './BaseModal.vue';
import type { QsoEntry } from '../../types/qso';

export default {
  name: 'ContestSessionStatsModal',
  components: {
    LMap,
    LTileLayer,
    LCircleMarker,
    LTooltip,
    ContestStatsSparkline,
    BaseModal,
  },
  props: {
    open: { type: Boolean, required: true },
    summary: { type: Object as () =>
      | {
          totalQsos: number;
          score: number;
          mults: number;
          avgRate: number;
          start?: string;
          end?: string;
        }
      | null,
      required: false,
      default: null,
    },
    timestamps: { type: Array as () => string[], required: true },
    startedAt: { type: String, required: true },
    mapCenter: { type: Array as () => [number, number], required: true },
    mapPoints: {
      type: Array as () =>
        Array<{
          callsign: string;
          band: string;
          mode: string;
          lat: number;
          lon: number;
        }>,
      required: true,
    },
    showFilters: { type: Boolean, required: true },
    filters: {
      type: Object as () => {
        searchText: string;
        selectedBand: string;
        selectedMode: string;
        dateFrom: string;
        dateTo: string;
        useWildcard: boolean;
        useRegex: boolean;
        caseSensitive: boolean;
      },
      required: true,
    },
    regexError: { type: Boolean, required: true },
    bands: { type: Array as () => string[], required: true },
    modes: { type: Array as () => string[], required: true },
    qsos: { type: Array as () => QsoEntry[], required: true },
    sortKey: { type: String, required: true },
    sortOrder: { type: String, required: true },
    onClose: { type: Function, required: true },
    onToggleFilters: { type: Function, required: true },
    onFiltersChange: { type: Function, required: true },
    onSort: { type: Function, required: true },
    getSequence: { type: Function, required: true },
    formatDate: { type: Function, required: true },
    onQsoClick: { type: Function, required: true },
    onMapCallClick: { type: Function, required: true },
  },
  data() {
    return {
      localFilters: this.cloneFilters(this.filters),
    };
  },
  watch: {
    filters: {
      deep: true,
      handler(newFilters) {
        this.localFilters = this.cloneFilters(newFilters);
      },
    },
    localFilters: {
      deep: true,
      handler(newFilters) {
        this.onFiltersChange(this.cloneFilters(newFilters));
      },
    },
  },
  methods: {
    cloneFilters(filters: {
      searchText: string;
      selectedBand: string;
      selectedMode: string;
      dateFrom: string;
      dateTo: string;
      useWildcard: boolean;
      useRegex: boolean;
      caseSensitive: boolean;
    }) {
      return { ...filters };
    },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Session statistics"
    width="min(1000px, 92vw)"
    height="min(82vh, 860px)"
    :on-close="onClose"
  >
    <div class="modal-body session-stats-body">
      <div class="session-stats-metrics">
        <div class="metric-row metric-qsos">
          <span class="metric-label">QSOs</span>
          <span class="metric-value">{{ summary?.totalQsos ?? 0 }}</span>
        </div>
        <div class="metric-row metric-score">
          <span class="metric-label">Score</span>
          <span class="metric-value">{{ summary?.score ?? 0 }}</span>
        </div>
        <div class="metric-row metric-mults">
          <span class="metric-label">Multipliers</span>
          <span class="metric-value">{{ summary?.mults ?? 0 }}</span>
        </div>
        <div class="metric-row metric-rate">
          <span class="metric-label">Avg rate</span>
          <span class="metric-value">{{ summary?.avgRate ?? 0 }}</span>
        </div>
        <div class="metric-row metric-start">
          <span class="metric-label">Start</span>
          <span class="metric-value metric-date">{{ formatDate(summary?.start ?? 'n/a') }}</span>
        </div>
        <div class="metric-row metric-end">
          <span class="metric-label">End</span>
          <span class="metric-value metric-date">{{ formatDate(summary?.end ?? 'n/a') }}</span>
        </div>
        <div class="metric-chart">
          <div class="metric-chart-title">QSO rate</div>
          <ContestStatsSparkline :timestamps="timestamps" :started-at="startedAt" />
        </div>
      </div>
      <div class="session-stats-right">
        <div class="session-stats-map">
          <LMap :zoom="2" :center="mapCenter" :use-global-leaflet="false" class="leaflet-map">
            <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LCircleMarker
              v-for="point in mapPoints"
              :key="`${point.callsign}-${point.lat}-${point.lon}`"
              :lat-lng="[point.lat, point.lon]"
              :radius="5"
              :color="'#ffa500'"
              :fill-color="'#ffa500'"
              :fill-opacity="0.7"
              @click="onMapCallClick(point.callsign)"
            >
              <LTooltip>{{ point.callsign }} {{ point.band }} {{ point.mode }}</LTooltip>
            </LCircleMarker>
          </LMap>
          <div v-if="!mapPoints.length" class="map-empty">No location data available yet.</div>
        </div>
        <div class="session-stats-qsos">
          <div class="session-stats-head">
            <span>QSOs</span>
            <button
              class="panel-action filter-toggle"
              type="button"
              :aria-pressed="showFilters"
              @click="onToggleFilters"
            >
              ⛃
            </button>
          </div>
          <div v-if="showFilters" class="session-stats-filters">
            <div class="filter-group">
              <label>Search</label>
              <input
                v-model="localFilters.searchText"
                class="filter-input"
                type="text"
                placeholder="Call / exch"
                :class="{ 'regex-error': regexError }"
              />
            </div>
            <div class="filter-group">
              <label>Band</label>
              <select v-model="localFilters.selectedBand" class="filter-input">
                <option value="">All</option>
                <option v-for="band in bands" :key="band" :value="band">{{ band }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Mode</label>
              <select v-model="localFilters.selectedMode" class="filter-input">
                <option value="">All</option>
                <option v-for="mode in modes" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>From</label>
              <input v-model="localFilters.dateFrom" class="filter-input" type="date" />
            </div>
            <div class="filter-group">
              <label>To</label>
              <input v-model="localFilters.dateTo" class="filter-input" type="date" />
            </div>
            <div class="filter-options">
              <label>
                <input type="checkbox" v-model="localFilters.useWildcard" />
                Wildcard
              </label>
              <label>
                <input type="checkbox" v-model="localFilters.useRegex" />
                Regex
              </label>
              <label>
                <input type="checkbox" v-model="localFilters.caseSensitive" />
                Case
              </label>
            </div>
          </div>
          <div class="session-qso-row header">
            <span class="sortable" @click="onSort('sequence')">
              #
              <span v-if="sortKey === 'sequence'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </span>
            <span class="sortable" @click="onSort('datetime')">
              Time
              <span v-if="sortKey === 'datetime'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </span>
            <span class="sortable" @click="onSort('callsign')">
              Call
              <span v-if="sortKey === 'callsign'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </span>
            <span class="sortable" @click="onSort('band')">
              Band
              <span v-if="sortKey === 'band'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </span>
            <span class="sortable" @click="onSort('mode')">
              Mode
              <span v-if="sortKey === 'mode'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </span>
            <span>Exch</span>
            <span>Score</span>
          </div>
          <div class="session-qso-scroll">
            <div v-for="qso in qsos" :key="qso._id || qso.id" class="session-qso-row" @click="onQsoClick(qso)">
              <span class="session-qso-seq">{{ getSequence(qso) }}</span>
              <span>{{ qso.datetime }}</span>
              <span class="session-qso-call">{{ qso.callsign }}</span>
              <span>{{ qso.band }}</span>
              <span>{{ qso.mode }}</span>
              <span>
                {{
                  qso.contestExchange?.serialRecv ||
                  qso.contestExchange?.exchangeRecv ||
                  qso.contestExchange?.region ||
                  qso.contestExchange?.grid ||
                  '--'
                }}
              </span>
              <span>{{ (qso.contestPoints || 0) * (qso.contestMultiplierFactor || 1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.session-stats-body {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(320px, 1.6fr);
  gap: 0.7rem;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.session-stats-right {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-height: 0;
}

.session-stats-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.2rem 0;
  min-width: 0;
}

.metric-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.85rem;
  padding: 0.35rem 0.4rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 3px solid var(--metric-color, rgba(255, 255, 255, 0.15));
}

.metric-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.6);
}

.metric-value {
  font-size: 1rem;
  font-weight: 700;
  color: #f2f2f2;
}

.metric-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.metric-qsos {
  --metric-color: #7dd3fc;
}

.metric-score {
  --metric-color: #fbbf24;
}

.metric-mults {
  --metric-color: #f472b6;
}

.metric-rate {
  --metric-color: #34d399;
}

.metric-chart {
  margin-top: 0.6rem;
  padding: 0.6rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  height: 170px;
  display: flex;
  flex-direction: column;
}

.metric-chart-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 0.3rem;
}

.session-stats-map {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1.1;
}

.session-stats-map .leaflet-map {
  width: 100%;
  flex: 1;
  min-height: 260px;
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
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.session-stats-qsos .session-qso-row {
  font-size: 0.7rem;
}

.session-stats-qsos .session-qso-row.header {
  font-size: 0.65rem;
}

.session-stats-qsos .session-qso-row span {
  min-width: 0;
  text-overflow: ellipsis;
  overflow: hidden;
}

.session-stats-qsos .session-qso-row span:nth-child(2),
.session-stats-qsos .session-qso-row span:nth-child(3),
.session-stats-qsos .session-qso-row span:nth-child(4),
.session-stats-qsos .session-qso-row span:nth-child(5),
.session-stats-qsos .session-qso-row span:nth-child(6),
.session-stats-qsos .session-qso-row span:nth-child(7) {
  white-space: nowrap;
}

.session-stats-qsos .session-qso-row + .session-qso-row {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.session-stats-qsos .session-stats-filters {
  padding: 0.4rem 0.5rem 0.2rem;
}

.session-stats-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.session-stats-filters .filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-stats-filters .filter-input {
  background: #1d1d1d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f0f0f0;
  border-radius: 6px;
  padding: 0.25rem 0.35rem;
  font-size: 0.75rem;
}

.session-stats-filters .filter-options {
  display: flex;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  align-items: center;
  grid-column: 1 / -1;
}

.session-stats-filters .regex-error {
  border-color: rgba(248, 113, 113, 0.8);
}

.session-stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.session-qso-row {
  display: grid;
  grid-template-columns: 0.5fr 1.4fr 1.1fr 0.6fr 0.6fr 0.7fr 0.6fr;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
}

.session-qso-row:not(.header) {
  cursor: pointer;
}

.session-qso-row:not(.header):hover {
  background: rgba(255, 255, 255, 0.06);
}

.session-qso-row.header {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
}

.session-qso-scroll {
  overflow-y: auto;
  flex: 1;
}

.session-qso-seq {
  color: #f0e39a;
}

.session-qso-call {
  color: #ffd27d;
}

</style>
