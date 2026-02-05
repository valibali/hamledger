<script lang="ts">
import BaseModal from './BaseModal.vue';

export default {
  name: 'CwClipModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    label: { type: String, required: true },
    text: { type: String, required: true },
    onClose: { type: Function, required: true },
    onSave: { type: Function, required: true },
  },
  methods: {
    updateLabel(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.$emit('update-label', value);
    },
    updateText(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.$emit('update-text', value);
    },
  },
};
</script>

<template>
  <BaseModal :open="open" title="Add CW Clip" width="min(480px, 92vw)" :on-close="onClose">
    <div class="cw-clip-body">
      <label>Clip label</label>
      <input type="text" :value="label" placeholder="Clip label" @input="updateLabel" />

      <label>CW text</label>
      <input type="text" :value="text" placeholder="CW text" @input="updateText" />
    </div>

    <template #footer>
      <button class="panel-action panel-action-confirm" type="button" @click="onSave">
        Save &amp; Close
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.cw-clip-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.cw-clip-body label {
  font-size: 0.8rem;
  color: #bdbdbd;
}

.cw-clip-body input {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}
</style>
