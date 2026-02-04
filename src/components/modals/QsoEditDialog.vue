<script lang="ts">
import { useQsoStore } from '../../store/qso';
import { useRigStore } from '../../store/rig';
import { BAND_RANGES } from '../../utils/bands';
import { QsoEntry } from '../../types/qso';
import BaseModal from './BaseModal.vue';

export default {
  name: 'QsoEditDialog',
  components: { BaseModal },
  props: {
    qso: {
      type: Object as () => QsoEntry,
      required: true,
    },
    show: {
      type: Boolean,
      required: true,
    },
  },
  setup() {
    const qsoStore = useQsoStore();
    const rigStore = useRigStore();
    return { qsoStore, rigStore };
  },
  data() {
    return {
      editedQso: {} as QsoEntry,
      bands: BAND_RANGES.map(band => ({
        value: band.name,
        label: band.name.toUpperCase(),
      })),
    };
  },
  watch: {
    show(newVal) {
      if (newVal && this.qso) {
        this.editedQso = {
          ...this.qso,
          _id: this.qso._id,
          _rev: this.qso._rev,
          qslStatus: this.qso.qslStatus || 'N',
        };
      }
    },
    qso: {
      handler(newQso) {
        if (newQso && this.show) {
          this.editedQso = {
            ...newQso,
            _id: newQso._id,
            _rev: newQso._rev,
            qslStatus: newQso.qslStatus || 'N',
          };
        }
      },
      immediate: true,
    },
  },
  created() {
    if (this.qso) {
      this.editedQso = {
        ...this.qso,
        _id: this.qso._id,
        _rev: this.qso._rev,
        qslStatus: this.qso.qslStatus || 'N',
      };
    }
  },
  methods: {
    async deleteQso() {
      if (!confirm('Are you sure you want to delete this QSO? This is non-reversible!')) {
        return;
      }

      try {
        const qsoId = this.qso._id || this.qso.id;

        if (!qsoId) {
          throw new Error('QSO ID hiányzik - nem lehet törölni a QSO-t');
        }

        const result = await this.qsoStore.deleteQso(qsoId);

        if (result.success) {
          console.log('QSO sikeresen törölve');
          this.$emit('qso-deleted', this.qso);
          this.$emit('close');
        } else {
          throw new Error(result.error || 'Törlés sikertelen');
        }
      } catch (error) {
        console.error('QSO törlése sikertelen:', error);
        alert('Hiba történt a QSO törlése során: ' + (error.message || error));
      }
    },

    async saveChanges() {
      try {
        // Debug: Check if _id and _rev are present
        console.log('Original QSO:', this.qso);
        console.log('Edited QSO:', this.editedQso);
        console.log('QSO keys:', Object.keys(this.qso));

        // Check if we have the required PouchDB fields
        const qsoId = this.qso._id || this.qso.id;
        const qsoRev = this.qso._rev || this.qso.rev;

        console.log('Available QSO fields:', Object.keys(this.qso));
        console.log('QSO _id:', qsoId);
        console.log('QSO _rev:', qsoRev);

        if (!qsoId) {
          console.error('QSO _id is missing from:', this.qso);
          console.error('All QSO keys:', Object.keys(this.qso));
          throw new Error(
            'QSO _id is missing - cannot update QSO without ID. Available keys: ' +
              Object.keys(this.qso).join(', ')
          );
        }

        // Ensure all required fields are present, including PouchDB required fields
        const qsoToUpdate = {
          ...this.editedQso,
          // Ensure PouchDB required fields are preserved
          _id: qsoId,
          _rev: qsoRev,
          // Ensure numeric fields are properly converted
          freqRx:
            typeof this.editedQso.freqRx === 'string'
              ? parseFloat(this.editedQso.freqRx)
              : this.editedQso.freqRx,
          freqTx:
            typeof this.editedQso.freqTx === 'string'
              ? this.editedQso.freqTx === '--'
                ? '--'
                : parseFloat(this.editedQso.freqTx)
              : this.editedQso.freqTx,
        };

        console.log('Final QSO to update:', qsoToUpdate);
        console.log('QSO _id:', qsoToUpdate._id);
        console.log('QSO _rev:', qsoToUpdate._rev);

        await this.qsoStore.updateQso(qsoToUpdate);
        console.log('QSO saved successfully');

        // Get the updated QSO from the store
        const updatedQso = this.qsoStore.allQsos.find(q => (q._id || q.id) === qsoId);
        this.$emit('qso-saved', updatedQso || qsoToUpdate);
        this.$emit('close');
      } catch (error) {
        console.error('Failed to update QSO:', error);
        alert('Hiba történt a QSO mentése során: ' + (error.message || error));
      }
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>

<template>
  <BaseModal
    :open="show"
    title="Edit QSO"
    width="min(820px, 92vw)"
    height="min(90vh, 880px)"
    :on-close="close"
  >
    <div class="qso-edit-body">
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

        <div class="form-group">
          <label for="qslStatus">QSL Status</label>
          <select id="qslStatus" v-model="editedQso.qslStatus">
            <option value="N">N - Not sent/received</option>
            <option value="P">P - Print label</option>
            <option value="L">L - Label printed</option>
            <option value="S">S - Sent</option>
            <option value="R">R - Received</option>
            <option value="B">B - Both sent and received</option>
            <option value="Q">Q - QSL requested</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label for="notes">Notes</label>
          <textarea id="notes" v-model="editedQso.notes" rows="3"></textarea>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="qso-edit-footer">
        <button class="panel-action danger" type="button" @click="deleteQso">Delete QSO</button>
        <div class="qso-edit-actions">
          <button class="panel-action" type="button" @click="close">Cancel</button>
          <button class="panel-action panel-action-confirm" type="button" @click="saveChanges">
            Save Changes
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.qso-edit-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
  max-height: 65vh;
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

.qso-edit-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.qso-edit-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
