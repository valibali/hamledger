<script lang="ts">
import { useAwardsStore } from '../../store/awards';

export default {
  name: 'StatisticsCharts',
  data() {
    return {
      awardsStore: useAwardsStore(),
    };
  },
  computed: {
    stats() {
      return this.awardsStore.stats;
    },

    // Top bands by QSO count
    topBands() {
      return Object.entries(this.stats.qsosByBand)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    },

    // Top modes by QSO count
    topModes() {
      return Object.entries(this.stats.qsosByMode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    },

    // QSOs by continent
    continentData() {
      return Object.entries(this.stats.qsosByContinent)
        .sort((a, b) => b[1] - a[1]);
    },

    // QSOs by year
    yearData() {
      return Object.entries(this.stats.qsosByYear)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    },

    maxBandCount() {
      return Math.max(...this.topBands.map(([, count]) => count), 1);
    },

    maxModeCount() {
      return Math.max(...this.topModes.map(([, count]) => count), 1);
    },

    maxContinentCount() {
      return Math.max(...this.continentData.map(([, count]) => count), 1);
    },

    maxYearCount() {
      return Math.max(...this.yearData.map(([, count]) => count), 1);
    },
  },
  methods: {
    getContinentName(code: string): string {
      const names: Record<string, string> = {
        'AF': 'Africa',
        'AN': 'Antarctica',
        'AS': 'Asia',
        'EU': 'Europe',
        'NA': 'N. America',
        'OC': 'Oceania',
        'SA': 'S. America',
      };
      return names[code] || code;
    },

    getBarWidth(value: number, max: number): string {
      return `${Math.max(2, (value / max) * 100)}%`;
    },

    formatNumber(num: number): string {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    },
  },
};
</script>

<template>
  <div class="statistics-charts">
    <div class="dxcc-source-note">DXCC data source: ARRL DXCC 2022</div>
    <!-- Charts Row: Band, Mode, Continent -->
    <div class="charts-row">
      <!-- QSOs by Band -->
      <div class="chart-section">
        <h4>QSOs by Band</h4>
        <div class="horizontal-bar-chart">
          <div v-for="[band, count] in topBands" :key="band" class="bar-row">
            <span class="bar-label">{{ band }}</span>
            <div class="bar-track">
              <div
                class="bar-fill band-bar"
                :style="{ width: getBarWidth(count, maxBandCount) }"
              ></div>
            </div>
            <span class="bar-value">{{ formatNumber(count) }}</span>
          </div>
        </div>
      </div>

      <!-- QSOs by Mode -->
      <div class="chart-section">
        <h4>QSOs by Mode</h4>
        <div class="horizontal-bar-chart">
          <div v-for="[mode, count] in topModes" :key="mode" class="bar-row">
            <span class="bar-label">{{ mode }}</span>
            <div class="bar-track">
              <div
                class="bar-fill mode-bar"
                :style="{ width: getBarWidth(count, maxModeCount) }"
              ></div>
            </div>
            <span class="bar-value">{{ formatNumber(count) }}</span>
          </div>
        </div>
      </div>

      <!-- QSOs by Continent -->
      <div class="chart-section">
        <h4>QSOs by Continent</h4>
        <div class="horizontal-bar-chart">
          <div v-for="[continent, count] in continentData" :key="continent" class="bar-row">
            <span class="bar-label">{{ getContinentName(continent) }}</span>
            <div class="bar-track">
              <div
                class="bar-fill continent-bar"
                :style="{ width: getBarWidth(count, maxContinentCount) }"
              ></div>
            </div>
            <span class="bar-value">{{ formatNumber(count) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- QSOs by Year - Full Width Row -->
    <div v-if="yearData.length > 0" class="chart-section year-section">
      <h4>QSOs by Year</h4>
      <div class="year-chart">
        <div v-for="[year, count] in yearData" :key="year" class="year-bar-column">
          <div class="year-bar-container">
            <div
              class="year-bar-fill"
              :style="{ height: getBarWidth(count, maxYearCount) }"
            ></div>
          </div>
          <span class="year-label">{{ year }}</span>
          <span class="year-value">{{ formatNumber(count) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.statistics-charts {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.dxcc-source-note {
  font-size: 0.75rem;
  color: #8a8a8a;
  text-align: right;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 0 0 auto;
}

@media (max-width: 1200px) {
  .charts-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 800px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-section {
  background: #3a3a3a;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #444;
  min-width: 0;
}

.chart-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #fff;
}

/* Horizontal Bar Chart */
.horizontal-bar-chart {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.bar-row {
  display: grid;
  grid-template-columns: 55px 1fr 40px;
  align-items: center;
  gap: 0.4rem;
}

.bar-label {
  font-size: 0.75rem;
  color: #ccc;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  height: 14px;
  background: #444;
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.band-bar {
  background: linear-gradient(90deg, var(--main-color), #8bc34a);
}

.mode-bar {
  background: linear-gradient(90deg, #2196f3, #03a9f4);
}

.continent-bar {
  background: linear-gradient(90deg, #9c27b0, #e91e63);
}

.bar-value {
  font-size: 0.75rem;
  color: var(--gray-color);
  text-align: right;
}

/* Year Chart - Full Width */
.year-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.year-chart {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex: 1;
  min-height: 140px;
}

.year-bar-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.year-bar-container {
  width: 100%;
  flex: 1;
  background: #444;
  border-radius: 3px 3px 0 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.year-bar-fill {
  width: 100%;
  background: linear-gradient(0deg, #ff9800, #ffc107);
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.year-label {
  margin-top: 0.25rem;
  font-size: 0.65rem;
  color: #ccc;
}

.year-value {
  font-size: 0.6rem;
  color: var(--gray-color);
}
</style>
