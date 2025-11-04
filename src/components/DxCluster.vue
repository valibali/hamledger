<script lang="ts">
import { defineComponent } from 'vue';
import { useDxClusterStore } from '../store/dxCluster';
import type { DxSpot } from '../types/dxCluster';
import { useQsoStore } from '../store/qso';
import { useRigStore } from '../store/rig';
import type { MagnifierPosition, ScaleTick, LayoutSpot, TimerHandle } from '../types/dxCluster';

export default defineComponent({
  name: 'DxCluster',

  setup() {
    const dxStore = useDxClusterStore();
    const qsoStore = useQsoStore();
    const rigStore = useRigStore();

    return {
      dxStore,
      qsoStore,
      rigStore,
    };
  },

  data() {
    return {
      magnifierVisible: false as boolean,
      magnifierSpots: [] as DxSpot[],
      magnifierPosition: { x: 0, y: 0 } as MagnifierPosition,
      magnifierFrequency: '' as string,
      magnifierTimeout: null as TimerHandle | null,

      // Available options
      continents: ['EU', 'NA', 'SA', 'AS', 'AF', 'OC', 'AN'] as readonly string[],
      modes: ['PHONE', 'CW', 'FT8', 'FT4', 'RTTY', 'PSK31'] as readonly string[],
      pageLengthOptions: [25, 50, 65, 100, 200] as readonly number[],
    };
  },

  computed: {
    spots(): DxSpot[] {
      return this.dxStore.spots;
    },

    error(): string | null {
      return this.dxStore.error;
    },

    filters() {
      return this.dxStore.filters;
    },

    availableBands(): string[] {
      return this.dxStore.availableBands;
    },

    layoutSpots(): LayoutSpot[] {
      return this.getSpotLayout();
    },

    scaleTicks(): { major: ScaleTick[]; minor: ScaleTick[] } {
      return this.generateScaleTicks();
    },
  },

  methods: {
    formatFrequency(freqStr: string, showHz: boolean = false): string {
      const freq = parseFloat(freqStr);
      if (showHz) {
        // For magnifier: show frequency in MHz with Hz precision
        const freqMHz = freq / 1000;
        const formatted = freqMHz.toFixed(6);
        const parts = formatted.split('.');
        
        if (parts[1] && parts[1].length >= 3) {
          const integerPart = parts[0];
          const decimalPart = parts[1];
          const mainPart = decimalPart.substring(0, 3);
          const hzPart = decimalPart.substring(3);
          
          // If Hz part is all zeros, don't show it
          if (hzPart === '000') {
            return `${integerPart}.${mainPart} MHz`;
          }
          
          return `${integerPart}.${mainPart}.<span class="freq-hz">${hzPart}</span> MHz`;
        }
        return `${formatted} MHz`;
      }
      
      if (freq >= 1000) {
        return `${(freq / 1000).toFixed(3)} MHz`;
      }
      return `${freq} kHz`;
    },

    formatTime(timeStr: string, dateStr: string): string {
      try {
        // Format: "21:19" and "29/09/25"
        const [day, month, year] = dateStr.split('/');
        const fullYear = `20${year}`; // Assuming 21st century
        const isoDate = `${fullYear}-${month}-${day}T${timeStr}:00Z`;
        const date = new Date(isoDate);

        return (
          date.toLocaleTimeString('hu-HU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }) + 'Z'
        );
      } catch {
        return `${timeStr}Z`;
      }
    },

    selectBand(band: string): void {
      this.dxStore.selectBand(band);
    },

    toggleCdxFilter(value: string): void {
      this.dxStore.toggleFilter('selectedCdx', value);
    },

    toggleCdeFilter(value: string): void {
      this.dxStore.toggleFilter('selectedCde', value);
    },

    toggleModeFilter(value: string): void {
      this.dxStore.toggleFilter('selectedModes', value);
    },

    updateValidatedOnly(value: boolean): void {
      this.dxStore.updateFilters({ validatedOnly: value });
    },

    updatePageLength(value: number): void {
      this.dxStore.updateFilters({ pageLength: value });
    },

    getSpotPosition(frequency: string): number {
      const freq = parseFloat(frequency);
      const range = this.dxStore.actualFrequencyRange;
      if (!range) return 0;

      const percentage = ((freq - range.min) / (range.max - range.min)) * 100;
      return Math.max(0, Math.min(100, percentage));
    },

    getSpotOpacity(timeStr: string, dateStr: string): number {
      try {
        const [day, month, year] = dateStr.split('/');
        const fullYear = `20${year}`;
        const isoDate = `${fullYear}-${month}-${day}T${timeStr}:00Z`;
        const spotTime = new Date(isoDate);
        const now = new Date();
        const ageInHours = (now.getTime() - spotTime.getTime()) / (1000 * 60 * 60);

        // Fade from 1.0 to 0.3 over 24 hours
        const opacity = Math.max(0.3, 1.0 - (ageInHours / 24) * 0.7);
        return opacity;
      } catch {
        return 0.5;
      }
    },

    isSpotWorked(callsign: string): boolean {
      return this.qsoStore.currentSession.some(
        qso => qso.callsign.toUpperCase() === callsign.toUpperCase()
      );
    },

    getSpotLayout(): LayoutSpot[] {
      // Sort spots by age (newest first)
      const sortedSpots = [...this.spots].sort((a, b) => {
        const timeA = new Date(
          `20${a.Date.split('/')[2]}-${a.Date.split('/')[1]}-${a.Date.split('/')[0]}T${a.Time}:00Z`
        );
        const timeB = new Date(
          `20${b.Date.split('/')[2]}-${b.Date.split('/')[1]}-${b.Date.split('/')[0]}T${b.Time}:00Z`
        );
        return timeB.getTime() - timeA.getTime(); // Newest first
      });

      const layoutSpots: LayoutSpot[] = [];
      const halfPoint = Math.ceil(sortedSpots.length / 2);

      for (let i = 0; i < sortedSpots.length; i++) {
        const spot = sortedSpots[i];
        const position = this.getSpotPosition(spot.Frequency);

        // First half goes to column 0, second half to column 1
        const column = i < halfPoint ? 0 : 1;
        const leftOffset = 35 + column * 90; // Base position + column spacing

        // Calculate opacity for second column based on age within that column
        let opacity = this.getSpotOpacity(spot.Time, spot.Date);
        if (column === 1) {
          const indexInSecondColumn = i - halfPoint;
          const totalInSecondColumn = sortedSpots.length - halfPoint;
          // Linear interpolation from normal opacity to 15% for oldest
          const ageFactor = indexInSecondColumn / (totalInSecondColumn - 1);
          opacity = Math.max(0.15, opacity * (1 - ageFactor * 0.85));
        }

        layoutSpots.push({
          ...spot,
          position,
          leftOffset,
          column,
          customOpacity: opacity,
          worked: this.isSpotWorked(spot.DXCall),
        });
      }

      return layoutSpots;
    },

    showMagnifier(event: MouseEvent, frequency: string): void {
      // Clear any pending hide timeout
      if (this.magnifierTimeout) {
        clearTimeout(this.magnifierTimeout);
        this.magnifierTimeout = null;
      }

      const freq = parseFloat(frequency);
      const range = this.dxStore.actualFrequencyRange;
      if (!range) return;

      // Find all spots within ±5 kHz range
      const nearbySpots = this.spots
        .filter(spot => {
          const spotFreq = parseFloat(spot.Frequency);
          return Math.abs(spotFreq - freq) <= 5;
        })
        .sort((a, b) => {
          // Sort by age (newest first)
          const timeA = new Date(
            `20${a.Date.split('/')[2]}-${a.Date.split('/')[1]}-${a.Date.split('/')[0]}T${a.Time}:00Z`
          );
          const timeB = new Date(
            `20${b.Date.split('/')[2]}-${b.Date.split('/')[1]}-${b.Date.split('/')[0]}T${b.Time}:00Z`
          );
          return timeB.getTime() - timeA.getTime();
        });

      if (nearbySpots.length <= 1) return;

      this.magnifierSpots = nearbySpots;
      this.magnifierFrequency = `${(freq / 1000).toFixed(3)} MHz környéke`;

      // Position magnifier near mouse but keep it in viewport
      this.magnifierPosition = {
        x: Math.min(event.clientX + 20, window.innerWidth - 300),
        y: Math.max(event.clientY - 100, 20),
      };

      this.magnifierVisible = true;
    },

    hideMagnifier(): void {
      // Delay hiding to prevent flickering
      this.magnifierTimeout = setTimeout(() => {
        this.magnifierVisible = false;
        this.magnifierSpots = [];
      }, 100);
    },

    keepMagnifierVisible(): void {
      // Clear hide timeout when mouse enters magnifier
      if (this.magnifierTimeout) {
        clearTimeout(this.magnifierTimeout);
        this.magnifierTimeout = null;
      }
    },

    getBandDisplayName(bandName: string): string {
      // Return the band name as-is since it already contains the proper unit
      return bandName;
    },

    generateScaleTicks(): { major: ScaleTick[]; minor: ScaleTick[] } {
      const range = this.dxStore.actualFrequencyRange;
      if (!range) return { major: [], minor: [] };

      const majorTicks: ScaleTick[] = [];
      const minorTicks: ScaleTick[] = [];
      const step = (range.max - range.min) / 10;

      for (let i = 0; i <= 10; i++) {
        const freq = range.min + step * i;
        const position = (i / 10) * 100;

        if (i % 2 === 0) {
          majorTicks.push({
            frequency: freq,
            position: position,
            label: `${(freq / 1000).toFixed(3)}`,
          });
        } else {
          minorTicks.push({
            frequency: freq,
            position: position,
          });
        }
      }

      return { major: majorTicks, minor: minorTicks };
    },

    handleSpotClick(spot: DxSpot): void {
      // Convert frequency from kHz to Hz for rig (spot.Frequency is in kHz)
      const freqInHz = parseFloat(spot.Frequency) * 1000;

      // Set rig frequency (rig store expects Hz)
      // The band will be automatically calculated from frequency in the rig store
      this.rigStore.setFrequency(freqInHz);

      // Map DX spot mode to rig mode
      let rigMode = spot.Mode;
      if (spot.Mode === 'LSB' || spot.Mode === 'USB') {
        rigMode = spot.Mode;
      } else if (spot.Mode === 'PHONE') {
        // Determine LSB/USB based on frequency
        const freqKHz = parseFloat(spot.Frequency);
        rigMode = freqKHz < 10000 ? 'LSB' : 'USB';
      } else if (spot.Mode === 'CW') {
        rigMode = 'CW';
      } else if (spot.Mode.includes('FT') || spot.Mode === 'RTTY' || spot.Mode === 'PSK31') {
        rigMode = 'DATA';
      } else {
        rigMode = 'USB'; // Default fallback
      }

      // Set rig mode
      this.rigStore.setMode(rigMode);

      // Set callsign in QSO form
      this.qsoStore.updateQsoForm('callsign', spot.DXCall);

      // Fetch station info for the callsign
      this.qsoStore.fetchStationInfo(spot.DXCall);
    },
  },

  mounted() {
    this.dxStore.startAutoRefresh();
  },

  unmounted() {
    this.dxStore.stopAutoRefresh();
  },
});
</script>

<template>
  <div class="dx-cluster">
    <h2 class="section-title">DX Cluster - {{ filters.selectedBand }} band</h2>

    <div class="dx-cluster-main">
      <!-- Frequency Scale and Spots -->
      <div class="spots-column">
        <div v-if="error" class="error">
          Error: {{ error }}
          <button @click="dxStore.fetchSpots" class="retry-btn">Try again!</button>
        </div>

        <div v-else-if="spots.length === 0" class="no-spots">No spots available.</div>

        <div v-else class="frequency-scale">
          <!-- Scale -->
          <div class="scale-container">
            <div class="scale-line"></div>

            <!-- Major ticks -->
            <div
              v-for="tick in scaleTicks.major"
              :key="`major-${tick.frequency}`"
              class="major-tick"
              :style="{ top: `${100 - tick.position}%` }"
            >
              <div class="tick-mark major"></div>
              <div class="tick-label">{{ tick.label }}</div>
            </div>

            <!-- Minor ticks -->
            <div
              v-for="tick in scaleTicks.minor"
              :key="`minor-${tick.frequency}`"
              class="minor-tick"
              :style="{ top: `${100 - tick.position}%` }"
            >
              <div class="tick-mark minor"></div>
            </div>

            <!-- Spots -->
            <div
              v-for="spot in layoutSpots"
              :key="spot.Nr"
              class="spot-label"
              :style="{
                top: `${100 - spot.position}%`,
                left: `${spot.leftOffset}px`,
                opacity: spot.customOpacity,
                zIndex: spot.column + 1,
              }"
              :class="{
                worked: spot.worked,
                lotw: spot.LOTW,
                eqsl: spot.EQSL,
                [`column-${spot.column}`]: true,
              }"
              :title="`${spot.DXCall} - ${formatFrequency(spot.Frequency)} - Spotters: ${spot.Spotters.join(', ')} - ${spot.Comment}`"
              @mouseenter="showMagnifier($event, spot.Frequency)"
              @mouseleave="hideMagnifier"
              @click="handleSpotClick(spot)"
            >
              {{ spot.DXCall }}
            </div>
          </div>
        </div>
      </div>

      <!-- Magnifier Window -->
      <div
        v-if="magnifierVisible"
        class="magnifier-window"
        :style="{
          left: `${magnifierPosition.x}px`,
          top: `${magnifierPosition.y}px`,
        }"
        @mouseenter="keepMagnifierVisible"
        @mouseleave="hideMagnifier"
      >
        <div class="magnifier-header">
          <h4>{{ magnifierFrequency }}</h4>
          <span class="spot-count">{{ magnifierSpots.length }} spot</span>
        </div>
        <div class="magnifier-content">
          <div
            v-for="spot in magnifierSpots"
            :key="`mag-${spot.Nr}`"
            class="magnifier-spot"
            :class="{
              worked: isSpotWorked(spot.DXCall),
              lotw: spot.LOTW,
              eqsl: spot.EQSL,
            }"
            @click="handleSpotClick(spot)"
          >
            <div class="spot-info">
              <div class="spot-call">{{ spot.DXCall }}</div>
              <div class="spot-freq" v-html="formatFrequency(spot.Frequency, true)"></div>
              <div class="spot-details">
                <span class="spot-mode">{{ spot.Mode }}</span>
                <span class="spot-time">{{ formatTime(spot.Time, spot.Date) }}</span>
                <span class="spot-spotter">{{ spot.Spotters.join(', ') }}</span>
              </div>
              <div class="spot-comment" v-if="spot.Comment">{{ spot.Comment }}</div>
            </div>
            <div class="spot-status">
              <div class="worked-status">
                <span v-if="isSpotWorked(spot.DXCall)" class="status-text worked">Worked</span>
                <span v-else class="status-text not-worked">Not worked</span>
              </div>
              <div class="spot-badges">
                <span v-if="spot.LOTW" class="badge lotw" title="LOTW">L</span>
                <span v-if="spot.EQSL" class="badge eqsl" title="eQSL">E</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters Column -->
      <div class="filters-column">
        <!-- Band Selection -->
        <div class="filter-group">
          <label class="filter-label">Band:</label>
          <div class="filter-buttons-column">
            <button
              v-for="band in availableBands"
              :key="`band-${band}`"
              :class="['filter-btn-small', { active: filters.selectedBand === band }]"
              @click="selectBand(band)"
            >
              {{ band }}
            </button>
          </div>
        </div>

        <!-- Remote Country (CDX) -->
        <div class="filter-group">
          <label class="filter-label">DX:</label>
          <div class="filter-buttons-column">
            <button
              v-for="continent in continents"
              :key="`cdx-${continent}`"
              :class="['filter-btn-small', { active: filters.selectedCdx.includes(continent) }]"
              @click="toggleCdxFilter(continent)"
            >
              {{ continent }}
            </button>
          </div>
        </div>

        <!-- Spotter Country (CDE) -->
        <div class="filter-group">
          <label class="filter-label">DE:</label>
          <div class="filter-buttons-column">
            <button
              v-for="continent in continents"
              :key="`cde-${continent}`"
              :class="['filter-btn-small', { active: filters.selectedCde.includes(continent) }]"
              @click="toggleCdeFilter(continent)"
            >
              {{ continent }}
            </button>
          </div>
        </div>

        <!-- Modes -->
        <div class="filter-group">
          <label class="filter-label">Mode:</label>
          <div class="filter-buttons-column">
            <button
              v-for="mode in modes"
              :key="`mode-${mode}`"
              :class="['filter-btn-small', { active: filters.selectedModes.includes(mode) }]"
              @click="toggleModeFilter(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </div>

        <!-- Additional Options -->
        <div class="filter-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="filters.validatedOnly"
              @change="updateValidatedOnly(($event.target as HTMLInputElement)?.checked ?? false)"
            />
            Valid
          </label>

          <div class="page-length-selector">
            <label>Spots:</label>
            <select
              :value="filters.pageLength"
              @change="
                updatePageLength(parseInt(($event.target as HTMLSelectElement)?.value ?? '25'))
              "
            >
              <option v-for="length in pageLengthOptions" :key="length" :value="length">
                {{ length }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dx-cluster {
  height: 100%;
  width: auto;
  display: flex;
  flex-direction: column;
  background: var(--bg-lighter);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-color);
  padding: 1rem;
}

.dx-cluster-main {
  display: flex;
  flex: 1;
  gap: 1rem;
  overflow: hidden;
}

.spots-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filters-column {
  width: 60px;
  background: var(--bg-darker);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  padding: 0.2rem;
  overflow-y: auto;
}

.filter-group {
  margin-bottom: 0.5rem;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-weight: 600;
}

.filter-buttons-column {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-btn-small {
  padding: 0.2rem;
  border: 1px solid var(--border-color);
  background: var(--bg-lighter);
  color: var(--text-secondary);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.6rem;
  text-align: center;
  font-weight: 600;
  min-height: 24px;
  width: 100%;
  aspect-ratio: 1;
}

.filter-btn-small:hover {
  background: var(--bg-darker);
  border-color: var(--main-color);
}

.filter-btn-small.active {
  background: var(--main-color);
  color: white;
  border-color: var(--main-color);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.65rem;
  margin-bottom: 0.3rem;
}

.page-length-selector {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.65rem;
}

.page-length-selector select {
  padding: 0.2rem;
  border: 1px solid var(--border-color);
  background: var(--bg-lighter);
  color: var(--text-primary);
  border-radius: var(--border-radius);
  font-size: 0.65rem;
  width: 100%;
}

.frequency-scale {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.scale-container {
  position: relative;
  height: 100%;
  width: 100%;
  padding: 20px 20px 20px 25px;
  overflow-x: none;
  min-width: 400px;
}

.scale-line {
  position: absolute;
  left: 0px;
  top: 0px;
  bottom: 0px;
  width: 1px;
  background: var(--main-color);
}

.major-tick,
.minor-tick {
  position: absolute;
  left: 0px;
}

.tick-mark {
  position: absolute;
  background: var(--main-color);
}

.tick-mark.major {
  width: 20px;
  height: 1px;
  left: 0px;
}

.tick-mark.minor {
  width: 10px;
  height: 1px;
  left: 0px;
}

.tick-label {
  position: absolute;
  left: 0px;
  top: -15px;
  font-size: 0.7rem;
  color: var(--main-color);
  white-space: nowrap;
  text-align: center;
  width: 40px;
}

.spot-label {
  position: absolute;
  left: 35px;
  background: var(--bg-darker);
  color: var(--text-primary);
  padding: 0.2rem 0.4rem;
  border-radius: var(--border-radius);
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid rgba(255, 165, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  transform: translateY(-50%);
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spot-label:active {
  transform: translateY(-50%) scale(0.95);
  background: var(--main-color);
  color: white;
}

.spot-label:hover {
  background: var(--bg-lighter);
  z-index: 100 !important;
  max-width: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.spot-label.column-0 {
  background: var(--bg-darker);
}

.spot-label.column-1 {
  background: var(--bg-darker);
}

.spot-label.worked {
  border: 1px solid rgba(34, 197, 94, 0.9);
}

.spot-label.lotw {
  border-right: 3px solid #3b82f6;
}

.spot-label.eqsl {
  border-right: 3px solid #f59e0b;
}

.spot-label.lotw.eqsl {
  border-right: 3px solid #3b82f6;
  box-shadow: inset -3px 0 0 #f59e0b;
}

.loading,
.error,
.no-spots {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-style: italic;
}

.error {
  flex-direction: column;
  gap: 1rem;
  color: var(--main-color);
}

.retry-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--main-color);
  background: var(--main-color);
  color: white;
  border-radius: var(--border-radius);
  cursor: pointer;
}

.magnifier-window {
  position: fixed;
  background: var(--bg-darker);
  border: 2px solid var(--main-color);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  min-width: 280px;
  max-width: 400px;
  max-height: 300px;
  overflow: hidden;
}

.magnifier-header {
  background: var(--main-color);
  color: white;
  padding: 0.5rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.magnifier-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.spot-count {
  font-size: 0.8rem;
  opacity: 0.9;
}

.magnifier-content {
  max-height: 240px;
  overflow-y: auto;
  padding: 0.5rem;
}

.magnifier-spot {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: var(--bg-lighter);
  border-radius: var(--border-radius);
  border: 1px solid rgba(255, 165, 0, 0.15);
  transition: all 0.2s ease;
  cursor: pointer;
}

.magnifier-spot:hover {
  border: 1px solid var(--main-color);
}

.magnifier-spot:last-child {
  margin-bottom: 0;
}

.magnifier-spot.worked {
  border: 1px solid rgba(34, 197, 94, 0.9);
}

.magnifier-spot.lotw {
  border-right: 3px solid #3b82f6;
}

.magnifier-spot.eqsl {
  border-right: 3px solid #f59e0b;
}

.spot-info {
  flex: 1;
  padding: 0.5rem;
}

.spot-call {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}

.spot-freq {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--main-color);
  margin-bottom: 0.3rem;
}

.spot-details {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.spot-mode {
  background: var(--bg-dark);
  padding: 0.1rem 0.3rem;
  border-radius: var(--border-radius-sm);
}

.spot-comment {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 0.2rem;
  word-break: break-word;
}

.spot-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  margin-left: 0.5rem;
}

.worked-status {
  display: flex;
  justify-content: flex-end;
}

.status-text {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem;
  border-radius: var(--border-radius-sm);
  text-transform: uppercase;
}

.status-text.worked {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.status-text.not-worked {
  background: rgba(255, 165, 0, 0.2);
  color: var(--main-color);
  border: 1px solid rgba(255, 165, 0, 0.4);
}

.spot-badges {
  display: flex;
  flex-direction: row;
  gap: 0.2rem;
}

.badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 0.7rem;
  font-weight: 600;
}

.badge.worked {
  background: #22c55e;
  color: white;
}

.badge.lotw {
  background: #3b82f6;
  color: white;
}

.badge.eqsl {
  background: #f59e0b;
  color: white;
}

:deep(.freq-hz) {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.7rem !important;
}

@media (max-width: 768px) {
  .dx-cluster-main {
    flex-direction: column;
  }

  .filters-column {
    width: auto;
    height: auto;
    max-height: 200px;
  }

  .filter-buttons-column {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .magnifier-window {
    min-width: 250px;
    max-width: 90vw;
  }
}
</style>
