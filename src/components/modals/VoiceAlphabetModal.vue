<script lang="ts">
import BaseModal from './BaseModal.vue';

interface VoiceAlphabetEntry {
  key: string;
  phonetic: string;
  clipId?: string;
}

interface VoiceAlphabet {
  id: string;
  name: string;
  entries: VoiceAlphabetEntry[];
  collapsed?: boolean;
}

export default {
  name: 'VoiceAlphabetModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    alphabet: { type: Object as () => VoiceAlphabet | undefined, required: false },
    isRecording: { type: Boolean, required: true },
    recordingEntryKey: { type: String, required: true },
    recordingAlphabetId: { type: String, required: true },
    onClose: { type: Function, required: true },
    onSave: { type: Function, required: true },
    onUpdateName: { type: Function, required: true },
    onUpdatePhonetic: { type: Function, required: true },
    onStartRecord: { type: Function, required: true },
    onStopRecord: { type: Function, required: true },
  },
  data() {
    return {
      holdingKey: '' as string,
      nameDraft: '' as string,
    };
  },
  watch: {
    alphabet: {
      immediate: true,
      handler(newVal: VoiceAlphabet | undefined) {
        this.nameDraft = newVal?.name || '';
      },
    },
  },
  methods: {
    updateName() {
      this.onUpdateName(this.nameDraft);
    },
    updatePhonetic(entryKey: string, event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.onUpdatePhonetic(entryKey, value);
    },
    beginHold(entryKey: string, event: Event) {
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') return;
      if (!this.alphabet || this.isRecording) return;
      event.preventDefault();
      this.holdingKey = entryKey;
      this.onStartRecord(entryKey);
      window.addEventListener('mouseup', this.endHold, { once: true });
      window.addEventListener('touchend', this.endHold, { once: true });
      window.addEventListener('touchcancel', this.endHold, { once: true });
    },
    endHold() {
      if (!this.holdingKey) return;
      const entryKey = this.holdingKey;
      this.holdingKey = '';
      this.onStopRecord(entryKey);
    },
    isEntryRecording(entryKey: string) {
      return (
        this.isRecording &&
        this.alphabet &&
        this.recordingAlphabetId === this.alphabet.id &&
        this.recordingEntryKey === entryKey
      );
    },
    isLetter(entryKey: string) {
      return /^[A-Z]$/.test(entryKey);
    },
    isDigit(entryKey: string) {
      return /^[0-9]$/.test(entryKey);
    },
    isPrefix(entryKey: string) {
      return entryKey.startsWith('/');
    },
  },
};
</script>

<template>
  <BaseModal :open="open" title="Alphabet Clips" width="min(900px, 96vw)" :on-close="onClose">
    <div v-if="alphabet" class="alphabet-modal">
      <p class="alphabet-hint">
        Press and hold a letter card to record. Release to save. Press again to re-record.
      </p>
      <div class="alphabet-name">
        <label>Alphabet name</label>
        <input v-model="nameDraft" type="text" @input="updateName" />
      </div>
      <div class="alphabet-section">
        <h4>Letters</h4>
        <div class="alphabet-grid">
          <div
            v-for="entry in alphabet.entries.filter(item => isLetter(item.key))"
            :key="entry.key"
            class="alphabet-entry-card"
            :class="{
              recorded: entry.clipId,
              recording: isEntryRecording(entry.key),
            }"
            @mousedown="event => beginHold(entry.key, event)"
            @touchstart="event => beginHold(entry.key, event)"
          >
            <div class="alphabet-entry-key">{{ entry.key }}</div>
            <input
              class="alphabet-entry-input"
              type="text"
              :value="entry.phonetic"
              @input="event => updatePhonetic(entry.key, event)"
            />
          </div>
        </div>
      </div>

      <div class="alphabet-section">
        <h4>Numbers</h4>
        <div class="alphabet-grid">
          <div
            v-for="entry in alphabet.entries.filter(item => isDigit(item.key))"
            :key="entry.key"
            class="alphabet-entry-card"
            :class="{
              recorded: entry.clipId,
              recording: isEntryRecording(entry.key),
            }"
            @mousedown="event => beginHold(entry.key, event)"
            @touchstart="event => beginHold(entry.key, event)"
          >
            <div class="alphabet-entry-key">{{ entry.key }}</div>
            <input
              class="alphabet-entry-input"
              type="text"
              :value="entry.phonetic"
              @input="event => updatePhonetic(entry.key, event)"
            />
          </div>
        </div>
      </div>

      <div class="alphabet-section">
        <h4>Prefixes</h4>
        <div class="alphabet-grid">
          <div
            v-for="entry in alphabet.entries.filter(item => isPrefix(item.key))"
            :key="entry.key"
            class="alphabet-entry-card"
            :class="{
              recorded: entry.clipId,
              recording: isEntryRecording(entry.key),
            }"
            @mousedown="event => beginHold(entry.key, event)"
            @touchstart="event => beginHold(entry.key, event)"
          >
            <div class="alphabet-entry-key">{{ entry.key }}</div>
            <input
              class="alphabet-entry-input"
              type="text"
              :value="entry.phonetic"
              @input="event => updatePhonetic(entry.key, event)"
            />
          </div>
        </div>
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
.alphabet-modal {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.alphabet-hint {
  color: #9a9a9a;
  font-size: 0.8rem;
  font-style: italic;
}

.alphabet-name {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.alphabet-name label {
  font-size: 0.8rem;
  color: #bdbdbd;
}

.alphabet-name input {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
}

.alphabet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.6rem;
}

.alphabet-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.alphabet-section h4 {
  margin: 0;
  font-size: 0.8rem;
  color: #bdbdbd;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.alphabet-entry-card {
  border: 1px solid #2f2f2f;
  border-radius: 8px;
  padding: 0.5rem;
  background: #1f1f1f;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  cursor: pointer;
}

.alphabet-entry-card.recorded {
  border-color: rgba(255, 165, 0, 0.45);
  background: rgba(255, 165, 0, 0.08);
}

.alphabet-entry-card.recording {
  border-color: rgba(239, 68, 68, 0.8);
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.4);
}

.alphabet-entry-key {
  font-weight: 700;
  color: #f3b240;
  font-size: 0.9rem;
}

.alphabet-entry-input {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #e6e6e6;
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
  font-size: 0.75rem;
}
</style>
