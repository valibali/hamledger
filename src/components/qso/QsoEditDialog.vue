<script lang="ts">
import { useQsoStore } from '../../store/qso'
import { useRigStore } from '../../store/rig'
import { BAND_RANGES } from '../../utils/bands'
import { QsoEntry } from '../../types/qso'

export default {
  name: 'QsoEditDialog',
  props: {
    qso: {
      type: Object as () => QsoEntry,
      required: true
    },
    show: {
      type: Boolean,
      required: true
    }
  },
  setup() {
    const qsoStore = useQsoStore()
    const rigStore = useRigStore()
    return { qsoStore, rigStore }
  },
  data() {
    return {
      editedQso: {} as QsoEntry,
      bands: BAND_RANGES.map(band => ({
        value: band.name,
        label: band.name.toUpperCase()
      }))
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.editedQso = { ...this.qso }
      }
    }
  },
  methods: {
    async saveChanges() {
      try {
        await this.qsoStore.updateQso(this.editedQso)
        this.$emit('close')
      } catch (error) {
        console.error('Failed to update QSO:', error)
      }
    },
    close() {
      this.$emit('close')
    }
  }
}
</script>

<template>
  <div v-if="show" class="dialog-overlay" @click="close">
    <div class="dialog-content" @click.stop>
      <h2>Edit QSO</h2>
      
      <div class="form-grid">
        <div class="form-group">
          <label for="callsign">Callsign</label>
          <input type="text" id="callsign" v-model="editedQso.callsign" />
        </div>

        <div class="form-group">
          <label for="band">Band</label>
          <select id="band" v-model="editedQso.band">
            <option v-for="band in bands" :key="band.value" :value="band.value">
              {{ band.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="mode">Mode</label>
          <select id="mode" v-model="editedQso.mode">
            <option v-for="mode in rigStore.modes" :key="mode.value" :value="mode.value">
              {{ mode.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="freqRx">Freq. RX</label>
          <input type="number" id="freqRx" v-model="editedQso.freqRx" />
        </div>

        <div class="form-group">
          <label for="freqTx">Freq. TX</label>
          <input type="number" id="freqTx" v-model="editedQso.freqTx" />
        </div>

        <div class="form-group">
          <label for="rstr">RST Received</label>
          <input type="text" id="rstr" v-model="editedQso.rstr" />
        </div>

        <div class="form-group">
          <label for="rstt">RST Sent</label>
          <input type="text" id="rstt" v-model="editedQso.rstt" />
        </div>

        <div class="form-group">
          <label for="remark">Remark</label>
          <input type="text" id="remark" v-model="editedQso.remark" />
        </div>

        <div class="form-group full-width">
          <label for="notes">Notes</label>
          <textarea id="notes" v-model="editedQso.notes" rows="3"></textarea>
        </div>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" @click="close">Cancel</button>
        <button class="save-btn" @click="saveChanges">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: #333;
  padding: 2rem;
  border-radius: 5px;
  min-width: 500px;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  color: var(--gray-color);
  font-size: 0.9rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  background: #444;
  border: 1px solid #555;
  padding: 0.5rem;
  color: #fff;
  border-radius: 3px;
}

.form-group textarea {
  resize: vertical;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.cancel-btn,
.save-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}

.cancel-btn {
  background: #555;
  color: #fff;
}

.save-btn {
  background: var(--main-color);
  color: #000;
}
</style>
