<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { LMap, LTileLayer, LControl } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';
import { useAwardsStore } from '../../store/awards';
import { US_STATES, isValidStateCode } from '../../data/usStates';
import type { ModeCategory } from '../../types/awards';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// GeoJSON types (simplified)
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
const hoveredState = ref<string | null>(null);
const geoJsonData = shallowRef<GeoJsonFeatureCollection | null>(null);
const mapRef = ref<InstanceType<typeof LMap> | null>(null);
const geoJsonLayer = shallowRef<L.GeoJSON | null>(null);
const isUnmounting = ref(false);

// US bounds
const usBounds: LatLngBoundsExpression = [
  [24, -125], // Southwest
  [50, -66],  // Northeast
];

// Computed
const states = computed(() => {
  const workedSet = awardsStore.was[selectedMode.value];
  return US_STATES.map(s => ({
    ...s,
    worked: workedSet.has(s.code),
  }));
});

const workedCount = computed(() => states.value.filter(s => s.worked).length);
const neededCount = computed(() => states.value.filter(s => !s.worked).length);
const stateNameSet = new Set(US_STATES.map(s => s.name.toLowerCase()));

// Create a map of state codes to worked status
const workedStates = computed(() => {
  const map = new Map<string, boolean>();
  for (const state of states.value) {
    map.set(state.code.toLowerCase(), state.worked);
    map.set(state.name.toLowerCase(), state.worked);
  }
  return map;
});

// Check if state is worked
function isStateWorked(stateCode: string): boolean {
  const code = stateCode.toLowerCase();
  return workedStates.value.get(code) || false;
}

// Get state name from code or GeoJSON property
function getStateName(feature: GeoJsonFeature): string {
  return feature.properties?.name ||
         feature.properties?.NAME ||
         feature.properties?.STUSPS ||
         feature.properties?.postal ||
         'Unknown';
}

function getStateCode(feature: GeoJsonFeature): string {
  return feature.properties?.STUSPS ||
         feature.properties?.postal ||
         feature.properties?.code ||
         feature.properties?.abbreviation ||
         '';
}

function isValidStateFeature(feature: GeoJsonFeature): boolean {
  const stateCode = getStateCode(feature);
  if (stateCode && isValidStateCode(stateCode)) return true;
  const stateName = getStateName(feature).toLowerCase();
  return stateNameSet.has(stateName);
}

// GeoJSON style function
function getStyle(feature: GeoJsonFeature): L.PathOptions {
  const stateCode = getStateCode(feature);
  const stateName = getStateName(feature);
  const worked = isStateWorked(stateCode) || isStateWorked(stateName);

  // Apply filters
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
  if (isUnmounting.value || !mapRef.value?.leafletObject || !geoJsonData.value) return;

  const map = mapRef.value.leafletObject;

  // Remove existing layer if any
  if (geoJsonLayer.value) {
    map.removeLayer(geoJsonLayer.value);
    geoJsonLayer.value = null;
  }

  // Create new GeoJSON layer with native Leaflet
  geoJsonLayer.value = L.geoJSON(geoJsonData.value, {
    filter: isValidStateFeature,
    style: getStyle,
    onEachFeature: (feature: GeoJsonFeature, layer: L.Layer) => {
      const stateName = getStateName(feature);
      const stateCode = getStateCode(feature);

      layer.on({
        mouseover: (e) => {
          if (isUnmounting.value) return;
          const worked = isStateWorked(stateCode) || isStateWorked(stateName);
          // Check if this state is visible based on filters
          const isVisible = (worked && showWorked.value) || (!worked && showNeeded.value);
          if (isVisible) {
            hoveredState.value = stateCode || stateName;
            (e.target as L.Path).setStyle({
              weight: 2,
              color: '#ffd700',
            });
          }
        },
        mouseout: (e) => {
          if (isUnmounting.value) return;
          const worked = isStateWorked(stateCode) || isStateWorked(stateName);
          hoveredState.value = null;
          const isVisible = (worked && showWorked.value) || (!worked && showNeeded.value);
          if (isVisible) {
            (e.target as L.Path).setStyle({
              weight: 1,
              color: worked ? '#66bb6a' : '#ffa726',
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

// Load GeoJSON data for US states
async function loadGeoJson() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json');
    const data = await response.json();
    if (!isUnmounting.value) {
      geoJsonData.value = data;
    }
  } catch (error) {
    console.error('Failed to load US states GeoJSON:', error);
    geoJsonData.value = null;
  }
}

// Handle map ready event
function onMapReady() {
  if (geoJsonData.value) {
    createGeoJsonLayer();
  }
}

// Watch for data loading
watch(geoJsonData, (newData) => {
  if (newData && mapRef.value?.leafletObject) {
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

// Watch for changes in worked states
watch(() => awardsStore.was[selectedMode.value].size, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

// Watch for any WAS data changes
watch(() => awardsStore.wasMixedCount, () => {
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
      const map = mapRef.value?.leafletObject;

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
  <div class="was-map-container">
    <div class="was-summary">
      <span class="summary-worked">{{ workedCount }} Worked</span>
      <span class="summary-divider">|</span>
      <span class="summary-needed">{{ neededCount }} Needed</span>
    </div>

    <div class="map-wrapper">
      <LMap
        ref="mapRef"
        :zoom="4"
        :center="[39, -98]"
        :max-bounds="usBounds"
        :use-global-leaflet="false"
        :options="{
          zoomControl: true,
          attributionControl: false,
          minZoom: 3,
          maxZoom: 8,
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
          </div>
        </LControl>

        <!-- Progress control -->
        <LControl position="bottomleft">
          <div class="progress-control">
            <div class="progress-text">{{ workedCount }} / 50</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (workedCount / 50 * 100) + '%' }"></div>
            </div>
          </div>
        </LControl>
      </LMap>

      <!-- Hover tooltip -->
      <div v-if="hoveredState" class="hover-tooltip">
        <div class="tooltip-code">{{ hoveredState }}</div>
        <div :class="['tooltip-status', isStateWorked(hoveredState) ? 'worked' : 'needed']">
          {{ isStateWorked(hoveredState) ? 'Worked' : 'Needed' }}
        </div>
      </div>
    </div>

    <!-- Note about Alaska/Hawaii -->
    <div class="map-note">
      Note: Alaska and Hawaii are not shown on this map but are included in the WAS count.
    </div>
  </div>
</template>

<style scoped>
.was-map-container {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.was-summary {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 1rem;
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

.progress-control {
  background: rgba(26, 26, 26, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #333;
  min-width: 100px;
}

.progress-text {
  font-size: 14px;
  font-weight: bold;
  color: #4caf50;
  text-align: center;
  margin-bottom: 4px;
}

.progress-bar {
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4caf50;
  transition: width 0.3s ease;
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
  pointer-events: none;
}

.tooltip-code {
  font-size: 18px;
  font-weight: bold;
  color: var(--main-color);
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

.map-note {
  margin-top: 0.5rem;
  font-size: 11px;
  color: #666;
  text-align: center;
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
