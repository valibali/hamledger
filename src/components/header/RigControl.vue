<script lang="ts">
import { useRigStore } from '../../store/rig'

export default {
  name: 'RigControl',
  data() {
    return {
      rigStore: useRigStore()
    }
  },
  computed: {
    modes() {
      return this.rigStore.modes
    },
    selectedMode: {
      get() {
        return this.rigStore.selectedMode
      },
      set(newMode: string) {
        this.rigStore.setMode(newMode)
      }
    },
    rigModel() {
      return this.rigStore.rigModel
    },
    splitActive() {
      return this.rigStore.splitActive
    }
  },
  methods: {
    handleReconnect() {
      this.rigStore.handleReconnect()
    },
    handleDisconnect() {
      this.rigStore.handleDisconnect()
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
    </div>
  </div>
</template>
