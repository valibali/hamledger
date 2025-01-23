<script lang="ts">
import { useRemoteStationStore } from '../../store/remote-station'

export default {
  name: 'RemoteStation',
  setup() {
    const remoteStore = useRemoteStationStore()
    return { remoteStore }
  },
  computed: {
    flag() {
      return this.remoteStore.stationInfo.flag
    },
    name() {
      return this.remoteStore.stationInfo.name
    },
    weather() {
      return this.remoteStore.stationInfo.weather
    },
    qth() {
      return this.remoteStore.stationInfo.qth
    },
    localTime() {
      return this.remoteStore.stationInfo.localTime
    },
    greetings() {
      return this.remoteStore.stationInfo.greetings
    }
  }
}
</script>

<template>
  <section class="remote-station-section">
    <h2 class="section-title">Remote Station</h2>
    <div class="remote-station-boxes">
      <!-- Box 1: Station details -->
      <div class="station-block station-remote">
        <img
          :src="flag"
          alt="Remote Station Flag"
          class="station-flag"
        />
        <div class="station-info">
          <p class="station-name">Remote: {{ name }}</p>
          <p class="station-weather">Weather: {{ weather }}</p>
          <p class="station-qth">QTH: {{ qth }}</p>
          <p class="station-time">Local time: {{ localTime }}</p>
        </div>
      </div>

      <!-- Box 2: Basic greetings info -->
      <div class="station-block station-greeting-block">
        <div class="station-info">
          <p v-for="(greeting, index) in greetings" 
             :key="index" 
             class="station-greeting-line">
            <strong>{{ greeting.label }}:</strong><br />
            "{{ greeting.greeting }}" — IPA: "{{ greeting.ipa }}"
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
