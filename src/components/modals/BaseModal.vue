<script lang="ts">
export default {
  name: 'BaseModal',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, default: '' },
    closeOnEsc: { type: Boolean, default: true },
    closeOnBackdrop: { type: Boolean, default: true },
    showHeader: { type: Boolean, default: true },
    showFooter: { type: Boolean, default: true },
    width: { type: String, default: 'min(640px, 92vw)' },
    height: { type: String, default: '' },
    onClose: { type: Function, required: true },
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    onKeydown(event: KeyboardEvent) {
      if (!this.open || !this.closeOnEsc) return;
      if (event.key === 'Escape') {
        this.onClose();
      }
    },
    onBackdropClick() {
      if (!this.closeOnBackdrop) return;
      this.onClose();
    },
  },
};
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click="onBackdropClick">
    <div class="modal-panel panel" :style="{ width, height: height || null }" @click.stop>
      <div v-if="showHeader" class="modal-header">
        <slot name="header">
          <h3 class="modal-title">{{ title }}</h3>
        </slot>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div v-if="showFooter" class="modal-footer">
        <slot name="footer">
          <button class="panel-action panel-action-confirm" type="button" @click="onClose">
            Close
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.modal-panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #1c1c1c;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.modal-title {
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #f3b240;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  flex: 1 1 auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  flex-wrap: nowrap;
  margin-top: auto;
}

.modal-panel :deep(.panel-action) {
  background: #2c2c2c;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #e6e6e6;
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}

.modal-panel :deep(.panel-action.danger) {
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.modal-panel :deep(.panel-action.icon) {
  width: 28px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

.modal-panel :deep(.panel-action-confirm) {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.7);
  color: #d1fae5;
}
</style>
