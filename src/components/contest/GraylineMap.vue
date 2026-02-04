<script lang="ts">
import { defineComponent } from 'vue';
import { LMap, LTileLayer, LPolyline, LPolygon } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { configHelper } from '../../utils/configHelper';
import { MaidenheadLocator } from '../../utils/maidenhead';

type LatLngTuple = [number, number];

export default defineComponent({
  name: 'GraylineMap',
  components: {
    LMap,
    LTileLayer,
    LPolyline,
    LPolygon,
  },

  data() {
    return {
      mapCenter: [0, 0] as LatLngTuple,
      zoom: 1,
      terminatorLine: [] as LatLngTuple[],
      nightPolygon: [] as LatLngTuple[],
      timer: null as number | null,
    };
  },

  mounted() {
    this.updateMapCenter();
    this.updateGrayline();
    this.timer = window.setInterval(this.updateGrayline, 60_000);
  },

  beforeUnmount() {
    if (this.timer) {
      window.clearInterval(this.timer);
    }
  },

  methods: {
    toRad(value: number): number {
      return (value * Math.PI) / 180;
    },

    toDeg(value: number): number {
      return (value * 180) / Math.PI;
    },

    normalizeLon(lon: number): number {
      let value = lon;
      while (value < -180) value += 360;
      while (value > 180) value -= 360;
      return value;
    },

    solarPosition(date: Date) {
      const jd = date.getTime() / 86400000 + 2440587.5;
      const t = (jd - 2451545.0) / 36525;

      const l0 =
        (280.46646 + 36000.76983 * t + 0.0003032 * t * t) % 360;
      const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
      const mRad = this.toRad(m);
      const c =
        (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
        (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
        0.000289 * Math.sin(3 * mRad);
      const trueLong = l0 + c;
      const omega = 125.04 - 1934.136 * t;
      const lambda =
        trueLong - 0.00569 - 0.00478 * Math.sin(this.toRad(omega));

      const eps0 =
        23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.04e-7 * t * t * t;
      const eps = eps0 + 0.00256 * Math.cos(this.toRad(omega));

      const lambdaRad = this.toRad(lambda);
      const epsRad = this.toRad(eps);
      const decl = Math.asin(Math.sin(epsRad) * Math.sin(lambdaRad));

      const ra = Math.atan2(
        Math.cos(epsRad) * Math.sin(lambdaRad),
        Math.cos(lambdaRad)
      );

      const jd0 = Math.floor(jd - 0.5) + 0.5;
      const h = (jd - jd0) * 24;
      const d0 = jd0 - 2451545.0;
      const gmstHours =
        6.697374558 +
        0.06570982441908 * d0 +
        1.00273790935 * h +
        0.000026 * t * t;
      const gmstDeg = ((gmstHours * 15) % 360 + 360) % 360;
      const subsolarLon = this.normalizeLon(this.toDeg(ra) - gmstDeg);

      return { declination: decl, subsolarLon };
    },

    updateGrayline() {
      const now = new Date();
      const { declination, subsolarLon } = this.solarPosition(now);
      const line: LatLngTuple[] = [];
      const step = 5;
      for (let lon = -180; lon <= 180; lon += step) {
        let lat = 0;
        const h = this.toRad(lon - subsolarLon);
        const tanDecl = Math.tan(declination);
        if (Math.abs(tanDecl) < 1e-6) {
          lat = 0;
        } else {
          lat = this.toDeg(Math.atan(-Math.cos(h) / tanDecl));
        }
        line.push([lat, lon]);
      }

      const poleLat = declination > 0 ? -90 : 90;

      const night: LatLngTuple[] = [
        ...line,
        [poleLat, 180],
        [poleLat, -180],
      ];

      this.terminatorLine = line;
      this.nightPolygon = night;
    },

    updateMapCenter() {
      const grid = configHelper.getSetting(['station'], 'grid') as string | undefined;
      if (!grid) return;
      try {
        const coords = MaidenheadLocator.gridToLatLon(grid);
        this.mapCenter = [coords.lat, coords.lon];
      } catch {
        // Keep default center if grid is invalid
      }
    },
  },
});
</script>

<template>
  <div class="grayline-map">
    <LMap :zoom="zoom" :center="mapCenter" :use-global-leaflet="false" class="leaflet-map">
      <LTileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <LPolygon
        v-if="nightPolygon.length"
        :lat-lngs="nightPolygon"
        :color="'rgba(0,0,0,0)'"
        :weight="0"
        :fill-color="'rgba(0,0,0,0.45)'"
        :fill-opacity="0.45"
      />
      <LPolyline
        v-if="terminatorLine.length"
        :lat-lngs="terminatorLine"
        :color="'#ff9f1a'"
        :weight="1.5"
        :opacity="0.9"
      />
    </LMap>
    <div class="grayline-label">Grayline (UTC)</div>
  </div>
</template>

<style scoped>
.grayline-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.leaflet-map {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 1px solid #2b2f3a;
}

.grayline-label {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.35);
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
}

:deep(.leaflet-container) {
  background: #0d0f14;
}
</style>
