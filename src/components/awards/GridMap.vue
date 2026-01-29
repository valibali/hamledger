<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { LMap, LTileLayer, LRectangle, LControl, LTooltip } from '@vue-leaflet/vue-leaflet';
import { useAwardsStore } from '../../store/awards';
import { useQsoStore } from '../../store/qso';
import type { LatLngBoundsExpression, Map as LeafletMap, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Store
const awardsStore = useAwardsStore();
const qsoStore = useQsoStore();

// State
const hoveredGrid = ref<string | null>(null);
const selectedField = ref<string | null>(null);
const mapRef = ref<InstanceType<typeof LMap> | null>(null);
const currentZoom = ref(2);
const mapBounds = ref<LatLngBounds | null>(null);
const mapReady = ref(false);
const SUBSQUARE_ZOOM_THRESHOLD = 4;
const gridFilter = ref('');

// Maidenhead grid constants
const FIELD_LETTERS = 'ABCDEFGHIJKLMNOPQR';
const SQUARE_DIGITS = '0123456789';

// Computed
const workedGrids = computed(() => awardsStore.grids.fourChar);
const workedCount = computed(() => workedGrids.value.size);

// Calculate field statistics
const fieldStats = computed(() => {
  const stats = new Map<string, number>();

  for (const grid of workedGrids.value) {
    const field = grid.substring(0, 2).toUpperCase();
    stats.set(field, (stats.get(field) || 0) + 1);
  }

  return stats;
});

// Get worked fields
const workedFields = computed(() => {
  const fields = new Set<string>();
  for (const grid of workedGrids.value) {
    fields.add(grid.substring(0, 2).toUpperCase());
  }
  return fields;
});

const workedFieldCount = computed(() => workedFields.value.size);

// Generate grid field rectangles
interface GridSquare {
  square: string;
  bounds: LatLngBoundsExpression;
  count: number;
}

// Get field bounds
function getFieldBounds(lonIdx: number, latIdx: number): { lonStart: number; latStart: number; lonEnd: number; latEnd: number } {
  const lonStart = -180 + lonIdx * 20;
  const latStart = -90 + latIdx * 10;
  return {
    lonStart,
    latStart,
    lonEnd: lonStart + 20,
    latEnd: latStart + 10,
  };
}

// Check if bounds intersect with map view
function boundsInView(lonStart: number, latStart: number, lonEnd: number, latEnd: number): boolean {
  if (!mapBounds.value) return true;

  const viewBounds = mapBounds.value;
  const south = viewBounds.getSouth();
  const north = viewBounds.getNorth();
  const west = viewBounds.getWest();
  const east = viewBounds.getEast();

  // Check if rectangles intersect
  return !(lonEnd < west || lonStart > east || latEnd < south || latStart > north);
}

const gridCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const qso of qsoStore.allQsos) {
    if (!qso.grid) continue;
    const grid = qso.grid.toUpperCase();
    if (grid.length < 4) continue;
    const grid4 = grid.substring(0, 4);
    counts.set(grid4, (counts.get(grid4) || 0) + 1);
  }
  return counts;
});

const fieldCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const [grid, count] of gridCounts.value) {
    const field = grid.substring(0, 2);
    counts.set(field, (counts.get(field) || 0) + count);
  }
  return counts;
});

const maxFieldCount = computed(() => {
  let max = 0;
  for (const count of fieldCounts.value.values()) {
    if (count > max) max = count;
  }
  return max;
});

const maxGridCount = computed(() => {
  let max = 0;
  for (const count of gridCounts.value.values()) {
    if (count > max) max = count;
  }
  return max;
});

const gridFields = computed((): { field: string; bounds: LatLngBoundsExpression; count: number }[] => {
  const fields: { field: string; bounds: LatLngBoundsExpression; count: number }[] = [];

  for (let lonIdx = 0; lonIdx < 18; lonIdx++) {
    for (let latIdx = 0; latIdx < 18; latIdx++) {
      const field = FIELD_LETTERS[lonIdx] + FIELD_LETTERS[latIdx];
      const { lonStart, latStart, lonEnd, latEnd } = getFieldBounds(lonIdx, latIdx);
      if (!boundsInView(lonStart, latStart, lonEnd, latEnd)) continue;
      const bounds: LatLngBoundsExpression = [
        [latStart, lonStart],
        [latEnd, lonEnd],
      ];
      fields.push({ field, bounds, count: fieldCounts.value.get(field) || 0 });
    }
  }

  return fields;
});

const gridSquares = computed((): GridSquare[] => {
  const squares: GridSquare[] = [];
  const counts = gridCounts.value;
  const showSelected = selectedField.value;
  const showZoomed = currentZoom.value >= SUBSQUARE_ZOOM_THRESHOLD;
  if (!showSelected && !showZoomed) return squares;

  for (let lonIdx = 0; lonIdx < 18; lonIdx++) {
    for (let latIdx = 0; latIdx < 18; latIdx++) {
      const { lonStart, latStart, lonEnd, latEnd } = getFieldBounds(lonIdx, latIdx);

      // Skip if field is not in view
      if (!boundsInView(lonStart, latStart, lonEnd, latEnd)) continue;

      const fieldLetter1 = FIELD_LETTERS[lonIdx];
      const fieldLetter2 = FIELD_LETTERS[latIdx];
      const field = fieldLetter1 + fieldLetter2;
      if (showSelected && field !== selectedField.value) continue;

      // Generate 10x10 subsquares within this field
      const squareWidth = 2; // 20 degrees / 10 = 2 degrees
      const squareHeight = 1; // 10 degrees / 10 = 1 degree

      for (let sqLonIdx = 0; sqLonIdx < 10; sqLonIdx++) {
        for (let sqLatIdx = 0; sqLatIdx < 10; sqLatIdx++) {
          const square = fieldLetter1 + fieldLetter2 + SQUARE_DIGITS[sqLonIdx] + SQUARE_DIGITS[sqLatIdx];

          const sqLonStart = lonStart + sqLonIdx * squareWidth;
          const sqLatStart = latStart + sqLatIdx * squareHeight;

          // Skip if square is not in view (optimization)
          if (!boundsInView(sqLonStart, sqLatStart, sqLonStart + squareWidth, sqLatStart + squareHeight)) continue;

          const bounds: LatLngBoundsExpression = [
            [sqLatStart, sqLonStart],
            [sqLatStart + squareHeight, sqLonStart + squareWidth],
          ];

          const count = counts.get(square) || 0;

          squares.push({ square, bounds, count });
        }
      }
    }
  }

  return squares;
});

function getHeatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#2a2a2a';
  const t = Math.min(1, Math.log(count + 1) / Math.log(max + 1));
  const hue = 120 - 120 * t; // green -> red
  return `hsl(${hue}, 85%, 45%)`;
}

function getHeatOpacity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0.15;
  const t = Math.min(1, Math.log(count + 1) / Math.log(max + 1));
  return 0.35 + 0.5 * t;
}

const heatLegend = computed(() => {
  const max = maxFieldCount.value;
  if (max <= 0) {
    return [{ label: '0', color: '#2a2a2a' }];
  }
  const q1 = Math.max(2, Math.ceil(max * 0.15));
  const q2 = Math.max(q1 + 1, Math.ceil(max * 0.4));
  const q3 = Math.max(q2 + 1, Math.ceil(max * 0.7));
  return [
    { label: `${q3}+`, color: getHeatColor(max, max) },
    { label: `${q2}-${q3 - 1}`, color: getHeatColor(q2, max) },
    { label: `${q1}-${q2 - 1}`, color: getHeatColor(q1, max) },
    { label: `1-${q1 - 1}`, color: getHeatColor(1, max) },
    { label: '0', color: '#2a2a2a' },
  ];
});

// Sorted worked grids for display
const sortedWorkedGrids = computed(() => {
  return Array.from(workedGrids.value).sort();
});
const filteredWorkedGrids = computed(() => {
  const term = gridFilter.value.trim().toUpperCase();
  if (!term) return sortedWorkedGrids.value;
  return sortedWorkedGrids.value.filter((grid) => grid.includes(term));
});

// Handle map events
function onZoomEnd() {
  const map = mapRef.value?.leafletObject as LeafletMap | undefined;
  if (map) {
    currentZoom.value = map.getZoom();
    mapBounds.value = map.getBounds();
  }
}

function onMoveEnd() {
  const map = mapRef.value?.leafletObject as LeafletMap | undefined;
  if (map) {
    mapBounds.value = map.getBounds();
  }
}

function onMapReady() {
  const map = mapRef.value?.leafletObject as LeafletMap | undefined;
  if (map) {
    currentZoom.value = map.getZoom();
    mapBounds.value = map.getBounds();
    mapReady.value = true;
  }
}

// Watch for zoom changes to update legend
</script>

<template>
  <div class="grid-map-container">
    <div class="grid-summary">
      <span class="summary-worked">{{ workedCount }} Grids</span>
      <span class="summary-divider">|</span>
      <span class="summary-fields">{{ workedFieldCount }} Fields</span>
    </div>

    <div class="map-wrapper">
      <LMap
        ref="mapRef"
        :zoom="2"
        :center="[30, 0]"
        :use-global-leaflet="false"
        :options="{
          zoomControl: true,
          attributionControl: false,
          minZoom: 1,
          maxZoom: 8,
          worldCopyJump: true,
        }"
        class="leaflet-map"
        @ready="onMapReady"
        @zoomend="onZoomEnd"
        @moveend="onMoveEnd"
      >
        <!-- Dark tile layer -->
        <LTileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          :options="{ opacity: 0.3 }"
        />

        <template v-if="mapReady">
          <!-- Maidenhead grid fields (2-char heatmap) -->
          <LRectangle
            v-for="field in gridFields"
            :key="'field-' + field.field"
            :bounds="field.bounds"
            :options="{
              color: selectedField === field.field ? '#ffd700' : '#3a3a3a',
              weight: selectedField === field.field ? 2 : 1,
              fillColor: getHeatColor(field.count, maxFieldCount),
              fillOpacity: getHeatOpacity(field.count, maxFieldCount),
            }"
            @mouseover="hoveredGrid = field.field"
            @mouseout="hoveredGrid = null"
            @click="selectedField = selectedField === field.field ? null : field.field"
          >
            <LTooltip>
              <div class="grid-tooltip-content">
                <strong>{{ field.field }}</strong><br />
                {{ field.count }} QSO{{ field.count !== 1 ? 's' : '' }}
              </div>
            </LTooltip>
          </LRectangle>

          <!-- Maidenhead grid squares (4-char heatmap, only for selected field) -->
          <LRectangle
            v-for="square in gridSquares"
            :key="'square-' + square.square"
            :bounds="square.bounds"
            :options="{
              color: '#3a3a3a',
              weight: 1,
              fillColor: getHeatColor(square.count, maxGridCount),
              fillOpacity: getHeatOpacity(square.count, maxGridCount),
            }"
            @mouseover="hoveredGrid = square.square"
            @mouseout="hoveredGrid = null"
          >
            <LTooltip>
              <div class="grid-tooltip-content">
                <strong>{{ square.square }}</strong><br />
                {{ square.count }} QSO{{ square.count !== 1 ? 's' : '' }}
              </div>
            </LTooltip>
          </LRectangle>
        </template>

        <!-- Legend -->
        <LControl position="topright">
          <div class="map-legend">
            <div class="legend-title">Grid QSOs (2-char)</div>
            <div v-for="item in heatLegend" :key="item.label" class="legend-item">
              <span class="legend-box" :style="{ background: item.color }"></span> {{ item.label }}
            </div>
            <div class="legend-hint">Click a field or zoom in for 4-char detail</div>
          </div>
        </LControl>

        <!-- Stats -->
        <LControl position="bottomleft">
          <div class="stats-control">
            <div class="stat-row">
              <span class="stat-label">Fields:</span>
              <span class="stat-value">{{ workedFieldCount }} / 324</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Grids:</span>
              <span class="stat-value">{{ workedCount }}</span>
            </div>
            <div class="stat-row zoom-info">
              <span class="stat-label">Zoom:</span>
              <span class="stat-value">{{ currentZoom }}</span>
            </div>
          </div>
        </LControl>
      </LMap>
    </div>

    <!-- Worked grids list -->
    <div class="worked-grids-section">
      <h4>Worked Grid Squares ({{ workedCount }})</h4>
      <input
        v-model="gridFilter"
        class="grid-filter"
        type="text"
        placeholder="Filter grids (e.g. FN, EM12)"
      />
      <div class="grids-container">
        <span
          v-for="grid in filteredWorkedGrids"
          :key="grid"
          class="grid-badge"
        >
          {{ grid }}
        </span>
        <span v-if="workedCount === 0" class="no-grids">No grids worked yet</span>
        <span v-else-if="filteredWorkedGrids.length === 0" class="no-grids">No matches</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-map-container {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.grid-summary {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.summary-worked {
  color: #4caf50;
  font-weight: bold;
}

.summary-fields {
  color: #888;
}

.summary-divider {
  color: #555;
  margin: 0 0.5rem;
}

.map-wrapper {
  position: relative;
  flex: 1;
  min-height: 300px;
  border-radius: 8px;
  overflow: hidden;
}

.leaflet-map {
  height: 100%;
  width: 100%;
  background: #1a1a1a;
}

.map-legend {
  background: rgba(26, 26, 26, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #333;
}

.legend-title {
  font-size: 11px;
  font-weight: bold;
  color: #aaa;
  margin-bottom: 6px;
  text-align: center;
}

.legend-hint {
  font-size: 9px;
  color: #666;
  text-align: center;
  margin-top: 6px;
  font-style: italic;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #ccc;
  margin: 3px 0;
}

.legend-box {
  width: 16px;
  height: 12px;
  border-radius: 2px;
}

 .legend-box.none {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
}

.stats-control {
  background: rgba(26, 26, 26, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #333;
  font-size: 11px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0;
}

.stat-row.zoom-info {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #333;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: #4caf50;
  font-weight: bold;
}

.grid-tooltip-content {
  text-align: center;
  font-size: 12px;
}

.worked-grids-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #333;
}

.worked-grids-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #aaa;
}

.grid-filter {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #333;
  background: #222;
  color: #ddd;
  font-size: 0.85rem;
}

.grids-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  max-height: 120px;
  overflow-y: auto;
}

.grid-badge {
  padding: 0.2rem 0.5rem;
  background: #4caf50;
  color: #000;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: bold;
  font-family: monospace;
}

.no-grids {
  color: #666;
  font-size: 0.85rem;
}

/* Override Leaflet dark theme */
:deep(.leaflet-container) {
  background: #1a1a1a;
}

:deep(.leaflet-control-zoom) {
  border: 1px solid #333 !important;
}

:deep(.leaflet-control-zoom a) {
  background: #2a2a2a !important;
  color: #ccc !important;
  border-color: #333 !important;
}

:deep(.leaflet-control-zoom a:hover) {
  background: #3a3a3a !important;
}

:deep(.leaflet-tooltip) {
  background: rgba(51, 51, 51, 0.95);
  border: 1px solid #555;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
}

:deep(.leaflet-tooltip-left:before),
:deep(.leaflet-tooltip-right:before) {
  border-left-color: #555;
  border-right-color: #555;
}
</style>
