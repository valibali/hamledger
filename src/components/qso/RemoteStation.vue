<script lang="ts">
import { useQsoStore } from '../../store/qso'
import { fetchQRZData } from '../../utils/qrz'
import { QRZData } from '../../types/station'

export default {
  name: 'RemoteStation',
  data() {
    return {
      qsoStore: useQsoStore(),
      qrzDataCache: null as QRZData | null
    }
  },
  computed: {
    callsign() {
      return this.qsoStore.qsoForm.callsign
    },
    isValid() {
      return this.qsoStore.isCallsignValid
    },
    stationData() {
      return this.qsoStore.stationInfo
    },
    qrzData(): QRZData {
      if (!this.qrzDataCache) {
        return {
          name: '',
          qth: ''
        }
      }
      return this.qrzDataCache
    }
  },
  watch: {
    async callsign() {
      // Reset cache and fetch new data when callsign changes
      this.qrzDataCache = null
      if (this.isValid && this.callsign) {
        const qrzData = await fetchQRZData(this.callsign)
        if (!(qrzData instanceof Error)) {
          this.qrzDataCache = qrzData
          this.qsoStore.updateStationInfo({ qrzData })
        }
      }
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
        <img v-if="stationData.flag" :src="stationData.flag" :alt="stationData.country" class="station-flag" />
        <div class="station-info">
          <p class="station-name">Remote: {{ qrzData.name || 'Loading...' }}</p>
          <p class="station-qth">QTH: {{ qrzData.qth || 'Loading...' }}</p>
          <p class="station-country">Country: {{ stationData.country || 'Loading...' }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
