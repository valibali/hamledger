<script lang="ts">
import { usePropagationStore } from '../../store/propagation';
import { useWeatherStore } from '../../store/weather';
import { DateHelper } from '../../utils/dateHelper';
import { configHelper } from '../../utils/configHelper';
import { MaidenheadLocator } from '../../utils/maidenhead';

export default {
  name: 'PropClockWeather',
  setup() {
    const propStore = usePropagationStore();
    const weatherStore = useWeatherStore();
    return { propStore, weatherStore };
  },
  data() {
    return {
      utcTime: '00:00:00',
      clockInterval: 0,
      dataRefreshInterval: 0,
    };
  },
  computed: {
    kIndexColor() {
      const aIndex = this.propStore.propData.kIndex;
      if (aIndex <= 2.25) return '#4ade80'; // green
      if (aIndex <= 5.4) return '#fb923c'; // orange
      return '#ef4444'; // red
    },
    aIndexColor() {
      const aIndex = this.propStore.propData.aIndex;
      if (aIndex <= 10) return '#4ade80'; // green
      if (aIndex <= 12) return '#fb923c'; // orange
      return '#ef4444'; // red
    },
    sfiColor() {
      const sfi = this.propStore.propData.sfi;
      if (sfi <= 25) return '#ef4444'; // red
      if (sfi <= 50) return '#fb923c'; // orange
      return '#4ade80'; // green
    },
  },
  async mounted() {
    this.updateUTCClock();
    this.clockInterval = window.setInterval(this.updateUTCClock, 1000);
    await this.propStore.updatePropagationData();
    await this.loadLocalWeather();

    // Refresh propagation and weather data every 30 seconds
    this.dataRefreshInterval = window.setInterval(
      () => {
        this.propStore.updatePropagationData();
        this.loadLocalWeather();
      },
      30 * 1000
    );
  },
  beforeUnmount() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    if (this.dataRefreshInterval) {
      clearInterval(this.dataRefreshInterval);
    }
  },
  methods: {
    updateUTCClock() {
      this.utcTime = DateHelper.getCurrentUTCTime();
    },
    async loadLocalWeather() {
      try {
        await configHelper.initSettings();
        const grid = configHelper.getSetting(['station'], 'grid');

        if (grid) {
          const coords = MaidenheadLocator.gridToLatLon(grid);
          await this.weatherStore.updateWeatherInfo(coords.lat, coords.lon);
        }
      } catch (error) {
        console.error('Error loading local weather:', error);
      }
    },
  },
};
</script>

<template>
  <div class="header-right prop-clock-weather">
    <h2 class="section-title">Propagation, Clock & WX</h2>
    <div class="prop-clock-weather-content">
      <div class="propagation-info">
        <div v-if="propStore.isLoading" class="prop-loading">
          <span>Loading...</span>
        </div>
        <div v-else-if="propStore.error" class="prop-error">
          <span>{{ propStore.error }}</span>
        </div>
        <div v-else class="prop-data">
          <div class="prop-item">
            <span class="prop-label">SFI</span>
            <span class="prop-value" :style="{ color: sfiColor }">{{
              propStore.propData.sfi
            }}</span>
          </div>
          <div class="prop-item">
            <span class="prop-label">A</span>
            <span class="prop-value" :style="{ color: aIndexColor }">{{
              propStore.propData.aIndex
            }}</span>
          </div>
          <div class="prop-item">
            <span class="prop-label">K</span>
            <span class="prop-value" :style="{ color: kIndexColor }">
              {{ propStore.propData.kIndex }}</span>
          </div>
          <div v-if="propStore.propData.aurora !== undefined" class="prop-item">
            <span class="prop-label">Aurora</span>
            <span class="prop-value aurora" :class="{ active: propStore.propData.aurora }">
              {{ propStore.propData.aurora ? 'YES' : 'NO' }}
            </span>
          </div>
        </div>
        <div v-if="propStore.propData.station" class="prop-station">
          <span class="station-label">{{ propStore.propData.station }}</span>
        </div>
      </div>

      <div class="clock-weather-block">
        <div class="utc-clock">
          <span class="clock-label">UTC:</span>
          <span class="clock-value">{{ utcTime }}</span>
        </div>
        <div class="local-weather">
          <span class="weather-label">Local WX:</span>
          <span v-if="weatherStore.isLoading" class="weather-loading">Loading...</span>
          <span v-else-if="weatherStore.error" class="weather-error">{{ weatherStore.error }}</span>
          <span v-else class="weather-value">{{ weatherStore.weatherInfo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Right: Prop, clock & WX */
.header-right.prop-clock-weather {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
}

/* Additional container to keep content below the title */
.prop-clock-weather-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
}

/* Prop info */
.propagation-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.prop-data {
  display: flex;
  gap: 1.5rem;
}

.prop-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.prop-label {
  font-size: 0.75rem;
  color: #ccc;
}

.prop-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--main-color);
}

.prop-value.aurora {
  font-size: 0.9rem;
  color: #ccc;
}

.prop-value.aurora.active {
  color: #ff6b6b;
  text-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
}

.prop-loading {
  font-size: 0.8rem;
  color: #ccc;
  font-style: italic;
}

.prop-error {
  font-size: 0.8rem;
  color: #ff6b6b;
}

.prop-station {
  font-size: 0.7rem;
  color: #999;
}

.station-label {
  font-style: italic;
}

/* Clock & weather */
.clock-weather-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.utc-clock,
.local-weather {
  display: flex;
  gap: 0.3rem;
  align-items: baseline;
}

.clock-label,
.weather-label {
  font-size: 0.8rem;
  color: #ccc;
}

.clock-value {
  font-size: 1.3rem;
  font-weight: bold;
  color: #fff;
}

.weather-value {
  font-size: 0.9rem;
  color: #eee;
}

.weather-loading {
  font-size: 0.8rem;
  color: #ccc;
  font-style: italic;
}

.weather-error {
  font-size: 0.8rem;
  color: #ff6b6b;
}
</style>
