<script lang="ts">
import { useQsoStore } from '../../store/qso'
import { fetchQRZData } from '../../utils/qrz'

export default {
  name: 'RemoteStation',
  data() {
    return {
      qsoStore: useQsoStore(),
      stationData: {
        flag: '',
        name: '',
        qth: '',
        country: ''
      }
    }
  },
  watch: {
    'qsoStore.qsoForm.callsign': {
      async handler(newCallsign: string) {
        if (this.qsoStore.isCallsignValid && newCallsign) {
          this.stationData = await fetchQRZData(newCallsign)
        } else {
          this.stationData = {
            flag: '',
            name: '',
            qth: '',
            country: ''
          }
        }
      },
      immediate: true
    }
  }
}
</script>

<template>
  <section class="remote-station-section">
    <h2 class="section-title">Remote Station</h2>
    <div v-if="qsoStore.isCallsignValid && qsoStore.qsoForm.callsign" class="remote-station-boxes">
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
