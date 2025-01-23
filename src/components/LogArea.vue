<script lang="ts">
import { useQsoStore } from '../store/qso'

export default {
  name: 'LogArea',
  data() {
    const store = useQsoStore()
    return {
      qsoStore: store,
      currentSession: store.currentSession,
      allQsos: store.allQsos,
      sessionCount: store.sessionCount,
      totalCount: store.totalCount,
      prefixMap: {
        F: 'fr',
        HB9: 'ch',
        OK: 'cz',
        DL: 'de',
        G: 'gb',
        EA: 'es'
      }
    }
  },
  data() {
    const store = useQsoStore()
    return {
      qsoStore: store,
      currentSession: store.currentSession,
      allQsos: store.allQsos,
      sessionCount: store.sessionCount,
      totalCount: store.totalCount,
      prefixMap: {
        F: 'fr',
        HB9: 'ch',
        OK: 'cz',
        DL: 'de',
        G: 'gb',
        EA: 'es'
      },
    }
  },
  methods: {
    getCountryCodeForCallsign(callsign: string): string {
      callsign = callsign.toUpperCase()
      const knownPrefixes = Object.keys(this.prefixMap).sort((a, b) => b.length - a.length)
      for (const prefix of knownPrefixes) {
        if (callsign.startsWith(prefix)) {
          return this.prefixMap[prefix as keyof typeof this.prefixMap]
        }
      }
      return 'xx'
    },
    startResize(e: MouseEvent, th: HTMLElement) {
      this.resizing = th;
      this.startX = e.pageX;
      this.startWidth = th.offsetWidth;
      document.addEventListener('mousemove', this.resize);
      document.addEventListener('mouseup', this.stopResize);
    },
    resize(e: MouseEvent) {
      if (this.resizing) {
        const width = this.startWidth + (e.pageX - this.startX);
        if (width > 50) { // Minimum width
          this.resizing.style.width = `${width}px`;
        }
      }
    },
    stopResize() {
      this.resizing = null;
      document.removeEventListener('mousemove', this.resize);
      document.removeEventListener('mouseup', this.stopResize);
    }
  },
  watch: {
    'qsoStore.currentSession': {
      handler(newSession) {
        this.currentSession = newSession
      },
      deep: true
    },
    'qsoStore.allQsos': {
      handler(newQsos) {
        this.allQsos = newQsos
      },
      deep: true
    },
    'qsoStore.sessionCount'(newCount) {
      this.sessionCount = newCount
    },
    'qsoStore.totalCount'(newCount) {
      this.totalCount = newCount
    }
  }
}
</script>

<template>
  <main class="log-container">
    <h2 class="section-title">Log Area</h2>
    <nav class="tab-nav">
      <button class="tab-btn active">New session</button>
      <div class="qso-count">
        <span>This session: {{ sessionCount }} QSO</span>
        <span>All: {{ totalCount }} QSO</span>
      </div>
    </nav>

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
          <th>RSTr</th>
          <th>Remark</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in currentSession" :key="entry.callsign + entry.datetime">
          <td>{{ new Date(entry.datetime).toLocaleDateString() }}</td>
          <td>{{ new Date(entry.datetime).toLocaleTimeString() }}</td>
          <td>
            <img
              v-if="getCountryCodeForCallsign(entry.callsign) !== 'xx'"
              :src="`https://flagcdn.com/h40/${getCountryCodeForCallsign(entry.callsign)}.png`"
              :alt="getCountryCodeForCallsign(entry.callsign)"
              class="callsign-flag"
            />
            {{ entry.callsign }}
          </td>
          <td>{{ entry.band }}</td>
          <td>{{ entry.freqRx }}</td>
          <td>{{ entry.freqTx }}</td>
          <td>{{ entry.mode }}</td>
          <td>{{ entry.rstr1 }}</td>
          <td>{{ entry.rstr2 }}</td>
          <td>{{ entry.remark }}</td>
          <td>{{ entry.notes }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
