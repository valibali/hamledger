<script lang="ts">
import { useQsoStore } from '../../store/qso'
import { fetchQRZData } from '../../utils/qrz'
import { StationData } from '../../types/station'

export default {
  name: 'RemoteStation',
  data() {
    return {
      qsoStore: useQsoStore(),
      stationDataCache: null as StationData | null
    }
  },
  computed: {
    callsign() {
      return this.qsoStore.qsoForm.callsign
    },
    isValid() {
      return this.qsoStore.isCallsignValid
    },
    async stationData() {
      if (this.isValid && this.callsign) {
        if (!this.stationDataCache) {
          this.stationDataCache = await fetchQRZData(this.callsign)
        }
        return this.stationDataCache
      }
      
      return {
        flag: '',
        name: '',
        qth: '',
        country: ''
      }
    }
  },
  watch: {
    callsign() {
      // Reset cache when callsign changes
      this.stationDataCache = null
    }
  }
}
</script>

<template>
  <section class="remote-station-section">
    <h2 class="section-title">Remote Station</h2>
    <div v-if="isValid && callsign" class="remote-station-boxes">
      <!-- Box 1: Station details -->
      <div class="station-block station-remote">
        <img v-if="stationData.flag"
          :src="stationData.flag"
          :alt="stationData.country"
          class="station-flag"
        />
        <div class="station-info">
          <p class="station-name">Remote: {{ stationData.name || 'Loading...' }}</p>
          <p class="station-qth">QTH: {{ stationData.qth || 'Loading...' }}</p>
          <p v-if="stationData.country" class="station-country">Country: {{ stationData.country }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
