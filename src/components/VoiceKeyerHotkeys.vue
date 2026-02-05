<script lang="ts">
import { defineComponent } from 'vue';
import { setPTT } from '../services/catService';
import { configHelper } from '../utils/configHelper';
import { useNotificationsStore } from '../store/notifications';

type VoiceClip = {
  id: string;
  name: string;
  filePath?: string;
  durationMs?: number;
};

type VoiceMessage = {
  id: string;
  name: string;
  sequence: string[];
  assignedKey?: string;
};

type CwClip = {
  id: string;
  name: string;
  text: string;
};

type CwMessage = {
  id: string;
  name: string;
  sequence: string[];
  assignedKey?: string;
};

type VoiceKeyerState = {
  voiceClips: VoiceClip[];
  voiceMessages: VoiceMessage[];
  cwClips: CwClip[];
  cwMessages: CwMessage[];
  preDelayMs?: number;
  postDelayMs?: number;
  cwPort?: string;
};

export default defineComponent({
  name: 'VoiceKeyerHotkeys',
  data() {
    return {
      state: {
        voiceClips: [],
        voiceMessages: [],
        cwClips: [],
        cwMessages: [],
        preDelayMs: 120,
        postDelayMs: 80,
      } as VoiceKeyerState,
      isPlaying: false,
      notificationsStore: useNotificationsStore(),
    };
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown, { capture: true });
    this.loadState();
    window.addEventListener('voice-keyer-updated', this.loadState as EventListener);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown, true);
    window.removeEventListener('voice-keyer-updated', this.loadState as EventListener);
  },
  methods: {
    async loadState() {
      try {
        await configHelper.initSettings();
        const rawState = configHelper.getSetting(['voiceKeyer'], 'state') as string | undefined;
        if (!rawState) return;
        const parsed = JSON.parse(rawState) as VoiceKeyerState;
        this.state = {
          voiceClips: parsed.voiceClips || [],
          voiceMessages: parsed.voiceMessages || [],
          cwClips: parsed.cwClips || [],
          cwMessages: parsed.cwMessages || [],
          preDelayMs: parsed.preDelayMs ?? 120,
          postDelayMs: parsed.postDelayMs ?? 80,
          cwPort: parsed.cwPort,
        };
      } catch (error) {
        console.error('Failed to load voice keyer state for hotkeys:', error);
      }
    },
    async handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = event.key.toUpperCase();
      if (!/^F\d{1,2}$/.test(key)) return;
      event.preventDefault();
      if (this.isPlaying) return;

      const voiceMessage = this.state.voiceMessages.find(m => m.assignedKey === key);
      if (voiceMessage) {
        await this.playVoiceMessage(voiceMessage);
        return;
      }

      const cwMessage = this.state.cwMessages.find(m => m.assignedKey === key);
      if (cwMessage) {
        await this.sendCwMessage(cwMessage);
      }
    },
    async playVoiceMessage(message: VoiceMessage) {
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.notificationsStore.pushToast({
        type: 'keyer',
        title: 'Voice Keyer',
        description: `Playing ${message.name}`,
      });
      try {
        await setPTT(true);
        await new Promise(resolve => setTimeout(resolve, this.state.preDelayMs || 0));
        for (const clipId of message.sequence) {
          const clip = this.state.voiceClips.find(item => item.id === clipId);
          if (!clip?.filePath) continue;
          const result = await window.electronAPI.loadVoiceClip(clip.filePath);
          if (!result?.success || !result.data) continue;
          const audio = new Audio(URL.createObjectURL(new Blob([result.data], { type: 'audio/wav' })));
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('Audio playback failed'));
            audio.play().catch(reject);
          });
        }
        await new Promise(resolve => setTimeout(resolve, this.state.postDelayMs || 0));
      } catch (error) {
        console.error('Voice keyer hotkey playback failed:', error);
      } finally {
        await setPTT(false);
        this.isPlaying = false;
      }
    },
    async sendCwMessage(message: CwMessage) {
      this.notificationsStore.pushToast({
        type: 'keyer',
        title: 'CW Keyer',
        description: `Sending ${message.name}`,
      });
      const text = message.sequence
        .map(id => this.state.cwClips.find(clip => clip.id === id)?.text || '')
        .filter(Boolean)
        .join(' ');
      if (!text.trim()) return;
      const cwPort = this.state.cwPort;
      if (!cwPort) return;
      await window.electronAPI.serialSend(cwPort, `${text}\r`);
    },
  },
});
</script>

<template>
  <div class="voice-keyer-hotkeys" aria-hidden="true"></div>
</template>
