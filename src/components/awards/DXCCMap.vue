<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { LMap, LTileLayer, LControl } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';
import { useAwardsStore } from '../../store/awards';
import { getAllEntities } from '../../utils/dxccParser';
import type { ModeCategory } from '../../types/awards';
import 'leaflet/dist/leaflet.css';
import dxccGeoJsonRaw from '../../data/dxcc.geojson?raw';

// GeoJSON types (simplified for our use)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJsonFeature = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJsonFeatureCollection = any;

// Props
const props = defineProps<{
  selectedMode?: ModeCategory;
  showWorked?: boolean;
  showNeeded?: boolean;
}>();

const selectedMode = computed(() => props.selectedMode || 'mixed');
const showWorked = computed(() => props.showWorked !== false);
const showNeeded = computed(() => props.showNeeded !== false);

// Store
const awardsStore = useAwardsStore();

// State
const hoveredCountry = ref<{
  name: string;
  worked: boolean;
  mismatch: boolean;
  entityCode?: number;
  cqZone?: number;
  ituZone?: number;
  prefixes?: string[];
} | null>(null);
const geoJsonData = shallowRef<GeoJsonFeatureCollection | null>(null);
const mapRef = ref<InstanceType<typeof LMap> | null>(null);
const geoJsonLayer = shallowRef<L.GeoJSON | null>(null);
const isUnmounting = ref(false);
const featureEntityCache = new Map<string, number | null>();
const hoverBoxRef = ref<HTMLElement | null>(null);
const hoverLocked = ref(false);
function getLeafletMap(): L.Map | null {
  const map = mapRef.value?.leafletObject;
  return map ? (map as unknown as L.Map) : null;
}

function disableMapScrollZoom() {
  const map = getLeafletMap();
  if (map) map.scrollWheelZoom.disable();
}

function enableMapScrollZoom() {
  const map = getLeafletMap();
  if (map) map.scrollWheelZoom.enable();
}

function shouldKeepHover(event: { originalEvent?: MouseEvent } | undefined): boolean {
  const relatedTarget = event?.originalEvent?.relatedTarget as Node | null;
  if (!relatedTarget || !hoverBoxRef.value) return false;
  return hoverBoxRef.value.contains(relatedTarget);
}

// Computed
const workedSet = computed(() => awardsStore.dxcc[selectedMode.value]);
const entities = computed(() => {
  const allEntities = getAllEntities();
  return allEntities.map(e => ({
    ...e,
    worked: workedSet.value.has(e.entityCode),
  }));
});
const entitiesByCode = computed(() => new Map(entities.value.map(entity => [entity.entityCode, entity])));
const entitiesByName = computed(() => {
  const map = new Map<string, typeof entities.value[number]>();
  for (const entity of entities.value) {
    map.set(normalizeEntityName(entity.name), entity);
  }
  return map;
});

const workedCount = computed(() => {
  switch (selectedMode.value) {
    case 'cw':
      return awardsStore.dxccCwCount;
    case 'phone':
      return awardsStore.dxccPhoneCount;
    case 'digital':
      return awardsStore.dxccDigitalCount;
    case 'mixed':
    default:
      return awardsStore.dxccMixedCount;
  }
});
const totalCount = computed(() => awardsStore.dxccTotal);

function getFeatureKey(feature: GeoJsonFeature): string {
  const props = feature.properties || {};
  return String(
    props.iso_a3 ||
    props.ISO_A3 ||
    props.name ||
    props.NAME ||
    feature.id ||
    JSON.stringify(feature.geometry?.coordinates?.[0]?.[0] ?? '')
  );
}

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(st)\b/g, 'saint')
    .replace(/[^a-z0-9]/g, '');
}

function parseEntityCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getFeatureEntityCode(feature: GeoJsonFeature): number | null {
  const key = getFeatureKey(feature);
  const cached = featureEntityCache.get(key);
  if (cached !== undefined) return cached;

  const props = feature.properties || {};
  const codeCandidates = [
    props.dxcc_entity_code,
    props.DXCC_ENTITY_CODE,
    props.entityCode,
    props.entity_code,
  ];
  for (const candidate of codeCandidates) {
    const parsed = parseEntityCode(candidate);
    if (parsed !== null && entitiesByCode.value.has(parsed)) {
      featureEntityCache.set(key, parsed);
      return parsed;
    }
  }

  const nameCandidates = [
    props.dxcc_name,
    props.DXCC_NAME,
    props.name,
    props.NAME,
  ].filter(Boolean) as string[];
  for (const name of nameCandidates) {
    const entity = entitiesByName.value.get(normalizeEntityName(name));
    if (entity) {
      featureEntityCache.set(key, entity.entityCode);
      return entity.entityCode;
    }
  }

  featureEntityCache.set(key, null);
  return null;
}

// Continent stats
const continentStats = computed(() => {
  const stats: Record<string, { worked: number; total: number }> = {
    'NA': { worked: 0, total: 0 },
    'SA': { worked: 0, total: 0 },
    'EU': { worked: 0, total: 0 },
    'AF': { worked: 0, total: 0 },
    'AS': { worked: 0, total: 0 },
    'OC': { worked: 0, total: 0 },
    'AN': { worked: 0, total: 0 },
  };
  for (const entity of entities.value) {
    if (stats[entity.continent]) {
      stats[entity.continent].total++;
      if (entity.worked) stats[entity.continent].worked++;
    }
  }
  return stats;
});

// Check if country is worked
function isFeatureWorked(feature: GeoJsonFeature): boolean {
  const code = getFeatureEntityCode(feature);
  if (!code) return false;
  return workedSet.value.has(code);
}

function isFeatureMismatch(feature: GeoJsonFeature): boolean {
  const code = getFeatureEntityCode(feature);
  if (!code) return true;
  const entity = entitiesByCode.value.get(code);
  return !entity || Boolean(entity.deleted);
}

function reportDxccMismatches(features: GeoJsonFeatureCollection | null) {
  if (!features?.features?.length) return;
  let missing = 0;
  const samples: string[] = [];
  for (const feature of features.features) {
    if (getFeatureEntityCode(feature) === null) {
      missing++;
      if (samples.length < 5) {
        const name = feature.properties?.dxcc_name || feature.properties?.name || feature.properties?.NAME || 'Unknown';
        samples.push(String(name));
      }
    }
  }
  if (missing > 0) {
    console.warn(`[DXCCMap] ${missing} DXCC features could not be matched to entities. Examples: ${samples.join(', ')}`);
  }
}

// GeoJSON style function
function getStyle(feature: GeoJsonFeature): L.PathOptions {
  const worked = isFeatureWorked(feature);
  const mismatch = isFeatureMismatch(feature);

  // Apply filters
  if (mismatch) {
    return {
      fillColor: '#e53935',
      fillOpacity: 0.6,
      color: '#ef5350',
      weight: 1,
    };
  }
  if (worked && !showWorked.value) {
    return { fillOpacity: 0, opacity: 0, weight: 0 };
  }
  if (!worked && !showNeeded.value) {
    return { fillOpacity: 0, opacity: 0, weight: 0 };
  }

  if (worked) {
    return {
      fillColor: '#4caf50',
      fillOpacity: 0.7,
      color: '#66bb6a',
      weight: 1,
    };
  } else {
    return {
      fillColor: '#ff9800',
      fillOpacity: 0.5,
      color: '#ffa726',
      weight: 1,
    };
  }
}

// Create or update the GeoJSON layer
function createGeoJsonLayer() {
  const map = getLeafletMap();
  if (isUnmounting.value || !map || !geoJsonData.value) return;

  // Remove existing layer if any
  if (geoJsonLayer.value) {
    map.removeLayer(geoJsonLayer.value);
    geoJsonLayer.value = null;
  }

  // Create new GeoJSON layer with native Leaflet
  geoJsonLayer.value = L.geoJSON(geoJsonData.value, {
    style: getStyle,
    onEachFeature: (feature: GeoJsonFeature, layer: L.Layer) => {
      const countryName = feature.properties?.dxcc_name
        || feature.properties?.name
        || feature.properties?.NAME
        || 'Unknown';

      layer.on({
        mouseover: (e) => {
          if (isUnmounting.value) return;
          const worked = isFeatureWorked(feature);
          const mismatch = isFeatureMismatch(feature);
          // Check if this country is visible based on filters
          const isVisible = mismatch || (worked && showWorked.value) || (!worked && showNeeded.value);
          if (isVisible) {
            const entityCode = getFeatureEntityCode(feature) || undefined;
            const entity = entityCode ? entitiesByCode.value.get(entityCode) : undefined;
            hoveredCountry.value = {
              name: countryName,
              worked,
              mismatch,
              entityCode,
              cqZone: entity?.cqZone,
              ituZone: entity?.ituZone,
              prefixes: entity?.prefixes,
            };
            (e.target as L.Path).setStyle({
              weight: 2,
              color: mismatch ? '#ff7961' : '#ffd700',
            });
          }
        },
        mouseout: (e) => {
          if (isUnmounting.value) return;
          const worked = isFeatureWorked(feature);
          if (shouldKeepHover(e)) {
            hoverLocked.value = true;
            return;
          }
          if (hoverLocked.value) return;
          hoveredCountry.value = null;
          const mismatch = isFeatureMismatch(feature);
          const isVisible = mismatch || (worked && showWorked.value) || (!worked && showNeeded.value);
          if (isVisible) {
            (e.target as L.Path).setStyle({
              weight: 1,
              color: mismatch ? '#ef5350' : worked ? '#66bb6a' : '#ffa726',
            });
          }
        },
      });
    },
  });

  geoJsonLayer.value.addTo(map);
}

// Update layer styles without recreating
function updateLayerStyles() {
  if (isUnmounting.value || !geoJsonLayer.value) return;

  geoJsonLayer.value.eachLayer((layer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feature = (layer as any).feature;
    if (feature) {
      const style = getStyle(feature);
      (layer as L.Path).setStyle(style);
    }
  });
}

// Load GeoJSON data
async function loadGeoJson() {
  try {
    const data = JSON.parse(dxccGeoJsonRaw);
    if (!isUnmounting.value) {
      geoJsonData.value = data;
      reportDxccMismatches(data);
    }
  } catch (error) {
    console.error('Failed to load GeoJSON:', error);
    geoJsonData.value = null;
  }
}

// Handle map ready event
function onMapReady() {
  // Create GeoJSON layer when map is ready and data is available
  if (geoJsonData.value) {
    createGeoJsonLayer();
  }
}

// Watch for data loading
watch(geoJsonData, (newData) => {
  if (newData && getLeafletMap()) {
    createGeoJsonLayer();
  }
});

// Watch for mode changes
watch(selectedMode, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

// Watch for filter changes
watch([showWorked, showNeeded], () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

watch(hoveredCountry, (current) => {
  if (current) {
    disableMapScrollZoom();
  } else {
    enableMapScrollZoom();
  }
});

// Watch for changes in worked entities
watch(() => awardsStore.dxcc[selectedMode.value].size, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

// Watch for any DXCC data changes
watch(() => awardsStore.dxccMixedCount, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

// Watch for recalculation
watch(() => awardsStore.lastCalculated, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

onMounted(() => {
  loadGeoJson();
});

onBeforeUnmount(() => {
  isUnmounting.value = true;
  // Clear our layer before vue-leaflet cleans up the map
  if (geoJsonLayer.value) {
    try {
      const layer = geoJsonLayer.value;
      const map = getLeafletMap();

      // Patch each sublayer to prevent removal errors
      layer.eachLayer((sublayer: L.Layer) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = sublayer as any;
        // Override onRemove to be a no-op
        path.onRemove = () => {};
        path.remove = () => path;
      });

      // Patch the layer group itself
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).onRemove = () => {};

      // Remove from map
      if (map && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    } catch {
      // Ignore errors during cleanup
    }
    geoJsonLayer.value = null;
  }
});
</script>

<template>
  <div class="dxcc-map-container">
    <div class="map-summary">
      <span class="summary-worked">{{ workedCount }} Worked</span>
      <span class="summary-divider">|</span>
      <span class="summary-needed">{{ totalCount - workedCount }} Needed</span>
    </div>
    <div class="dxcc-source-note">ARRL DXCC 2022</div>

    <div class="map-wrapper">
      <LMap
        ref="mapRef"
        :zoom="2"
        :center="[20, 0]"
        :use-global-leaflet="false"
        :options="{
          zoomControl: true,
          attributionControl: false,
          minZoom: 1,
          maxZoom: 6,
          worldCopyJump: true,
        }"
        class="leaflet-map"
        @ready="onMapReady"
      >
        <!-- Dark tile layer -->
        <LTileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          :options="{ opacity: 0.3 }"
        />

        <!-- Custom legend control -->
        <LControl position="topright">
          <div class="map-legend">
            <div class="legend-item">
              <span class="legend-box worked"></span> Worked
            </div>
            <div class="legend-item">
              <span class="legend-box needed"></span> Needed
            </div>
            <div class="legend-item">
              <span class="legend-box mismatch"></span> Mismatch (deleted/unknown)
            </div>
          </div>
        </LControl>

        <!-- Continent stats control -->
        <LControl position="bottomleft">
          <div class="continent-stats">
            <div class="stat-row">
              <span class="stat-label">NA:</span>
              <span class="stat-value">{{ continentStats['NA'].worked }}/{{ continentStats['NA'].total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">SA:</span>
              <span class="stat-value">{{ continentStats['SA'].worked }}/{{ continentStats['SA'].total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">EU:</span>
              <span class="stat-value">{{ continentStats['EU'].worked }}/{{ continentStats['EU'].total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">AF:</span>
              <span class="stat-value">{{ continentStats['AF'].worked }}/{{ continentStats['AF'].total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">AS:</span>
              <span class="stat-value">{{ continentStats['AS'].worked }}/{{ continentStats['AS'].total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">OC:</span>
              <span class="stat-value">{{ continentStats['OC'].worked }}/{{ continentStats['OC'].total }}</span>
            </div>
          </div>
        </LControl>
      </LMap>

      <!-- Hover tooltip -->
      <div
        v-if="hoveredCountry"
        class="hover-tooltip"
        @wheel.prevent.stop
        @mouseenter="hoverLocked = true"
        @mouseleave="hoverLocked = false; hoveredCountry = null"
        ref="hoverBoxRef"
      >
        <div class="tooltip-name">{{ hoveredCountry.name }}</div>
        <div :class="['tooltip-status', hoveredCountry.mismatch ? 'mismatch' : hoveredCountry.worked ? 'worked' : 'needed']">
          {{ hoveredCountry.mismatch ? 'Mismatch' : hoveredCountry.worked ? 'Worked' : 'Needed' }}
        </div>
        <div class="tooltip-meta">
          <div v-if="hoveredCountry.entityCode">Code: {{ hoveredCountry.entityCode }}</div>
          <div v-if="hoveredCountry.cqZone">CQ: {{ hoveredCountry.cqZone }}</div>
          <div v-if="hoveredCountry.ituZone">ITU: {{ hoveredCountry.ituZone }}</div>
          <div v-if="hoveredCountry.prefixes?.length">Prefixes: {{ hoveredCountry.prefixes.join(', ') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dxcc-map-container {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.map-summary {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.dxcc-source-note {
  text-align: center;
  font-size: 0.75rem;
  color: #8a8a8a;
  margin-bottom: 0.5rem;
}

.summary-worked {
  color: #4caf50;
  font-weight: bold;
}

.summary-needed {
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

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #ccc;
  margin: 4px 0;
}

.legend-box {
  width: 16px;
  height: 12px;
  border-radius: 2px;
}

.legend-box.worked {
  background: #4caf50;
}

.legend-box.needed {
  background: #ff9800;
}

.legend-box.mismatch {
  background: #e53935;
}

.continent-stats {
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

.stat-label {
  color: #888;
  font-weight: bold;
}

.stat-value {
  color: #4caf50;
}

.hover-tooltip {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(51, 51, 51, 0.95);
  border: 1px solid #555;
  border-radius: 8px;
  padding: 8px 16px;
  text-align: center;
  z-index: 1000;
  pointer-events: auto;
  max-height: 45vh;
  overflow-y: auto;
}

.tooltip-name {
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 4px;
}

.tooltip-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  display: inline-block;
}

.tooltip-status.worked {
  background: #4caf50;
  color: #000;
}

.tooltip-status.needed {
  background: #ff9800;
  color: #000;
}

.tooltip-status.mismatch {
  background: #e53935;
  color: #fff;
}

.tooltip-meta {
  margin-top: 6px;
  font-size: 11px;
  color: #ddd;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
</style>
