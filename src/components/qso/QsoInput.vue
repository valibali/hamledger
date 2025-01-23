<script setup lang="ts">
import { useQsoStore } from '../../store/qso'

const qsoStore = useQsoStore()

const bands = [
  { value: '10m', label: '10 m' },
  { value: '20m', label: '20 m' },
  { value: '40m', label: '40 m' }
]

const modes = [
  { value: 'CW', label: 'CW' },
  { value: 'SSB', label: 'SSB' }
]
</script>

<template>
  <section class="qso_input_area">
    <h2 class="section-title">QSO Input</h2>
    <div class="qso-input-content">
      <div class="qso-input-group">
        <label for="callsign">Callsign</label>
        <input type="text" id="callsign" :value="qsoStore.qsoForm.callsign"
          @input="(e) => qsoStore.updateQsoForm('callsign', (e.target as HTMLInputElement).value)" />
      </div>

      <div class="qso-input-group">
        <label for="band">Band</label>
        <select id="band" :value="qsoStore.qsoForm.band"
          @change="(e) => qsoStore.updateQsoForm('band', (e.target as HTMLSelectElement).value)">
          <option v-for="band in bands" :key="band.value" :value="band.value">
            {{ band.label }}
          </option>
        </select>
      </div>

      <div class="qso-input-group">
        <label for="mode">Mode</label>
        <select id="mode" :value="qsoStore.qsoForm.mode"
          @change="(e) => qsoStore.updateQsoForm('mode', (e.target as HTMLSelectElement).value)">
          <option v-for="mode in modes" :key="mode.value" :value="mode.value">
            {{ mode.label }}
          </option>
        </select>
      </div>

      <div class="qso-input-group small">
        <label for="rstr">RSTr</label>
        <input type="text" id="rstr" :value="qsoStore.qsoForm.rstr"
          @input="(e) => qsoStore.updateQsoForm('rstr', (e.target as HTMLInputElement).value)" placeholder="59" />
      </div>

      <div class="qso-input-group small">
        <label for="rstr2">RSTr</label>
        <input type="text" id="rstr2" :value="qsoStore.qsoForm.rstr2"
          @input="(e) => qsoStore.updateQsoForm('rstr2', (e.target as HTMLInputElement).value)" placeholder="59" />
      </div>

      <div class="qso-input-group small">
        <label for="date">Date</label>
        <input type="text" id="date" :value="qsoStore.qsoForm.date"
          @input="(e) => qsoStore.updateQsoForm('date', (e.target as HTMLInputElement).value)"
          placeholder="22/12/2022" />
      </div>

      <div class="qso-input-group small">
        <label for="utc">UTC</label>
        <input type="text" id="utc" :value="qsoStore.qsoForm.utc"
          @input="(e) => qsoStore.updateQsoForm('utc', (e.target as HTMLInputElement).value)" placeholder="13:33:12" />
      </div>

      <div class="qso-input-group">
        <label for="remark">Remark</label>
        <input type="text" id="remark" :value="qsoStore.qsoForm.remark"
          @input="(e) => qsoStore.updateQsoForm('remark', (e.target as HTMLInputElement).value)"
          placeholder="e.g. CQ Test" />
      </div>

      <div class="qso-input-group">
        <label for="notes">Notes</label>
        <textarea id="notes" :value="qsoStore.qsoForm.notes"
          @input="(e) => qsoStore.updateQsoForm('notes', (e.target as HTMLTextAreaElement).value)" rows="2"
          placeholder="Additional info"></textarea>
      </div>

      <button class="add-qso-btn" @click="qsoStore.addQso">Add QSO</button>
    </div>
  </section>
</template>
