<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { LMap, LTileLayer, LControl } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { useAwardsStore } from '../../store/awards';
import { CQ_ZONES_GEOJSON, CQ_ZONE_LABELS_GEOJSON } from '../../data/cqZones';
import type { ModeCategory } from '../../types/awards';
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
const hoveredZone = ref<number | null>(null);
const geoJsonData = shallowRef<GeoJsonFeatureCollection | null>(null);
const labelGeoJsonData = shallowRef<GeoJsonFeatureCollection | null>(null);
const mapRef = ref<InstanceType<typeof LMap> | null>(null);
const geoJsonLayer = shallowRef<L.Layer | null>(null);
const labelLayer = shallowRef<L.LayerGroup | null>(null);
const isUnmounting = ref(false);
const MAX_MERCATOR_LAT = 85.05112878;
function getLeafletMap(): L.Map | null {
  const map = mapRef.value?.leafletObject;
  return map ? (map as unknown as L.Map) : null;
}

// Computed
const workedZones = computed(() => awardsStore.waz[selectedMode.value]);
const workedCount = computed(() => workedZones.value.size);
const totalZones = 40;

// Check if zone is worked
function isZoneWorked(zone: number): boolean {
  return workedZones.value.has(zone);
}

// Get zone number from GeoJSON feature
function getZoneNumber(feature: GeoJsonFeature): number {
  const raw = feature.properties?.zone ||
    feature.properties?.ZONE ||
    feature.properties?.cq_zone ||
    feature.properties?.CQ ||
    feature.properties?.name ||
    0;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampLat(lat: number): number {
  if (lat > MAX_MERCATOR_LAT) return MAX_MERCATOR_LAT;
  if (lat < -MAX_MERCATOR_LAT) return -MAX_MERCATOR_LAT;
  return lat;
}

function sanitizeLineString(coordinates: number[][]): number[][] {
  const cleaned: number[][] = [];
  for (const point of coordinates) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const [lng, lat] = point;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    cleaned.push([lng, clampLat(lat)]);
  }
  if (cleaned.length < 2) return [];
  // Unwrap longitudes to prevent dateline jumps between consecutive points.
  const unwrapped: number[][] = [];
  let prevLng = cleaned[0][0];
  unwrapped.push([prevLng, cleaned[0][1]]);
  for (let i = 1; i < cleaned.length; i++) {
    let [lng, lat] = cleaned[i];
    let diff = lng - prevLng;
    if (diff > 180) {
      lng -= 360;
    } else if (diff < -180) {
      lng += 360;
    }
    prevLng = lng;
    unwrapped.push([lng, lat]);
  }
  return unwrapped;
}

function sanitizePoint(coordinates: number[]): number[] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, clampLat(lat)];
}

function sanitizeGeoJson(data: GeoJsonFeatureCollection, type: 'LineString' | 'Point'): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];
  for (const feature of data.features || []) {
    if (feature.geometry?.type !== type) continue;
    if (type === 'LineString') {
      const cleaned = sanitizeLineString(feature.geometry.coordinates as number[][]);
      if (cleaned.length === 0) continue;
      features.push({
        type: 'Feature',
        properties: feature.properties || {},
        geometry: { type: 'LineString', coordinates: cleaned },
      });
    } else {
      const cleaned = sanitizePoint(feature.geometry.coordinates as number[]);
      if (!cleaned) continue;
      features.push({
        type: 'Feature',
        properties: feature.properties || {},
        geometry: { type: 'Point', coordinates: cleaned },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

// GeoJSON style function
function getStyle(feature: GeoJsonFeature): L.PathOptions {
  const zone = getZoneNumber(feature);
  const worked = isZoneWorked(zone);

  // Apply filters
  if (worked && !showWorked.value) {
    return { fillOpacity: 0, opacity: 0, weight: 0 };
  }
  if (!worked && !showNeeded.value) {
    return { fillOpacity: 0, opacity: 0, weight: 0 };
  }

  if (worked) {
    return {
      color: '#66bb6a',
      weight: 1,
      opacity: 0.9,
    };
  } else {
    return {
      color: '#ffa726',
      weight: 1,
      opacity: 0.7,
    };
  }
}

function createLabelIcon(zone: number, zoom: number): L.DivIcon {
  const size = Math.max(10, Math.round(zoom * 6));
  return L.divIcon({
    className: 'cqzone-label-icon',
    html: `<span style=\"font-size:${size}px\">${zone}</span>`,
    iconSize: [0, 0],
  });
}

function updateLabelIcons() {
  const map = getLeafletMap();
  if (isUnmounting.value || !labelLayer.value || !map) return;
  const zoom = map.getZoom();
  labelLayer.value.eachLayer((layer) => {
    const marker = layer as L.Marker;
    const zone = (marker.options as { zone?: number }).zone;
    if (zone) {
      marker.setIcon(createLabelIcon(zone, zoom));
    }
  });
}

function createLabelLayer() {
  const map = getLeafletMap();
  if (isUnmounting.value || !map || !labelGeoJsonData.value) return;

  if (labelLayer.value) {
    map.removeLayer(labelLayer.value);
    labelLayer.value = null;
  }

  const zoom = map.getZoom();
  const group = L.layerGroup();
  for (const feature of labelGeoJsonData.value.features || []) {
    const zone = getZoneNumber(feature);
    const coords = feature.geometry?.coordinates as number[] | undefined;
    if (!coords || coords.length < 2 || !zone) continue;
    const [lng, lat] = coords;
    const marker = L.marker([lat, lng], {
      icon: createLabelIcon(zone, zoom),
      interactive: false,
    });
    (marker.options as { zone?: number }).zone = zone;
    group.addLayer(marker);
  }

  labelLayer.value = group;
  labelLayer.value.addTo(map);
}

// Create or update the GeoJSON layer
function createGeoJsonLayer() {
  const map = getLeafletMap();
  if (isUnmounting.value || !map || !geoJsonData.value) return;

  // Remove existing layer if any
  if (geoJsonLayer.value) {
    if (map.hasLayer(geoJsonLayer.value)) {
      map.removeLayer(geoJsonLayer.value);
    }
    geoJsonLayer.value = null;
  }

  const vectorGrid = (L as any).vectorGrid.slicer(geoJsonData.value, {
    interactive: true,
    getFeatureId: (feature: GeoJsonFeature) => getZoneNumber(feature),
    vectorTileLayerStyles: {
      sliced: (properties: Record<string, unknown>) => {
        const zone = getZoneNumber({ properties } as GeoJsonFeature);
        const worked = isZoneWorked(zone);
        if (worked && !showWorked.value) return { opacity: 0, weight: 0 };
        if (!worked && !showNeeded.value) return { opacity: 0, weight: 0 };
        return {
          color: worked ? '#66bb6a' : '#ffa726',
          weight: 1,
          opacity: worked ? 0.9 : 0.7,
          fill: false,
          fillOpacity: 0,
        };
      },
    },
  });

  vectorGrid.on('mouseover', (e: { layer?: { properties?: Record<string, unknown> } }) => {
    if (isUnmounting.value) return;
    const zone = getZoneNumber({ properties: e.layer?.properties } as GeoJsonFeature);
    const worked = isZoneWorked(zone);
    const isVisible = (worked && showWorked.value) || (!worked && showNeeded.value);
    if (isVisible && zone > 0 && typeof (vectorGrid as any).setFeatureStyle === 'function') {
      hoveredZone.value = zone;
      (vectorGrid as any).setFeatureStyle(zone, { weight: 2, color: '#ffd700' });
    }
  });

  vectorGrid.on('mouseout', (e: { layer?: { properties?: Record<string, unknown> } }) => {
    if (isUnmounting.value) return;
    const zone = getZoneNumber({ properties: e.layer?.properties } as GeoJsonFeature);
    hoveredZone.value = null;
    if (typeof (vectorGrid as any).resetFeatureStyle === 'function') {
      (vectorGrid as any).resetFeatureStyle(zone);
    }
  });

  geoJsonLayer.value = vectorGrid;
  geoJsonLayer.value.addTo(map);
}

// Update layer styles without recreating
function updateLayerStyles() {
  if (isUnmounting.value || !geoJsonLayer.value) return;
  const layer = geoJsonLayer.value as unknown as { redraw?: () => void };
  if (layer.redraw) {
    layer.redraw();
  }
}

// Load GeoJSON data for CQ zones (from local data)
function loadGeoJson() {
  if (!isUnmounting.value) {
    geoJsonData.value = sanitizeGeoJson(CQ_ZONES_GEOJSON as GeoJsonFeatureCollection, 'LineString');
    labelGeoJsonData.value = sanitizeGeoJson(CQ_ZONE_LABELS_GEOJSON as GeoJsonFeatureCollection, 'Point');
  }
}

// Handle map ready event
function onMapReady() {
  if (geoJsonData.value) {
    createGeoJsonLayer();
  }
  if (labelGeoJsonData.value) {
    createLabelLayer();
  }
  const map = getLeafletMap();
  if (map) map.on('zoomend', updateLabelIcons);
}

// Watch for data loading
watch(geoJsonData, (newData) => {
  if (newData && mapRef.value?.leafletObject) {
    createGeoJsonLayer();
  }
});

watch(labelGeoJsonData, (newData) => {
  if (newData && mapRef.value?.leafletObject) {
    createLabelLayer();
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

// Watch for changes in worked zones
watch(() => awardsStore.waz[selectedMode.value].size, () => {
  if (!isUnmounting.value) {
    updateLayerStyles();
  }
});

// Watch for any WAZ data changes
watch(() => awardsStore.wazMixedCount, () => {
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
  const map = getLeafletMap();
  if (map) map.off('zoomend', updateLabelIcons);
  if (geoJsonLayer.value && typeof (geoJsonLayer.value as any).off === 'function') {
    try {
      (geoJsonLayer.value as any).off();
    } catch {
      // Ignore errors during cleanup
    }
  }
  geoJsonLayer.value = null;
  labelLayer.value = null;
});
</script>

<template>
  <div class="waz-map-container">
    <div class="map-summary">
      <span class="summary-worked">{{ workedCount }} Worked</span>
      <span class="summary-divider">|</span>
      <span class="summary-needed">{{ totalZones - workedCount }} Needed</span>
    </div>

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
          :options="{ opacity: 0.6 }"
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
            <div class="progress-text">{{ workedCount }} / {{ totalZones }}</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (workedCount / totalZones * 100) + '%' }"></div>
            </div>
          </div>
        </LControl>
      </LMap>

      <!-- Hover tooltip -->
      <div v-if="hoveredZone" class="hover-tooltip">
        <div class="tooltip-zone">Zone {{ hoveredZone }}</div>
        <div :class="['tooltip-status', isZoneWorked(hoveredZone) ? 'worked' : 'needed']">
          {{ isZoneWorked(hoveredZone) ? 'Worked' : 'Needed' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waz-map-container {
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

.tooltip-zone {
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

:deep(.cqzone-label-icon) {
  color: #e6e6e6;
  font-weight: 700;
  text-shadow: 0 0 2px #000, 0 0 6px #000;
  line-height: 1;
  pointer-events: none;
}
</style>
