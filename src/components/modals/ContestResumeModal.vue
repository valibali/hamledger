<script lang="ts">
import BaseModal from './BaseModal.vue';
import type { ContestSessionSnapshot } from '../../types/contest';

export default {
  name: 'ContestResumeModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    snapshot: { type: Object as () => ContestSessionSnapshot | null, default: null },
    onClose: { type: Function, required: true },
    onStartNew: { type: Function, required: true },
    onResume: { type: Function, required: true },
  },
};
</script>

<template>
  <BaseModal :open="open" title="Resume contest session?" width="min(520px, 92vw)" :on-close="onClose">
    <div class="resume-body">
      <div class="resume-row">
        <span class="resume-key">Contest</span>
        <span class="resume-val">{{ snapshot?.session.setup?.contestName || 'Unknown' }}</span>
      </div>
      <div class="resume-row">
        <span class="resume-key">Status</span>
        <span class="resume-val">{{ snapshot?.session.status || '--' }}</span>
      </div>
      <div class="resume-row">
        <span class="resume-key">QSOs</span>
        <span class="resume-val">{{ snapshot?.session.qsos.length || 0 }}</span>
      </div>
    </div>
    <template #footer>
      <button class="panel-action" type="button" @click="onStartNew">Start New</button>
      <button class="panel-action panel-action-confirm" type="button" @click="onResume">
        Resume
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.resume-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.resume-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resume-key {
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.65rem;
}

.resume-val {
  color: #f8fafc;
  font-weight: 600;
}
</style>
