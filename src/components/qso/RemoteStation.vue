<script lang="ts">
import { useQsoStore } from '../../store/qso';
import { StationData } from '../../types/station';
import { CallsignHelper } from '../../utils/callsign';

export default {
  name: 'RemoteStation',
  data() {
    return {
      debounceTimer: null as NodeJS.Timeout | null,
    };
  },
  setup() {
    const qsoStore = useQsoStore();
    return { qsoStore };
  },
  methods: {
    getPortableSuffixMeaning(suffix: string): string {
      return CallsignHelper.getPortableSuffixMeaning(suffix) || suffix;
    },
    async debouncedFetchStationInfo(callsign: string) {
      // Clear any existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Set a new timer
      this.debounceTimer = setTimeout(async () => {
        if (this.isValid && callsign && callsign.length >= 3) {
          await this.qsoStore.fetchStationInfo(callsign);
        }
      }, 500); // 500ms debounce delay
    },
  },
  computed: {
    callsign() {
      return this.qsoStore.qsoForm.callsign;
    },
    isValid() {
      return this.qsoStore.isCallsignValid;
    },
    stationInfo(): StationData | null {
      return this.qsoStore.stationInfo;
    },
    qrzError(): boolean {
      return this.qsoStore.stationInfo.qrzError || false
    }
  },
  watch: {
    callsign(newCallsign: string) {
      // Clear QRZ error state when callsign changes
      this.qsoStore.stationInfo.qrzError = false;
      
      if (newCallsign) {
        this.debouncedFetchStationInfo(newCallsign);
      } else {
        // Clear timer if callsign is empty
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        // Reset station info when callsign is cleared
        this.qsoStore.stationInfo = {
          baseData: {},
          geodata: {},
          flag: '',
          weather: '',
          localTime: '',
          greetings: [],
          distance: undefined,
          portableSuffix: null,
          qrzError: false,
        };
      }
    },
  },
  beforeUnmount() {
    // Clean up timer when component is destroyed
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  },
};
</script>

<template>
  <section class="section-box">
    <h2 class="section-title">Remote Station</h2>
    <div v-if="isValid && callsign" class="remote-station-boxes">
      <!-- Station details with integrated location -->
      <div class="station-block station-remote" :class="{ 'qrz-error': qrzError }">
        <img
          v-if="stationInfo?.flag"
          :src="stationInfo.flag"
          :alt="stationInfo.baseData.country"
          class="station-flag"
        />
        <div class="station-info">
          <div v-if="qrzError" class="qrz-error-message">
            ⚠️ QRZ lookup failed. Please check your QRZ.com credentials in settings.
          </div>
          <p class="station-name">Remote: {{ stationInfo?.baseData?.name }}</p>
          <p class="station-qth">QTH: {{ stationInfo?.baseData?.qth || 'N/A' }}</p>
          <p class="station-country">
            Country: {{ stationInfo?.baseData?.country || 'N/A' }}
          </p>
          <template v-if="stationInfo?.geodata">
            <p class="station-coords-text">Lat: {{ stationInfo.geodata.lat?.toFixed(4) }}°</p>
            <p class="station-coords-text">Lon: {{ stationInfo.geodata.lon?.toFixed(4) }}°</p>
            <p v-if="stationInfo.geodata.display_name" class="station-coords-text">
              Location: {{ stationInfo.geodata.display_name }}
            </p>
          </template>
          <p v-if="stationInfo?.baseData?.grid" class="station-coords-text">
            Grid: {{ stationInfo.baseData.grid }}
          </p>
          <p v-if="stationInfo?.distance && !stationInfo?.portableSuffix" class="station-distance">
            Distance: {{ stationInfo.distance }} km
          </p>
          <p v-if="stationInfo?.portableSuffix" class="station-portable">
            Operation: {{ getPortableSuffixMeaning(stationInfo.portableSuffix) }}
          </p>
        </div>
      </div>

      <!-- Weather and Time -->
      <div
        v-if="stationInfo?.weather || stationInfo?.localTime"
        class="station-block station-weather"
      >
        <div class="station-info">
          <p class="station-weather-title">Local Info</p>
          <p v-if="stationInfo.weather" class="station-weather-text">{{ stationInfo.weather }}</p>
          <p v-if="stationInfo.localTime" class="station-time">
            Local time: {{ stationInfo.localTime }}
          </p>
        </div>
      </div>
    </div>
    <div v-else class="no-station-info">
      <p>Enter a callsign</p>
    </div>
  </section>
</template>

<style scoped>
/* The row of boxes side by side */
.remote-station-boxes {
  display: flex;
  flex-direction: row;
  gap: 1rem;
}

/* Station blocks */
.station-block {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1px solid var(--main-color);
  padding: 0.5rem;
  border-radius: 4px;
  background: #2b2b2b;
  min-width: 200px;
}

.qrz-error {
  background: rgba(255, 0, 0, 0.1);
}

.qrz-error-message {
  color: #ff6b6b;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  padding: 0.3rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #ff6b6b;
  border-radius: 3px;
}

.station-flag {
  height: 50px;
  width: auto;
  border: 1px solid #555;
  border-radius: 3px;
}

.station-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
  line-height: 1.2;
}

.station-name {
  font-weight: bold;
  color: var(--main-color);
}

.station-weather,
.station-qth,
.station-coords-text,
.station-weather-text {
  color: var(--gray-color);
}

.station-distance,
.station-portable {
  color: var(--main-color);
  font-weight: bold;
  margin-top: 0.2rem;
}

.station-coords-title,
.station-weather-title {
  font-weight: bold;
  color: var(--main-color);
  margin-bottom: 0.2rem;
}

.station-time {
  color: var(--gray-color);
  margin-top: 0.3rem;
  font-style: italic;
  font-weight: bold;
}

.station-greeting-line {
  margin-top: 0.3rem;
  color: var(--main-color);
  font-style: italic;
}

.no-station-info {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
  color: var(--gray-color);
  font-style: italic;
}
</style>
