<script lang="ts">
import BaseModal from './BaseModal.vue';

export default {
  name: 'CwKeyerSettingsModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    config: { type: Object, required: true },
    onClose: { type: Function, required: true },
    onSave: { type: Function, required: true },
    onRefreshPorts: { type: Function, required: true },
    onToggleConnection: { type: Function, required: true },
  },
  methods: {
    updatePort(event: Event) {
      const value = (event.target as HTMLSelectElement).value;
      this.$emit('update-config', { port: value });
    },
    updateBaud(event: Event) {
      const value = Number((event.target as HTMLInputElement).value) || 0;
      this.$emit('update-config', { baudRate: value });
    },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="CW Keyer Settings"
    width="min(520px, 92vw)"
    :on-close="onClose"
  >
    <div class="cw-settings-body">
      <label>Port</label>
      <select :value="config.port" @change="updatePort">
        <option value="">Select port</option>
        <option v-for="port in config.ports" :key="port.path" :value="port.path">
          {{ port.path }}
        </option>
      </select>

      <label>Baud rate</label>
      <input
        type="number"
        min="300"
        step="100"
        :value="config.baudRate"
        @input="updateBaud"
      />

      <div class="cw-settings-actions">
        <button class="panel-action" type="button" @click="onRefreshPorts">Refresh ports</button>
        <button
          class="panel-action"
          :class="{ connected: config.connected }"
          type="button"
          @click="onToggleConnection"
        >
          {{ config.connected ? 'Connected' : 'Connect' }}
        </button>
      </div>
    </div>

    <template #footer>
      <button class="panel-action panel-action-confirm" type="button" @click="onSave">
        Save &amp; Close
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.cw-settings-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.cw-settings-body label {
  font-size: 0.8rem;
  color: #bdbdbd;
}

.cw-settings-body select,
.cw-settings-body input {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}

.cw-settings-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cw-settings-actions .connected {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.7);
  color: #d1fae5;
}
</style>
