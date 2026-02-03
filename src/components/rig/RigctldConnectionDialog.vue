<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRigctldConnectionDialog } from '../../composables/useRigctldConnectionDialog';
import { useRigctldConnectionForm } from '../../composables/useRigctldConnectionForm';
import { useRigctldModels } from '../../composables/useRigctldModels';

const { isOpen, close } = useRigctldConnectionDialog();
const { connectionForm, loadRigConfig, saveSettings, connectWithSettings } =
  useRigctldConnectionForm();
const { rigModels, loadingModels, groupedModels, loadRigModels } = useRigctldModels();

const modelLabel = computed(() => {
  if (!connectionForm.value.model) return '';
  const match = rigModels.value.find(model => model.id === connectionForm.value.model);
  return match ? `${match.manufacturer} ${match.model}` : '';
});

const syncData = async () => {
  await Promise.all([loadRigConfig(), loadRigModels()]);
};

const handleSave = async () => {
  await saveSettings({ restartOnModelChange: true });
  close();
};

const handleConnectAndSave = async () => {
  await saveSettings({ restartOnModelChange: true });
  await connectWithSettings();
  close();
};

onMounted(async () => {
  if (isOpen.value) {
    await syncData();
  }
});

watch(isOpen, async open => {
  if (open) {
    await syncData();
  }
});
</script>

<template>
  <div v-if="isOpen" class="connection-dialog-overlay" @click="close">
    <div class="connection-dialog" @click.stop>
      <h3>Rigctld Connection Settings</h3>
      <form @submit.prevent="handleConnectAndSave">
        <div class="form-group">
          <label for="rigctld-host">Host:</label>
          <input id="rigctld-host" v-model="connectionForm.host" type="text" required />
        </div>
        <div class="form-group">
          <label for="rigctld-port">Port:</label>
          <input id="rigctld-port" v-model.number="connectionForm.port" type="number" required />
        </div>
        <div class="form-group">
          <label for="rigctld-model">Rig Model (optional):</label>
          <select
            id="rigctld-model"
            v-model.number="connectionForm.model"
            :disabled="loadingModels"
          >
            <option :value="undefined">Select a rig model...</option>
            <optgroup
              v-for="manufacturer in groupedModels"
              :key="manufacturer.name"
              :label="manufacturer.name"
            >
              <option
                v-for="model in manufacturer.models"
                :key="model.id"
                :value="model.id"
                :title="`Status: ${model.status}`"
              >
                {{ model.model }} ({{ model.id }}) - {{ model.status }}
              </option>
            </optgroup>
          </select>
          <div v-if="loadingModels" class="loading-text">Loading rig models...</div>
          <div v-else-if="modelLabel" class="model-preview">Selected: {{ modelLabel }}</div>
        </div>
        <div class="form-group">
          <label for="rigctld-device">COM port:</label>
          <input
            id="rigctld-device"
            v-model="connectionForm.device"
            type="text"
            placeholder="e.g. /dev/ttyUSB0"
          />
        </div>
        <div class="dialog-buttons">
          <button type="button" @click="close">Cancel</button>
          <button type="button" class="save-btn" @click="handleSave">Save</button>
          <button type="submit" class="connect-btn">Connect &amp; Save</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.connection-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.connection-dialog {
  width: min(520px, 90vw);
  background: #1f1f1f;
  border: 1px solid #2c2c2c;
  border-radius: 12px;
  padding: 1.2rem;
  color: #f4f4f4;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
}

.connection-dialog h3 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.form-group label {
  font-size: 0.85rem;
  color: #c9c9c9;
}

.form-group input,
.form-group select {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
}

.loading-text,
.model-preview {
  font-size: 0.8rem;
  color: #9aa0a6;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.dialog-buttons button {
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #f2f2f2;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.dialog-buttons .save-btn {
  background: rgba(255, 165, 0, 0.16);
  border-color: rgba(255, 165, 0, 0.5);
  color: #ffcc80;
}

.dialog-buttons .connect-btn {
  background: rgba(46, 204, 113, 0.18);
  border-color: rgba(46, 204, 113, 0.7);
  color: #9bf1c9;
}
</style>
