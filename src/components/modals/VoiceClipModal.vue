<script lang="ts">
import BaseModal from './BaseModal.vue';

export default {
  name: 'VoiceClipModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    label: { type: String, required: true },
    isRecording: { type: Boolean, required: true },
    isPaused: { type: Boolean, required: true },
    elapsedLabel: { type: String, required: true },
    onClose: { type: Function, required: true },
    onStart: { type: Function, required: true },
    onStop: { type: Function, required: true },
    onPause: { type: Function, required: true },
    onRestart: { type: Function, required: true },
    onSave: { type: Function, required: true },
  },
  methods: {
    updateLabel(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.$emit('update-label', value);
    },
  },
};
</script>

<template>
  <BaseModal :open="open" title="Add Voice Clip" width="min(520px, 92vw)" :on-close="onClose">
    <div class="voice-clip-body">
      <label>Clip label</label>
      <input type="text" :value="label" placeholder="Clip label" @input="updateLabel" />

      <div class="voice-clip-status">
        <span>{{ isRecording ? 'Recording' : 'Idle' }}</span>
        <span v-if="isRecording">{{ isPaused ? 'Paused' : 'Live' }}</span>
        <strong>{{ elapsedLabel }}</strong>
      </div>

      <div class="voice-clip-actions">
        <button class="panel-action record" type="button" :disabled="isRecording" @click="onStart">
          Record
        </button>
        <button class="panel-action stop" type="button" :disabled="!isRecording" @click="onStop">
          Stop
        </button>
        <button class="panel-action pause" type="button" :disabled="!isRecording" @click="onPause">
          {{ isPaused ? 'Resume' : 'Pause' }}
        </button>
        <button class="panel-action restart" type="button" :disabled="!isRecording" @click="onRestart">
          Restart
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
.voice-clip-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.voice-clip-body label {
  font-size: 0.8rem;
  color: #bdbdbd;
}

.voice-clip-body input {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}

.voice-clip-status {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: #bdbdbd;
}

.voice-clip-status strong {
  margin-left: auto;
  color: #f3b240;
}

.voice-clip-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.voice-clip-actions .panel-action.record {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.voice-clip-actions .panel-action.stop {
  background: rgba(255, 165, 0, 0.2);
  border-color: rgba(255, 165, 0, 0.6);
  color: #ffd38c;
}

.voice-clip-actions .panel-action.pause {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.6);
  color: #bfdbfe;
}

.voice-clip-actions .panel-action.restart {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.6);
  color: #bbf7d0;
}
</style>
