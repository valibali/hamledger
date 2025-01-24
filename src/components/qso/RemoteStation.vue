<script lang="ts">
import { useQsoStore } from '../../store/qso'
import { fetchQRZData } from '../../utils/qrz'
import { ref, watch } from 'vue'

export default {
  name: 'RemoteStation',
  setup() {
    const qsoStore = useQsoStore()
    const stationData = ref({
      flag: '',
      name: '',
      qth: '',
      country: ''
    })

    watch(() => qsoStore.qsoForm.callsign, async (newCallsign) => {
      if (qsoStore.isCallsignValid && newCallsign) {
        const data = await fetchQRZData(newCallsign)
        stationData.value = data
      } else {
        stationData.value = {
          flag: '',
          name: '',
          qth: '',
          country: ''
        }
      }
    })

    return { qsoStore, stationData }
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
