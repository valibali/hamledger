<script lang="ts">
import { useQsoStore } from '../store/qso'

export default {
  name: 'LogBook',
  setup() {
    const qsoStore = useQsoStore()
    return { qsoStore }
  },
  computed: {
    allQsos() {
      return this.qsoStore.allQsos
    },
    totalCount() {
      return this.qsoStore.totalCount
    }
  },
  methods: {
    getCountryCodeForCallsign(callsign: string): string {
      const prefixMap: { [key: string]: string } = {
        F: 'fr',
        HB9: 'ch',
        OK: 'cz',
        DL: 'de',
        G: 'gb',
        EA: 'es',
        HA: 'hu',
        HG: 'hu'
      }
      
      callsign = callsign.toUpperCase()
      const knownPrefixes = Object.keys(prefixMap).sort((a, b) => b.length - a.length)
      for (const prefix of knownPrefixes) {
        if (callsign.startsWith(prefix)) {
          return prefixMap[prefix]
        }
      }
      return 'xx'
    }
  }
}
</script>

<template>
  <main class="log-container">
    <h2 class="section-title">LogBook</h2>
    <div class="qso-count">
      <span>Total QSOs: {{ totalCount }}</span>
    </div>

    <table class="qso-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>Callsign</th>
          <th>Band</th>
          <th>Freq. RX</th>
          <th>Freq. TX</th>
          <th>Mode</th>
          <th>RSTr</th>
          <th>RSTt</th>
          <th>Remark</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in allQsos" :key="entry._id">
          <td>{{ new Date(entry.datetime).toLocaleDateString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }) }}</td>
          <td>{{ new Date(entry.datetime).toLocaleTimeString('en-US', {
            timeZone: 'UTC',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }) }}</td>
          <td>
            <img v-if="getCountryCodeForCallsign(entry.callsign) !== 'xx'"
              :src="`https://flagcdn.com/h40/${getCountryCodeForCallsign(entry.callsign)}.png`"
              :alt="getCountryCodeForCallsign(entry.callsign)" 
              class="callsign-flag" />
            {{ entry.callsign }}
          </td>
          <td>{{ entry.band }}</td>
          <td>{{ entry.freqRx }}</td>
          <td>{{ entry.freqTx }}</td>
          <td>{{ entry.mode }}</td>
          <td>{{ entry.rstr }}</td>
          <td>{{ entry.rstt }}</td>
          <td>{{ entry.remark }}</td>
          <td>{{ entry.notes }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
