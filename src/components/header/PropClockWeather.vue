<script setup lang="ts">
import { computed } from 'vue';
import { usePropClockWeather } from '../../composables/usePropClockWeather';
import { usePropagationColors } from '../../composables/usePropagationColors';

const { utcTime, propStore, weatherStore } = usePropClockWeather();
const { kIndexColor, aIndexColor, sfiColor } = usePropagationColors();

const kColor = computed(() => kIndexColor(propStore.propData.kIndex));
const aColor = computed(() => aIndexColor(propStore.propData.aIndex));
const sfi = computed(() => sfiColor(propStore.propData.sfi));
</script>

<template>
  <div class="header-right prop-clock-weather">
    <h2 class="section-title">Propagation, Clock & WX</h2>
    <div class="prop-clock-weather-content">
      <div class="propagation-info">
        <div v-if="propStore.error" class="prop-error">
          <span>{{ propStore.error }}</span>
        </div>
        <div v-else class="prop-data" :class="{ 'is-loading': propStore.isLoading }">
          <div class="prop-item">
            <span class="prop-label">SFI</span>
            <span class="prop-value" :style="{ color: sfi }">{{
              propStore.propData.sfi
            }}</span>
          </div>
          <div class="prop-item">
            <span class="prop-label">A</span>
            <span class="prop-value" :style="{ color: aColor }">{{
              propStore.propData.aIndex
            }}</span>
          </div>
          <div class="prop-item">
            <span class="prop-label">K</span>
            <span class="prop-value" :style="{ color: kColor }">
              {{ propStore.propData.kIndex }}</span>
          </div>
          <div v-if="propStore.propData.aurora !== undefined" class="prop-item">
            <span class="prop-label">Aurora</span>
            <span class="prop-value aurora" :class="{ active: propStore.propData.aurora }">
              {{ propStore.propData.aurora ? 'YES' : 'NO' }}
            </span>
          </div>
        </div>
        <div
          v-if="propStore.propData.station"
          class="prop-station"
          :class="{ 'is-loading': propStore.isLoading }"
        >
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
          <span v-if="weatherStore.error" class="weather-error">{{ weatherStore.error }}</span>
          <span
            v-else
            class="weather-value"
            :class="{ 'is-loading': weatherStore.isLoading }"
          >
            {{ weatherStore.weatherInfo }}
          </span>
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


.weather-error {
  font-size: 0.8rem;
  color: #ff6b6b;
}

.is-loading {
  opacity: 0.5;
}
</style>
