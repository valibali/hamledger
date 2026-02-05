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
      pendingCounts: {} as Record<string, number>,
      activeKey: '' as string,
      activeMode: '' as '' | 'Voice' | 'CW',
    };
  },
  computed: {
    hasHotkeys() {
      return this.hotkeys.length > 0;
    },
  },
  mounted() {
    this.loadHotkeys();
    window.addEventListener('voice-keyer-updated', this.loadHotkeys as (event: Event) => void);
    window.addEventListener('voice-keyer-queue', this.onQueueUpdate as (event: Event) => void);
  },
  beforeUnmount() {
    window.removeEventListener('voice-keyer-updated', this.loadHotkeys as (event: Event) => void);
    window.removeEventListener('voice-keyer-queue', this.onQueueUpdate as (event: Event) => void);
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
    onQueueUpdate(event: Event) {
      const detail = (event as CustomEvent).detail as {
        pending?: Array<{ key?: string; mode?: 'Voice' | 'CW' }>;
        active?: { key?: string; mode?: 'Voice' | 'CW' } | null;
      };
      const counts: Record<string, number> = {};
      (detail?.pending || []).forEach(item => {
        if (!item.key || !item.mode) return;
        const id = `${item.mode}:${item.key}`;
        counts[id] = (counts[id] || 0) + 1;
      });
      this.pendingCounts = counts;
      this.activeKey = detail?.active?.key || '';
      this.activeMode = detail?.active?.mode || '';
    },
    isPending(item: HotkeyItem) {
      const id = `${item.mode}:${item.key}`;
      return (this.pendingCounts[id] || 0) > 0;
    },
    isActive(item: HotkeyItem) {
      return item.key === this.activeKey && item.mode === this.activeMode;
    },
  },
};
</script>

<template>
  <BasePanel class="hotkeys-panel">
    <div v-if="!hasHotkeys" class="hotkeys-empty">No hotkeys assigned.</div>
    <div v-else class="hotkeys-list">
      <div
        v-for="item in hotkeys"
        :key="`${item.mode}-${item.key}`"
        class="hotkey-card"
        :class="{ pending: isPending(item), active: isActive(item) }"
      >
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

.hotkey-card.pending {
  border-color: rgba(255, 165, 0, 0.5);
}

.hotkey-card.active {
  border-color: rgba(255, 165, 0, 0.9);
  animation: hotkeyBlink 1.2s ease-in-out infinite;
}

@keyframes hotkeyBlink {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 0 2px rgba(255, 165, 0, 0.4);
  }
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
