<script lang="ts">
import { useRigStore } from '../../store/rig'

export default {
  name: 'RigControl',
  data() {
    const store = useRigStore()
    return {
      rigStore: store,
      modes: store.modes,
      selectedMode: store.selectedMode,
      rigModel: store.rigModel
    }
  },
  methods: {
    handleReconnect() {
      this.rigStore.handleReconnect()
    },
    handleDisconnect() {
      this.rigStore.handleDisconnect()
    }
  },
  watch: {
    'rigStore.modes': {
      handler(newModes) {
        this.modes = newModes
      },
      deep: true
    },
    'rigStore.selectedMode'(newMode) {
      this.selectedMode = newMode
    },
    'selectedMode'(newMode) {
      this.rigStore.setMode(newMode)
    },
    'rigStore.rigModel'(newModel) {
      this.rigModel = newModel
    }
  }
}
</script>

<template>
  <div class="header-left rig-control-section">
    <h2 class="section-title">RIG CONTROL</h2>
    <div class="rig-control-content">
      <div class="rig-info">
        <div class="rig-title">{{ rigModel }}</div>
      </div>

      <div class="rig-buttons">
        <button class="reconnect" @click="handleReconnect">Reconnect</button>
        <button class="stop-btn" @click="handleDisconnect">Disconnect</button>
      </div>

      <div class="rig-mode-badges">
        <template v-for="mode in modes" :key="mode.value">
          <input type="radio" :id="'mode-' + mode.value.toLowerCase()" :value="mode.value" v-model="selectedMode"
            name="rig-mode" />
          <label :for="'mode-' + mode.value.toLowerCase()" class="mode-badge">
            {{ mode.label }}
          </label>
        </template>
      </div>
    </div>
  </div>
</template>
