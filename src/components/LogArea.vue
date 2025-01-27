<script lang="ts">
import { useQsoStore } from '../store/qso'
import { getCountryCodeForCallsign } from '../utils/callsign'

export default {
  name: 'LogArea',
  setup() {
    const qsoStore = useQsoStore()
    return { qsoStore }
  },
  computed: {
    currentSession() {
      return this.qsoStore.currentSession
    },
    allQsos() {
      return this.qsoStore.allQsos
    },
    sessionCount() {
      return this.qsoStore.sessionCount
    },
    totalCount() {
      return this.qsoStore.totalCount
    }
  },
  data() {
    return {}
  },
  methods: {
    getCountryCodeForCallsign
  },
}
</script>

<template>
  <main class="log-container">
    <div class="log-header">
      <h2 class="section-title">Log Area</h2>
      <div class="qso-count">
        <span>This session: {{ sessionCount }} QSO</span>
        <span>All: {{ totalCount }} QSO</span>
        <button class="tab-btn active">New session</button>
      </div>
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
          <th>RSTr</th>
          <th>Remark</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in currentSession" :key="entry.callsign + entry.datetime">
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
              :alt="getCountryCodeForCallsign(entry.callsign)" class="callsign-flag" />
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

<style>
.log-container {
  background: #333;
  border-radius: 5px;
  padding: 1rem;
}

.log-header {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1rem;
}

.qso-count {
  background: #444;
  border: 1px solid #777;
  padding: 0.5rem 1rem;
  border-radius: 3px;
  line-height: 1.3;
  font-size: 0.9rem;
  color: var(--gray-color);
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.tab-btn {
  background: #444;
  border: none;
  color: var(--gray-color);
  padding: 0.6rem 1rem;
  cursor: pointer;
  border-radius: 3px;
  margin-left: 1rem;
}

.tab-btn.active {
  background: var(--main-color);
  color: #000;
}

/* QSO Table */
.qso-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 1rem;
  color: var(--gray-color);
}

.qso-table thead th {
  background: #444;
  padding: 0.7rem;
  text-align: left;
  font-weight: normal;
}

.qso-table tbody td {
  border-top: 1px solid #555;
  padding: 0.7rem;
}

.qso-table tr:hover {
  background: #3c3c3c;
}

.callsign-flag {
  width: 20px;
  height: auto;
  margin-right: 0.3rem;
  vertical-align: baseline;
  border: 1px solid #555;
  border-radius: 2px;
}
</style>