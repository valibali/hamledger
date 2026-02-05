<script lang="ts">
import { defineComponent } from 'vue';
import { setPTT } from '../../services/catService';
import { configHelper } from '../../utils/configHelper';
import BasePanel from '../panels/BasePanel.vue';
import VoiceClipModal from '../modals/VoiceClipModal.vue';
import CwClipModal from '../modals/CwClipModal.vue';
import CwKeyerSettingsModal from '../modals/CwKeyerSettingsModal.vue';
interface VoiceClip {
  id: string;
  name: string;
  url: string;
  filePath?: string;
  durationMs: number;
}

interface VoiceMessage {
  id: string;
  name: string;
  sequence: string[];
  assignedKey?: string;
  isNew?: boolean;
}

interface CwClip {
  id: string;
  name: string;
  text: string;
}

interface CwMessage {
  id: string;
  name: string;
  sequence: string[];
  assignedKey?: string;
  isNew?: boolean;
}

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

interface CwKeyerConfig {
  port: string;
  baudRate: number;
  connected: boolean;
  ports: SerialPortInfo[];
}

const STORAGE_KEY = 'voiceKeyer:cwConfig';
const DEFAULT_BAUD = 1200;

export default defineComponent({
  name: 'VoiceKeyerPage',
  components: {
    BasePanel,
    VoiceClipModal,
    CwClipModal,
    CwKeyerSettingsModal,
  },

  data() {
    return {
      activeMode: 'voice' as 'voice' | 'cw',

      voiceClips: [] as VoiceClip[],
      voiceMessages: [] as VoiceMessage[],
      selectedVoiceMessageId: null as string | null,

      cwClips: [] as CwClip[],
      cwMessages: [] as CwMessage[],
      selectedCwMessageId: null as string | null,
      voicePlaybackPaused: false,
      voicePlaybackStopRequested: false,
      dragState: {
        type: '' as '' | 'voice' | 'cw',
        fromMessageId: '' as string,
        fromIndex: -1,
        clipId: '' as string,
        overMessageId: '' as string,
        overIndex: -1,
        rectsMessageId: '' as string,
        rectMidpoints: [] as number[],
        placeholderX: 0,
        placeholderWidth: 88,
      },

      clipLabel: '',
      cwClipLabel: '',
      cwClipText: '',

      isRecording: false,
      isPaused: false,
      elapsedMs: 0,
      recordingTimer: undefined as number | undefined,
      startedAt: 0,
      accumulatedMs: 0,

      isVoiceTransmitting: false,
      isCwTransmitting: false,
      preDelayMs: 120,
      postDelayMs: 80,

      audioContextRef: null as AudioContext | null,
      mediaStream: null as MediaStream | null,
      recorderNode: null as AudioWorkletNode | null,
      audioChunks: [] as Float32Array[],
      sampleRate: 44100,

      cwConfig: {
        port: '',
        baudRate: DEFAULT_BAUD,
        connected: false,
        ports: [],
      } as CwKeyerConfig,
      cwSettingsOpen: false,
      voiceClipModalOpen: false,
      cwClipModalOpen: false,
      editingVoiceClipId: null as string | null,
      editingCwClipId: null as string | null,
    };
  },

  computed: {
    availableKeys(): string[] {
      return Array.from({ length: 12 }, (_, i) => `F${i + 1}`);
    },

    activeVoiceMessage(): VoiceMessage | undefined {
      return this.voiceMessages.find(m => m.id === this.selectedVoiceMessageId);
    },

    activeCwMessage(): CwMessage | undefined {
      return this.cwMessages.find(m => m.id === this.selectedCwMessageId);
    },

    txStatusLabel(): string {
      if (this.isVoiceTransmitting || this.isCwTransmitting) return 'TX ACTIVE';
      return 'READY';
    },

    txStatusClass(): string {
      return this.isVoiceTransmitting || this.isCwTransmitting ? 'on' : 'off';
    },
    voiceElapsedLabel(): string {
      return this.formatElapsed(this.elapsedMs);
    },
  },

  async mounted() {
    window.addEventListener('keydown', this.handleKeydown, { capture: true });
    this.loadCwConfig();
    this.refreshPorts();
    await this.loadVoiceKeyerState();
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown, true);
    if (this.recordingTimer) window.clearInterval(this.recordingTimer);
    this.disconnectCwKeyer();
    this.recorderNode?.disconnect();
  },

  methods: {
    setMode(mode: 'voice' | 'cw') {
      this.activeMode = mode;
    },

    formatElapsed(ms: number) {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },

    async startRecording() {
      if (this.isRecording) return;
      this.isRecording = true;
      this.isPaused = false;
      this.elapsedMs = 0;
      this.accumulatedMs = 0;
      this.startedAt = Date.now();
      this.audioChunks = [];

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      this.audioContextRef = audioContext;
      this.sampleRate = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(this.mediaStream);
      await audioContext.audioWorklet.addModule(
        new URL('../../worklets/recorder-processor.ts', import.meta.url)
      );
      this.recorderNode = new AudioWorkletNode(audioContext, 'recorder-processor');
      this.recorderNode.port.onmessage = event => {
        if (this.isPaused) return;
        if (event.data?.type === 'samples') {
          this.audioChunks.push(new Float32Array(event.data.samples));
        }
      };

      source.connect(this.recorderNode);
      this.recorderNode.connect(audioContext.destination);

      this.recordingTimer = window.setInterval(() => {
        if (this.isPaused) {
          this.elapsedMs = this.accumulatedMs;
          return;
        }
        this.elapsedMs = this.accumulatedMs + (Date.now() - this.startedAt);
      }, 200);
    },

    async stopRecording() {
      if (!this.isRecording) return;
      this.isRecording = false;
      this.isPaused = false;
      if (this.recordingTimer) {
        window.clearInterval(this.recordingTimer);
        this.recordingTimer = undefined;
      }

      this.recorderNode?.disconnect();
      this.mediaStream?.getTracks().forEach(track => track.stop());
      await this.audioContextRef?.close();

      if (!this.isPaused) {
        this.accumulatedMs += Date.now() - this.startedAt;
      }
      this.elapsedMs = this.accumulatedMs;

      const samples = this.flattenAudio(this.audioChunks);
      const wavBuffer = this.encodeWav(samples, this.sampleRate);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const durationMs = Math.round((samples.length / this.sampleRate) * 1000);

      const name = this.clipLabel.trim() || `Clip ${this.voiceClips.length + 1}`;
      this.clipLabel = '';

      let filePath: string | undefined;
      try {
        const response = await window.electronAPI.saveVoiceClip({
          name,
          data: wavBuffer,
        });
        if (response?.success) {
          filePath = response.path;
        }
      } catch (error) {
        console.error('Failed to save voice clip:', error);
      }

      if (this.editingVoiceClipId) {
        const index = this.voiceClips.findIndex(clip => clip.id === this.editingVoiceClipId);
        if (index >= 0) {
          this.voiceClips[index] = {
            id: this.editingVoiceClipId,
            name,
            url,
            filePath,
            durationMs,
          };
        }
      } else {
        this.voiceClips.push({
          id: `${Date.now()}-${name}`,
          name,
          url,
          filePath,
          durationMs,
        });
      }
      this.editingVoiceClipId = null;
      this.voiceClipModalOpen = false;
      this.saveVoiceKeyerState();
    },
    removeVoiceClip(clipId: string) {
      if (!window.confirm('Delete this voice clip?')) return;
      this.voiceClips = this.voiceClips.filter(clip => clip.id !== clipId);
      this.voiceMessages = this.voiceMessages.map(message => ({
        ...message,
        sequence: message.sequence.filter(id => id !== clipId),
      }));
      this.saveVoiceKeyerState();
    },
    removeCwClip(clipId: string) {
      if (!window.confirm('Delete this CW clip?')) return;
      this.cwClips = this.cwClips.filter(clip => clip.id !== clipId);
      this.cwMessages = this.cwMessages.map(message => ({
        ...message,
        sequence: message.sequence.filter(id => id !== clipId),
      }));
      this.saveVoiceKeyerState();
    },
    editVoiceClip(clip: VoiceClip) {
      this.clipLabel = clip.name;
      this.editingVoiceClipId = clip.id;
      this.openVoiceClipModal();
    },
    editCwClip(clip: CwClip) {
      this.cwClipLabel = clip.name;
      this.cwClipText = clip.text;
      this.editingCwClipId = clip.id;
      this.openCwClipModal();
    },

    togglePause() {
      if (!this.isRecording) return;
      if (this.isPaused) {
        this.isPaused = false;
        this.startedAt = Date.now();
        return;
      }
      this.accumulatedMs += Date.now() - this.startedAt;
      this.isPaused = true;
    },

    restartRecording() {
      if (!this.isRecording) return;
      this.audioChunks = [];
      this.elapsedMs = 0;
      this.accumulatedMs = 0;
      this.startedAt = Date.now();
    },

    encodeWav(samples: Float32Array, rate: number) {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);

      const writeString = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i += 1) {
          view.setUint8(offset + i, text.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, samples.length * 2, true);

      let offset = 44;
      for (let i = 0; i < samples.length; i += 1) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }

      return buffer;
    },

    flattenAudio(chunks: Float32Array[]) {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Float32Array(totalLength);
      let offset = 0;
      chunks.forEach(chunk => {
        result.set(chunk, offset);
        offset += chunk.length;
      });
      return result;
    },

    createVoiceMessage(markNew = false) {
      const newMessage: VoiceMessage = {
        id: `msg-${Date.now()}`,
        name: `Message ${this.voiceMessages.length + 1}`,
        sequence: [],
        isNew: markNew ? true : undefined,
      };
      this.voiceMessages.push(newMessage);
      this.selectedVoiceMessageId = newMessage.id;
      this.saveVoiceKeyerState();
      return newMessage;
    },

    createCwMessage(markNew = false) {
      const newMessage: CwMessage = {
        id: `cw-msg-${Date.now()}`,
        name: `CW Message ${this.cwMessages.length + 1}`,
        sequence: [],
        isNew: markNew ? true : undefined,
      };
      this.cwMessages.push(newMessage);
      this.selectedCwMessageId = newMessage.id;
      this.saveVoiceKeyerState();
      return newMessage;
    },

    assignVoiceKey(messageId: string, key: string | undefined) {
      this.voiceMessages = this.voiceMessages.map(message =>
        message.id === messageId ? { ...message, assignedKey: key || undefined } : message
      );
      this.saveVoiceKeyerState();
    },

    assignCwKey(messageId: string, key: string | undefined) {
      this.cwMessages = this.cwMessages.map(message =>
        message.id === messageId ? { ...message, assignedKey: key || undefined } : message
      );
      this.saveVoiceKeyerState();
    },

    onVoiceDragStart(event: DragEvent, clipId: string) {
      event.dataTransfer?.setData('voice-clip-id', clipId);
      this.dragState.type = 'voice';
      this.dragState.clipId = clipId;
    },

    onCwDragStart(event: DragEvent, clipId: string) {
      event.dataTransfer?.setData('cw-clip-id', clipId);
      this.dragState.type = 'cw';
      this.dragState.clipId = clipId;
    },

    onVoiceDrop(event: DragEvent, messageId?: string) {
      event.preventDefault();
      const clipId = event.dataTransfer?.getData('voice-clip-id');
      if (!clipId) return;
      let message = messageId
        ? this.voiceMessages.find(item => item.id === messageId)
        : this.activeVoiceMessage;
      if (!message) {
        message = this.createVoiceMessage(true);
      }
      if (!message) return;
      const insertIndex =
        this.dragState.type === 'voice' &&
        this.dragState.overMessageId === message.id &&
        this.dragState.overIndex >= 0
          ? this.dragState.overIndex
          : message.sequence.length;
      message.sequence.splice(insertIndex, 0, clipId);
      message.isNew = false;
      this.resetDragState();
      this.saveVoiceKeyerState();
    },

    onCwDrop(event: DragEvent, messageId?: string) {
      event.preventDefault();
      const clipId = event.dataTransfer?.getData('cw-clip-id');
      if (!clipId) return;
      let message = messageId ? this.cwMessages.find(item => item.id === messageId) : this.activeCwMessage;
      if (!message) {
        message = this.createCwMessage(true);
      }
      if (!message) return;
      const insertIndex =
        this.dragState.type === 'cw' &&
        this.dragState.overMessageId === message.id &&
        this.dragState.overIndex >= 0
          ? this.dragState.overIndex
          : message.sequence.length;
      message.sequence.splice(insertIndex, 0, clipId);
      message.isNew = false;
      this.resetDragState();
      this.saveVoiceKeyerState();
    },

    onDragOver(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
    },
    onSequenceDragOver(event: DragEvent, type: 'voice' | 'cw', messageId: string) {
      event.preventDefault();
      let midpoints = this.dragState.rectMidpoints;
      if (this.dragState.rectsMessageId !== messageId || !midpoints.length) {
        const container = event.currentTarget as HTMLElement | null;
        if (!container) return;
        const blocks = Array.from(container.querySelectorAll<HTMLElement>('.sequence-block'));
        midpoints = blocks.map(block => {
          const rect = block.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        this.dragState.rectMidpoints = midpoints;
        this.dragState.rectsMessageId = messageId;
      }
      let insertIndex = midpoints.filter(mid => event.clientX > mid).length;
      if (this.dragState.fromMessageId === messageId && this.dragState.fromIndex >= 0) {
        if (insertIndex > this.dragState.fromIndex) insertIndex -= 1;
      }
      let placeholderX = 0;
      const container = event.currentTarget as HTMLElement | null;
      if (midpoints.length && container) {
        const containerRect = container.getBoundingClientRect();
        const placeholderWidth = this.dragState.placeholderWidth || 88;
        const leftEdge = midpoints[0] - placeholderWidth / 2;
        const rightEdge = midpoints[midpoints.length - 1] + placeholderWidth / 2;
        const absoluteX =
          insertIndex === 0
            ? leftEdge
            : insertIndex >= midpoints.length
              ? rightEdge
              : (midpoints[insertIndex - 1] + midpoints[insertIndex]) / 2 - placeholderWidth / 2;
        placeholderX = absoluteX - containerRect.left;
      }
      if (
        this.dragState.type === type &&
        this.dragState.overMessageId === messageId &&
        this.dragState.overIndex === insertIndex &&
        this.dragState.placeholderX === placeholderX
      ) {
        return;
      }
      this.dragState.type = type;
      this.dragState.overMessageId = messageId;
      this.dragState.overIndex = insertIndex;
      this.dragState.placeholderX = placeholderX;
    },
    onMessageDragEnter(type: 'voice' | 'cw', messageId: string) {
      this.dragState.type = type;
      this.dragState.overMessageId = messageId;
      this.dragState.overIndex = -1;
    },
    onEmptyMessageDrag(type: 'voice' | 'cw') {
      if (type === 'voice' && !this.voiceMessages.length) {
        const message = this.createVoiceMessage(true);
        this.dragState.type = 'voice';
        this.dragState.overMessageId = message.id;
      }
      if (type === 'cw' && !this.cwMessages.length) {
        const message = this.createCwMessage(true);
        this.dragState.type = 'cw';
        this.dragState.overMessageId = message.id;
      }
    },
    onSequenceDragStart(
      event: DragEvent,
      type: 'voice' | 'cw',
      messageId: string,
      index: number,
      clipId: string
    ) {
      this.dragState.type = type;
      this.dragState.fromMessageId = messageId;
      this.dragState.fromIndex = index;
      this.dragState.clipId = clipId;
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        this.dragState.placeholderWidth = target.getBoundingClientRect().width;
      }
      const container = target?.closest('.sequence');
      if (container) {
        const blocks = Array.from(container.querySelectorAll<HTMLElement>('.sequence-block'));
        this.dragState.rectMidpoints = blocks.map(block => {
          const rect = block.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        this.dragState.rectsMessageId = messageId;
      } else {
        this.dragState.rectMidpoints = [];
        this.dragState.rectsMessageId = '';
      }
    },
    onSequenceDrop(type: 'voice' | 'cw', messageId: string) {
      if (this.dragState.type !== type || !this.dragState.clipId) return;
      const list = type === 'voice' ? this.voiceMessages : this.cwMessages;
      const message = list.find(item => item.id === messageId);
      if (!message) return;
      if (this.dragState.fromMessageId === messageId && this.dragState.fromIndex >= 0) {
        message.sequence.splice(this.dragState.fromIndex, 1);
      }
      const insertIndex =
        this.dragState.overMessageId === messageId && this.dragState.overIndex >= 0
          ? this.dragState.overIndex
          : message.sequence.length;
      message.sequence.splice(insertIndex, 0, this.dragState.clipId);
      message.isNew = false;
      this.resetDragState();
      this.saveVoiceKeyerState();
    },
    resetDragState() {
      this.dragState = {
        type: '',
        fromMessageId: '',
        fromIndex: -1,
        clipId: '',
        overMessageId: '',
        overIndex: -1,
        rectsMessageId: '',
        rectMidpoints: [],
        placeholderX: 0,
        placeholderWidth: 88,
      };
    },

    removeVoiceFromSequence(clipId: string, index: number) {
      const message = this.activeVoiceMessage;
      if (!message) return;
      message.sequence.splice(index, 1);
      this.saveVoiceKeyerState();
    },

    removeCwFromSequence(clipId: string, index: number) {
      const message = this.activeCwMessage;
      if (!message) return;
      message.sequence.splice(index, 1);
      this.saveVoiceKeyerState();
    },

    createCwClip() {
      const name = this.cwClipLabel.trim() || `CW Clip ${this.cwClips.length + 1}`;
      const text = this.cwClipText.trim();
      if (!text) return;
      if (this.editingCwClipId) {
        const index = this.cwClips.findIndex(clip => clip.id === this.editingCwClipId);
        if (index >= 0) {
          this.cwClips[index] = {
            id: this.editingCwClipId,
            name,
            text,
          };
        }
      } else {
        this.cwClips.push({
          id: `cw-${Date.now()}`,
          name,
          text,
        });
      }
      this.cwClipLabel = '';
      this.cwClipText = '';
      this.editingCwClipId = null;
      this.cwClipModalOpen = false;
      this.saveVoiceKeyerState();
    },

    async playClip(clip: VoiceClip) {
      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(clip.url);
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
      });
    },

    async playVoiceMessage(message: VoiceMessage) {
      if (this.isVoiceTransmitting) return;
      if (!message.sequence.length) return;

      this.isVoiceTransmitting = true;
      this.voicePlaybackPaused = false;
      this.voicePlaybackStopRequested = false;
      try {
        await setPTT(true);
        await new Promise(resolve => setTimeout(resolve, this.preDelayMs));

        for (const clipId of message.sequence) {
          if (this.voicePlaybackStopRequested) break;
          while (this.voicePlaybackPaused) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          const clip = this.voiceClips.find(item => item.id === clipId);
          if (!clip) continue;
          await this.playClip(clip);
        }

        await new Promise(resolve => setTimeout(resolve, this.postDelayMs));
      } catch (error) {
        console.error('Voice keyer playback error:', error);
      } finally {
        await setPTT(false);
        this.isVoiceTransmitting = false;
        this.voicePlaybackPaused = false;
        this.voicePlaybackStopRequested = false;
      }
    },
    pauseVoiceMessage() {
      if (!this.isVoiceTransmitting) return;
      this.voicePlaybackPaused = !this.voicePlaybackPaused;
    },
    stopVoiceMessage() {
      if (!this.isVoiceTransmitting) return;
      this.voicePlaybackStopRequested = true;
    },
    deleteVoiceMessage(messageId: string) {
      if (!window.confirm('Delete this message?')) return;
      this.voiceMessages = this.voiceMessages.filter(message => message.id !== messageId);
      if (this.selectedVoiceMessageId === messageId) this.selectedVoiceMessageId = null;
      this.saveVoiceKeyerState();
    },
    deleteCwMessage(messageId: string) {
      if (!window.confirm('Delete this message?')) return;
      this.cwMessages = this.cwMessages.filter(message => message.id !== messageId);
      if (this.selectedCwMessageId === messageId) this.selectedCwMessageId = null;
      this.saveVoiceKeyerState();
    },

    async sendCwMessage(message: CwMessage) {
      if (this.isCwTransmitting) return;
      if (!message.sequence.length) return;

      const text = message.sequence
        .map(id => this.cwClips.find(clip => clip.id === id)?.text || '')
        .filter(Boolean)
        .join(' ');

      if (!text.trim()) return;

      this.isCwTransmitting = true;
      try {
        await this.sendCwText(text);
      } catch (error) {
        console.error('CW keyer error:', error);
      } finally {
        this.isCwTransmitting = false;
      }
    },

    async sendCwText(text: string) {
      if (!this.cwConfig.port) {
        console.warn('CW keyer port not configured.');
        return;
      }
      if (!this.cwConfig.connected) {
        console.warn('CW keyer is not connected.');
        return;
      }
      await window.electronAPI.serialSend(this.cwConfig.port, `${text}\r`);
    },

    handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!this.availableKeys.includes(event.key)) return;

      if (this.activeMode === 'voice') {
        const message = this.voiceMessages.find(item => item.assignedKey === event.key);
        if (!message) return;
        event.preventDefault();
        this.playVoiceMessage(message);
      } else {
        const message = this.cwMessages.find(item => item.assignedKey === event.key);
        if (!message) return;
        event.preventDefault();
        this.sendCwMessage(message);
      }
    },

    async refreshPorts() {
      try {
        const ports = await window.electronAPI.serialListPorts();
        this.cwConfig.ports = ports || [];
      } catch (error) {
        console.error('Failed to list serial ports:', error);
      }
    },

    async connectCwKeyer() {
      if (!this.cwConfig.port) return;
      try {
        await window.electronAPI.serialOpen(this.cwConfig.port, this.cwConfig.baudRate);
        this.cwConfig.connected = true;
        this.persistCwConfig();
      } catch (error) {
        console.error('Failed to open CW keyer port:', error);
      }
    },

    async disconnectCwKeyer() {
      if (!this.cwConfig.port || !this.cwConfig.connected) return;
      try {
        await window.electronAPI.serialClose(this.cwConfig.port);
      } catch (error) {
        console.error('Failed to close CW keyer port:', error);
      } finally {
        this.cwConfig.connected = false;
        this.persistCwConfig();
      }
    },

    loadCwConfig() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<CwKeyerConfig>;
        this.cwConfig.port = parsed.port || '';
        this.cwConfig.baudRate = parsed.baudRate || DEFAULT_BAUD;
      } catch {
        // ignore
      }
    },

    persistCwConfig() {
      const payload = {
        port: this.cwConfig.port,
        baudRate: this.cwConfig.baudRate,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    openCwSettings() {
      this.cwSettingsOpen = true;
    },
    closeCwSettings() {
      this.cwSettingsOpen = false;
    },
    saveCwSettings() {
      this.persistCwConfig();
      this.closeCwSettings();
    },
    updateCwConfig(payload: { port?: string; baudRate?: number }) {
      if (payload.port !== undefined) this.cwConfig.port = payload.port;
      if (payload.baudRate !== undefined) this.cwConfig.baudRate = payload.baudRate;
    },
    formatCwClip(text: string) {
      return text
        .replaceAll('.', '•')
        .replaceAll('  ', ' ')
        .replaceAll(' / ', ' / ')
        .replaceAll(' ', ' / ');
    },
    toMorse(text: string) {
      const map: Record<string, string> = {
        A: '.-',
        B: '-...',
        C: '-.-.',
        D: '-..',
        E: '.',
        F: '..-.',
        G: '--.',
        H: '....',
        I: '..',
        J: '.---',
        K: '-.-',
        L: '.-..',
        M: '--',
        N: '-.',
        O: '---',
        P: '.--.',
        Q: '--.-',
        R: '.-.',
        S: '...',
        T: '-',
        U: '..-',
        V: '...-',
        W: '.--',
        X: '-..-',
        Y: '-.--',
        Z: '--..',
        '0': '-----',
        '1': '.----',
        '2': '..---',
        '3': '...--',
        '4': '....-',
        '5': '.....',
        '6': '-....',
        '7': '--...',
        '8': '---..',
        '9': '----.',
        '.': '.-.-.-',
        ',': '--..--',
        '?': '..--..',
        '/': '-..-.',
        '=': '-...-',
        '+': '.-.-.',
        '-': '-....-',
        '(': '-.--.',
        ')': '-.--.-',
      };
      return text
        .toUpperCase()
        .split('')
        .map(char => {
          if (char === ' ') return '/';
          return map[char] || '';
        })
        .filter(Boolean)
        .map(code => code.replaceAll('.', '•'))
        .join(' / ');
    },
    toFileUrl(filePath?: string) {
      if (!filePath) return '';
      if (filePath.startsWith('file://')) return filePath;
      return `file://${filePath.replace(/\\/g, '/')}`;
    },
    async loadVoiceKeyerState() {
      try {
        await configHelper.initSettings();
        const rawState = configHelper.getSetting(['voiceKeyer'], 'state') as string | undefined;
        if (!rawState) return;
        const parsed = JSON.parse(rawState) as {
          voiceClips?: VoiceClip[];
          voiceMessages?: VoiceMessage[];
          cwClips?: CwClip[];
          cwMessages?: CwMessage[];
        };

        if (Array.isArray(parsed.voiceClips)) {
          this.voiceClips = parsed.voiceClips.map(clip => ({
            ...clip,
            url: clip.filePath ? this.toFileUrl(clip.filePath) : clip.url || '',
          }));
        }
        if (Array.isArray(parsed.voiceMessages)) this.voiceMessages = parsed.voiceMessages;
        if (Array.isArray(parsed.cwClips)) this.cwClips = parsed.cwClips;
        if (Array.isArray(parsed.cwMessages)) this.cwMessages = parsed.cwMessages;
      } catch (error) {
        console.error('Failed to load voice keyer state:', error);
      }
    },
    async saveVoiceKeyerState() {
      try {
        const voiceClips = this.voiceClips.map(clip => ({
          id: clip.id,
          name: clip.name,
          filePath: clip.filePath,
          durationMs: clip.durationMs,
        }));
        const payload = {
          voiceClips,
          voiceMessages: this.voiceMessages.map(message => ({
            id: message.id,
            name: message.name,
            sequence: [...message.sequence],
            assignedKey: message.assignedKey,
          })),
          cwClips: this.cwClips.map(clip => ({
            id: clip.id,
            name: clip.name,
            text: clip.text,
          })),
          cwMessages: this.cwMessages.map(message => ({
            id: message.id,
            name: message.name,
            sequence: [...message.sequence],
            assignedKey: message.assignedKey,
          })),
        };
        await configHelper.updateSetting(['voiceKeyer'], 'state', JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to save voice keyer state:', error);
      }
    },
    openVoiceClipModal() {
      this.voiceClipModalOpen = true;
    },
    closeVoiceClipModal() {
      this.voiceClipModalOpen = false;
      this.editingVoiceClipId = null;
    },
    saveVoiceClipModal() {
      if (this.editingVoiceClipId && !this.isRecording) {
        const clip = this.voiceClips.find(item => item.id === this.editingVoiceClipId);
        if (clip) {
          clip.name = this.clipLabel.trim() || clip.name;
          this.saveVoiceKeyerState();
        }
      }
      this.closeVoiceClipModal();
    },
    updateVoiceLabel(value: string) {
      this.clipLabel = value;
    },
    openCwClipModal() {
      this.cwClipModalOpen = true;
    },
    closeCwClipModal() {
      this.cwClipModalOpen = false;
      this.editingCwClipId = null;
    },
    updateCwLabel(value: string) {
      this.cwClipLabel = value;
    },
    updateCwText(value: string) {
      this.cwClipText = value;
    },
    saveCwClip() {
      this.createCwClip();
    },
  },
});
</script>

<template>
  <div class="voice-keyer">
    <div class="voice-topbar">
      <div>
        <h2>Voice Keyer</h2>
        <p>Drag clips to build messages. Assign to F-keys for instant TX.</p>
      </div>
      <div class="tx-controls">
        <label>Pre-delay (ms)</label>
        <input v-model.number="preDelayMs" type="number" min="0" />
        <label>Post-delay (ms)</label>
        <input v-model.number="postDelayMs" type="number" min="0" />
        <span class="tx-status" :class="txStatusClass">{{ txStatusLabel }}</span>
      </div>
    </div>

    <div class="mode-tabs">
      <button :class="{ active: activeMode === 'voice' }" @click="setMode('voice')">Voice</button>
      <button :class="{ active: activeMode === 'cw' }" @click="setMode('cw')">CW</button>
    </div>

    <div v-if="activeMode === 'voice'" class="voice-grid">
      <BasePanel class="clip-panel">
        <template #header>
          <div class="panel-header-row">
            <h3 class="panel-title">Voice Clips</h3>
            <button class="add-clip-btn" type="button" @click="openVoiceClipModal">+ Add Clip</button>
          </div>
        </template>
        <div class="clip-list">
          <div
            v-for="clip in voiceClips"
            :key="clip.id"
            class="clip clip-card"
            draggable="true"
            @dragstart="event => onVoiceDragStart(event, clip.id)"
          >
            <div class="clip-card-header">
              <span class="clip-name">{{ clip.name }}</span>
              <div class="clip-actions">
                <span class="clip-duration">{{ clip.durationMs }} ms</span>
                <button class="clip-action-btn" type="button" @click.stop="editVoiceClip(clip)">
                  ✎
                </button>
                <button class="clip-action-btn danger" type="button" @click.stop="removeVoiceClip(clip.id)">
                  🗑
                </button>
              </div>
            </div>
            <div class="clip-card-body">
              <div class="voice-waveform" />
            </div>
          </div>
        </div>
      </BasePanel>

      <BasePanel class="message-panel">
        <template #header>
          <h3 class="panel-title">Messages</h3>
          <button @click="createVoiceMessage">+ New</button>
        </template>
        <div class="message-cards">
          <div
            v-for="message in voiceMessages"
            :key="message.id"
            class="message-card"
            :class="{
              active: selectedVoiceMessageId === message.id,
              highlight: dragState.type === 'voice' && dragState.overMessageId === message.id,
            }"
            @click="selectedVoiceMessageId = message.id"
            @dragenter="onMessageDragEnter('voice', message.id)"
            @drop="onSequenceDrop('voice', message.id)"
            @dragover="onDragOver"
          >
            <div class="message-controls">
              <button class="panel-action icon" type="button" @click.stop="playVoiceMessage(message)">▶</button>
              <button class="panel-action icon" type="button" @click.stop="pauseVoiceMessage()">⏸</button>
              <button class="panel-action icon" type="button" @click.stop="stopVoiceMessage()">⏹</button>
            </div>
            <div class="message-content">
              <div class="message-header-row">
                <span class="message-title">{{ message.name }}</span>
                <div class="message-actions-right">
                  <button class="panel-action icon danger" type="button" @click.stop="deleteVoiceMessage(message.id)">
                    🗑
                  </button>
                </div>
              </div>
              <div
                class="message-body message-card-body"
                :class="{ 'is-empty': !message.sequence.length }"
                @drop.prevent="onSequenceDrop('voice', message.id)"
              >
                <div v-if="!message.sequence.length" class="message-empty">
                  Drag here a clip to create a new message
                </div>
                <div
                  v-else
                  class="sequence"
                  @dragover.prevent="onSequenceDragOver($event, 'voice', message.id)"
                  @drop.prevent="onSequenceDrop('voice', message.id)"
                >
                  <div
                    v-if="dragState.type === 'voice' && dragState.overMessageId === message.id"
                    class="sequence-placeholder-overlay active"
                    :style="{
                      transform: `translateX(${dragState.placeholderX}px)`,
                      width: `${dragState.placeholderWidth}px`,
                    }"
                  />
                  <template v-for="(clipId, index) in message.sequence" :key="`${clipId}-${index}`">
                    <div
                      class="sequence-block"
                      draggable="true"
                      @dragstart="onSequenceDragStart($event, 'voice', message.id, index, clipId)"
                      @dragend="resetDragState"
                      @click.stop="removeVoiceFromSequence(clipId, index)"
                    >
                      {{ voiceClips.find(c => c.id === clipId)?.name || 'Clip' }}
                    </div>
                  </template>
                </div>
              </div>
              <div class="message-footer">
                <label>Assign key</label>
                <select
                  :value="message.assignedKey || ''"
                  @change="assignVoiceKey(message.id, ($event.target as HTMLSelectElement).value || undefined)"
                >
                  <option value="">None</option>
                  <option v-for="key in availableKeys" :key="key" :value="key">{{ key }}</option>
                </select>
              </div>
            </div>
          </div>
          <div
            v-if="!voiceMessages.length"
            class="message-card message-card-empty"
            @dragenter="onEmptyMessageDrag('voice')"
            @drop="onVoiceDrop($event)"
            @dragover="onDragOver"
          >
            <div class="message-empty">Drag here a clip to create a new message</div>
          </div>
        </div>
      </BasePanel>
    </div>

    <div v-else class="voice-grid">
      <BasePanel class="clip-panel">
        <template #header>
          <div class="panel-header-row">
            <h3 class="panel-title">CW Clips</h3>
            <button class="panel-action icon" type="button" @click="openCwSettings" aria-label="CW settings">
              ⚙
            </button>
          </div>
        </template>
        <div class="cw-status">
          <span class="cw-status-label">Keyer</span>
          <span :class="{ online: cwConfig.connected }">
            {{ cwConfig.connected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
        <div class="clip-actions">
          <button class="add-clip-btn" type="button" @click="openCwClipModal">+ Add Clip</button>
        </div>
        <div class="clip-list">
          <div
            v-for="clip in cwClips"
            :key="clip.id"
            class="clip clip-card"
            draggable="true"
            @dragstart="event => onCwDragStart(event, clip.id)"
          >
            <div class="clip-card-header">
              <span class="clip-name">{{ clip.name }}</span>
              <div class="clip-actions">
                <button class="clip-action-btn" type="button" @click.stop="editCwClip(clip)">
                  ✎
                </button>
                <button class="clip-action-btn danger" type="button" @click.stop="removeCwClip(clip.id)">
                  🗑
                </button>
              </div>
            </div>
            <div class="clip-card-body cw-body">
              {{ toMorse(clip.text) }}
            </div>
          </div>
        </div>
      </BasePanel>

      <BasePanel class="message-panel">
        <template #header>
          <h3 class="panel-title">CW Messages</h3>
          <button @click="createCwMessage">+ New</button>
        </template>
        <div class="message-cards">
          <div
            v-for="message in cwMessages"
            :key="message.id"
            class="message-card"
            :class="{
              active: selectedCwMessageId === message.id,
              highlight: dragState.type === 'cw' && dragState.overMessageId === message.id,
            }"
            @click="selectedCwMessageId = message.id"
            @dragenter="onMessageDragEnter('cw', message.id)"
            @drop="onSequenceDrop('cw', message.id)"
            @dragover="onDragOver"
          >
            <div class="message-controls">
              <button class="panel-action icon" type="button" @click.stop="sendCwMessage(message)">▶</button>
              <button class="panel-action icon" type="button" disabled>⏸</button>
              <button class="panel-action icon" type="button" disabled>⏹</button>
            </div>
            <div class="message-content">
              <div class="message-header-row">
                <span class="message-title">{{ message.name }}</span>
                <div class="message-actions-right">
                  <button class="panel-action icon danger" type="button" @click.stop="deleteCwMessage(message.id)">
                    🗑
                  </button>
                </div>
              </div>
              <div
                class="message-body message-card-body"
                :class="{ 'is-empty': !message.sequence.length }"
                @drop.prevent="onSequenceDrop('cw', message.id)"
              >
                <div v-if="!message.sequence.length" class="message-empty">
                  Drag here a clip to create a new message
                </div>
                <div
                  v-else
                  class="sequence"
                  @dragover.prevent="onSequenceDragOver($event, 'cw', message.id)"
                  @drop.prevent="onSequenceDrop('cw', message.id)"
                >
                  <div
                    v-if="dragState.type === 'cw' && dragState.overMessageId === message.id"
                    class="sequence-placeholder-overlay active"
                    :style="{
                      transform: `translateX(${dragState.placeholderX}px)`,
                      width: `${dragState.placeholderWidth}px`,
                    }"
                  />
                  <template v-for="(clipId, index) in message.sequence" :key="`${clipId}-${index}`">
                    <div
                      class="sequence-block"
                      draggable="true"
                      @dragstart="onSequenceDragStart($event, 'cw', message.id, index, clipId)"
                      @dragend="resetDragState"
                      @click.stop="removeCwFromSequence(clipId, index)"
                    >
                      {{ cwClips.find(c => c.id === clipId)?.name || 'Clip' }}
                    </div>
                  </template>
                </div>
              </div>
              <div class="message-footer">
                <label>Assign key</label>
                <select
                  :value="message.assignedKey || ''"
                  @change="assignCwKey(message.id, ($event.target as HTMLSelectElement).value || undefined)"
                >
                  <option value="">None</option>
                  <option v-for="key in availableKeys" :key="key" :value="key">{{ key }}</option>
                </select>
              </div>
            </div>
          </div>
          <div
            v-if="!cwMessages.length"
            class="message-card message-card-empty"
            @dragenter="onEmptyMessageDrag('cw')"
            @drop="onCwDrop($event)"
            @dragover="onDragOver"
          >
            <div class="message-empty">Drag here a clip to create a new message</div>
          </div>
        </div>
      </BasePanel>
    </div>

    <CwKeyerSettingsModal
      :open="cwSettingsOpen"
      :config="cwConfig"
      :on-close="closeCwSettings"
      :on-save="saveCwSettings"
      :on-refresh-ports="refreshPorts"
      :on-toggle-connection="cwConfig.connected ? disconnectCwKeyer : connectCwKeyer"
      @update-config="updateCwConfig"
    />
    <VoiceClipModal
      :open="voiceClipModalOpen"
      :label="clipLabel"
      :is-recording="isRecording"
      :is-paused="isPaused"
      :elapsed-label="voiceElapsedLabel"
      :on-close="closeVoiceClipModal"
      :on-save="saveVoiceClipModal"
      :on-start="startRecording"
      :on-stop="stopRecording"
      :on-pause="togglePause"
      :on-restart="restartRecording"
      @update-label="updateVoiceLabel"
    />
    <CwClipModal
      :open="cwClipModalOpen"
      :label="cwClipLabel"
      :text="cwClipText"
      :on-close="closeCwClipModal"
      :on-save="saveCwClip"
      @update-label="updateCwLabel"
      @update-text="updateCwText"
    />
  </div>
</template>

<style scoped>
.voice-keyer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 1rem);
  padding: 0;
}

.voice-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1b1b1b;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.voice-topbar h2 {
  color: #ffa500;
}

.tx-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #bdbdbd;
  font-size: 0.85rem;
}

.tx-controls input {
  width: 80px;
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
}

.tx-status {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid #3b3b3b;
  font-weight: 700;
}

.tx-status.on {
  background: rgba(255, 74, 74, 0.2);
  color: #ff5b5b;
}

.tx-status.off {
  background: rgba(87, 255, 168, 0.15);
  color: #7bffb0;
}

.mode-tabs {
  display: inline-flex;
  gap: 0.5rem;
}

.mode-tabs button {
  background: #222;
  border: 1px solid #333;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}

.mode-tabs button.active {
  background: rgba(255, 165, 0, 0.2);
  border-color: #ffa500;
}

.voice-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1rem;
  flex: 1;
}

.clip-panel,
.message-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-header-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding-right: 2rem;
}

.panel-header-row .panel-action.icon {
  position: absolute;
  top: 0.1rem;
  right: 0.1rem;
}

.clip-panel {
  position: relative;
}

.cw-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #bdbdbd;
}

.cw-status span.online {
  color: #7bffb0;
}

.record-btn,
.stop-btn,
.play-btn,
.message-panel button {
  background: #2b2b2b;
  color: #fff;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}

.add-clip-btn {
  background: rgba(34, 197, 94, 0.25);
  border: 1px solid rgba(34, 197, 94, 0.7);
  color: #d1fae5;
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  font-weight: 600;
}

.clip-actions {
  display: flex;
  justify-content: flex-start;
}

.panel-action.icon {
  width: 28px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  background: #2b2b2b;
  color: #fff;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  cursor: pointer;
}

.clip-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
}

.clip {
  background: #232323;
  border: 1px solid #2f2f2f;
  border-radius: 6px;
  display: flex;
  font-size: 0.85rem;
}

.clip:hover {
  border-color: #f3b240;
}

.clip-card {
  flex-direction: column;
  overflow: hidden;
}

.clip-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  background: #1f1f1f;
  border-bottom: 1px solid #2b2b2b;
  font-weight: 600;
}

.clip-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.clip-action-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #e6e6e6;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.clip-action-btn.danger {
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.clip-card-body {
  padding: 0.45rem 0.5rem;
  display: flex;
  align-items: center;
}

.voice-waveform {
  width: 100%;
  height: 18px;
  border-radius: 4px;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.15) 0,
      rgba(255, 255, 255, 0.15) 2px,
      transparent 2px,
      transparent 6px
    );
}

.cw-body {
  font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #d8d8d8;
  letter-spacing: 0.08em;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.message-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  min-height: 0;
}

.message-card {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 0.75rem;
  padding: 0.6rem;
  border: 1px solid #2f2f2f;
  border-radius: 8px;
  background: #202020;
}

.message-card.active {
  border-color: #ffa500;
  background: rgba(255, 165, 0, 0.1);
}

.message-card.highlight {
  border-color: rgba(255, 255, 255, 0.5);
}

.message-card-empty {
  grid-template-columns: 1fr;
  justify-content: center;
  align-items: center;
  min-height: 80px;
  text-align: center;
}

.message-controls {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.message-title {
  font-weight: 600;
  color: #e6e6e6;
}

.message-actions-right {
  display: inline-flex;
  gap: 0.35rem;
}

.message-body {
  flex: 1;
  background: #1f1f1f;
  border: 1px dashed #3b3b3b;
  border-radius: 8px;
  padding: 0.5rem;
}

.message-card-body {
  min-height: 56px;
}

.message-card-body.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-empty {
  color: #9a9a9a;
  font-style: italic;
  font-size: 0.8rem;
  font-weight: 300;
  text-align: center;
  width: 100%;
}

.sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  position: relative;
}

.sequence-block {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
}

.sequence-block:hover {
  border-color: #f3b240;
}

.sequence-placeholder-overlay {
  position: absolute;
  top: 0;
  width: 88px;
  height: 28px;
  border: 1px dashed #5f5f5f;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
  transform: translateX(0);
}

.sequence-placeholder-overlay.active {
  border-color: #f3b240;
}


.message-footer {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.message-footer select {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
}
</style>
