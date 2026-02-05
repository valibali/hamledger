<script lang="ts">
import BasePanel from './panels/BasePanel.vue';
import { configHelper } from '../utils/configHelper';

type HotkeyItem = {
  key: string;
  name: string;
  mode: 'Voice' | 'CW';
};

export default {
  name: 'VoiceKeyerHotkeysPanel',
  components: { BasePanel },
  data() {
    return {
      hotkeys: [] as HotkeyItem[],
    };
  },
  computed: {
    hasHotkeys() {
      return this.hotkeys.length > 0;
    },
  },
  mounted() {
    this.loadHotkeys();
    window.addEventListener('voice-keyer-updated', this.loadHotkeys as EventListener);
  },
  beforeUnmount() {
    window.removeEventListener('voice-keyer-updated', this.loadHotkeys as EventListener);
  },
  methods: {
    async loadHotkeys() {
      try {
        await configHelper.initSettings();
        const raw = configHelper.getSetting(['voiceKeyer'], 'state') as string | undefined;
        if (!raw) {
          this.hotkeys = [];
          return;
        }
        const parsed = JSON.parse(raw) as {
          voiceMessages?: Array<{ name: string; assignedKey?: string }>;
          cwMessages?: Array<{ name: string; assignedKey?: string }>;
        };
        const voice = (parsed.voiceMessages || [])
          .filter(item => item.assignedKey)
          .map(item => ({
            key: item.assignedKey as string,
            name: item.name,
            mode: 'Voice' as const,
          }));
        const cw = (parsed.cwMessages || [])
          .filter(item => item.assignedKey)
          .map(item => ({
            key: item.assignedKey as string,
            name: item.name,
            mode: 'CW' as const,
          }));
        this.hotkeys = [...voice, ...cw].sort((a, b) => a.key.localeCompare(b.key));
      } catch (error) {
        console.error('Failed to load voice keyer hotkeys:', error);
        this.hotkeys = [];
      }
    },
  },
};
</script>

<template>
  <BasePanel class="hotkeys-panel">
    <div v-if="!hasHotkeys" class="hotkeys-empty">No hotkeys assigned.</div>
    <div v-else class="hotkeys-list">
      <div v-for="item in hotkeys" :key="`${item.mode}-${item.key}`" class="hotkey-card">
        <div class="hotkey-title">
          <span class="hotkey-key">{{ item.key }}</span>
          <span class="hotkey-mode">{{ item.mode }}</span>
        </div>
        <div class="hotkey-name">{{ item.name }}</div>
      </div>
    </div>
  </BasePanel>
</template>

<style scoped>
.hotkeys-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hotkeys-empty {
  color: #9a9a9a;
  font-style: italic;
  font-size: 0.8rem;
}

.hotkeys-list {
  display: flex;
  flex-direction: row;
  gap: 0.35rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 0.1rem;
}

.hotkey-card {
  padding: 0.2rem 0.4rem;
  border: 1px solid #2f2f2f;
  border-radius: 6px;
  background: #232323;
  min-height: 2rem;
  min-width: 6rem;
}

.hotkey-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: #f3b240;
  font-size: 0.78rem;
}

.hotkey-key {
  font-weight: 700;
}

.hotkey-mode {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #9a9a9a;
  letter-spacing: 0.04em;
}

.hotkey-name {
  margin-top: 0.1rem;
  font-size: 0.7rem;
  color: #c9c9c9;
}
</style>
