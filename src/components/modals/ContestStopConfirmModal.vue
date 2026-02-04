<script lang="ts">
import BaseModal from './BaseModal.vue';

export default {
  name: 'ContestStopConfirmModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    onCancel: { type: Function, required: true },
    onConfirm: { type: Function, required: true },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Close contest session?"
    width="min(520px, 92vw)"
    :on-close="onCancel"
  >
    <div class="confirm-body">
      Closing will end this session and remove it from the resume prompt.
    </div>
    <template #footer>
      <button class="panel-action" type="button" @click="onCancel">Cancel</button>
      <button class="panel-action panel-action-confirm" type="button" @click="onConfirm">
        Close Session
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-body {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
}
</style>
