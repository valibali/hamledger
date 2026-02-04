<script lang="ts">
import BaseModal from './BaseModal.vue';

export default {
  name: 'ContestStartSessionModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    onCancel: { type: Function, required: true },
    onStartDefault: { type: Function, required: true },
    onGoToSetup: { type: Function, required: true },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Start new contest session?"
    width="min(520px, 92vw)"
    :on-close="onCancel"
  >
    <div class="start-body">
      No active session was found. Would you like to configure a contest setup first?
    </div>
    <template #footer>
      <button class="panel-action" type="button" @click="onCancel">Cancel</button>
      <button class="panel-action" type="button" @click="onStartDefault">Start Default</button>
      <button class="panel-action panel-action-confirm" type="button" @click="onGoToSetup">
        Go to Contest Setup
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.start-body {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
}
</style>
