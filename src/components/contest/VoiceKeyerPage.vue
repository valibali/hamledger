<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { setPTT } from '../../services/catService';

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
}

const clips = ref<VoiceClip[]>([]);
const messages = ref<VoiceMessage[]>([]);
const selectedMessageId = ref<string | null>(null);
const clipLabel = ref('');
const isRecording = ref(false);
const isPaused = ref(false);
const elapsedMs = ref(0);
let recordingTimer: number | undefined;
let startedAt = 0;
let accumulatedMs = 0;
const isTransmitting = ref(false);
const preDelayMs = ref(120);
const postDelayMs = ref(80);

const audioContextRef = ref<AudioContext | null>(null);
let mediaStream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let audioChunks: Float32Array[] = [];
let sampleRate = 44100;

const availableKeys = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);

const activeMessage = () => messages.value.find(m => m.id === selectedMessageId.value);

const startRecording = async () => {
  if (isRecording.value) return;
  isRecording.value = true;
  isPaused.value = false;
  elapsedMs.value = 0;
  accumulatedMs = 0;
  startedAt = Date.now();
  audioChunks = [];

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  audioContextRef.value = audioContext;
  sampleRate = audioContext.sampleRate;

  const source = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = event => {
    if (isPaused.value) return;
    const input = event.inputBuffer.getChannelData(0);
    audioChunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  recordingTimer = window.setInterval(() => {
    if (isPaused.value) {
      elapsedMs.value = accumulatedMs;
      return;
    }
    elapsedMs.value = accumulatedMs + (Date.now() - startedAt);
  }, 200);
};

const stopRecording = async () => {
  if (!isRecording.value) return;
  isRecording.value = false;
  isPaused.value = false;
  if (recordingTimer) {
    window.clearInterval(recordingTimer);
    recordingTimer = undefined;
  }

  processor?.disconnect();
  mediaStream?.getTracks().forEach(track => track.stop());
  audioContextRef.value?.close();

  if (!isPaused.value) {
    accumulatedMs += Date.now() - startedAt;
  }
  elapsedMs.value = accumulatedMs;

  const samples = flattenAudio(audioChunks);
  const wavBuffer = encodeWav(samples, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const durationMs = Math.round((samples.length / sampleRate) * 1000);

  const name = clipLabel.value.trim() || `Clip ${clips.value.length + 1}`;
  clipLabel.value = '';

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

  clips.value.push({
    id: `${Date.now()}-${name}`,
    name,
    url,
    filePath,
    durationMs,
  });
};

const togglePause = () => {
  if (!isRecording.value) return;
  if (isPaused.value) {
    isPaused.value = false;
    startedAt = Date.now();
    return;
  }
  accumulatedMs += Date.now() - startedAt;
  isPaused.value = true;
};

const restartRecording = () => {
  if (!isRecording.value) return;
  audioChunks = [];
  elapsedMs.value = 0;
  accumulatedMs = 0;
  startedAt = Date.now();
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const encodeWav = (samples: Float32Array, rate: number) => {
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
};

const flattenAudio = (chunks: Float32Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach(chunk => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

const createMessage = () => {
  const newMessage: VoiceMessage = {
    id: `msg-${Date.now()}`,
    name: `Message ${messages.value.length + 1}`,
    sequence: [],
  };
  messages.value.push(newMessage);
  selectedMessageId.value = newMessage.id;
};

const assignKey = (messageId: string, key: string | undefined) => {
  messages.value = messages.value.map(message => {
    if (message.id !== messageId) return message;
    return { ...message, assignedKey: key || undefined };
  });
};

const onDragStart = (event: DragEvent, clipId: string) => {
  event.dataTransfer?.setData('clip-id', clipId);
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  const clipId = event.dataTransfer?.getData('clip-id');
  if (!clipId) return;
  const message = activeMessage();
  if (!message) return;
  message.sequence.push(clipId);
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const removeFromSequence = (clipId: string, index: number) => {
  const message = activeMessage();
  if (!message) return;
  message.sequence.splice(index, 1);
};

const playClip = (clip: VoiceClip) => {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(clip.url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    audio.play().catch(reject);
  });
};

const playMessage = async (message: VoiceMessage) => {
  if (isTransmitting.value) return;
  if (!message.sequence.length) return;

  isTransmitting.value = true;
  try {
    await setPTT(true);
    await new Promise(resolve => setTimeout(resolve, preDelayMs.value));

    for (const clipId of message.sequence) {
      const clip = clips.value.find(item => item.id === clipId);
      if (!clip) continue;
      await playClip(clip);
    }

    await new Promise(resolve => setTimeout(resolve, postDelayMs.value));
  } catch (error) {
    console.error('Voice keyer playback error:', error);
  } finally {
    await setPTT(false);
    isTransmitting.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  if (!availableKeys.includes(event.key)) return;
  const message = messages.value.find(item => item.assignedKey === event.key);
  if (!message) return;
  event.preventDefault();
  playMessage(message);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, { capture: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true);
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
        <span class="tx-status" :class="isTransmitting ? 'on' : 'off'">
          {{ isTransmitting ? 'TX ACTIVE' : 'READY' }}
        </span>
      </div>
    </div>

    <div class="voice-grid">
      <section class="clip-panel panel">
        <h3>Record Clips</h3>
        <div class="record-controls">
          <input v-model="clipLabel" type="text" placeholder="Clip label" />
          <button class="record-btn" @click="startRecording" :disabled="isRecording">
            Record
          </button>
          <button class="stop-btn" @click="stopRecording" :disabled="!isRecording">
            Stop
          </button>
        </div>
        <div class="clip-list">
          <div
            v-for="clip in clips"
            :key="clip.id"
            class="clip"
            draggable="true"
            @dragstart="event => onDragStart(event, clip.id)"
          >
            <span class="clip-name">{{ clip.name }}</span>
            <span class="clip-duration">{{ clip.durationMs }} ms</span>
          </div>
        </div>
      </section>

      <section class="message-panel panel">
        <div class="message-header">
          <h3>Messages</h3>
          <button @click="createMessage">+ New</button>
        </div>
        <div class="message-list">
          <button
            v-for="message in messages"
            :key="message.id"
            class="message-tab"
            :class="{ active: selectedMessageId === message.id }"
            @click="selectedMessageId = message.id"
          >
            {{ message.name }}
          </button>
        </div>
        <div class="message-body" @drop="onDrop" @dragover="onDragOver">
          <div v-if="!activeMessage()" class="message-empty">Select or create a message.</div>
          <div v-else class="sequence">
            <div
              v-for="(clipId, index) in activeMessage()?.sequence"
              :key="`${clipId}-${index}`"
              class="sequence-block"
              @click="removeFromSequence(clipId, index)"
            >
              {{ clips.find(c => c.id === clipId)?.name || 'Clip' }}
            </div>
          </div>
        </div>
        <div v-if="activeMessage()" class="message-footer">
          <label>Assign key</label>
          <select
            :value="activeMessage()?.assignedKey || ''"
            @change="assignKey(activeMessage()!.id, ($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">None</option>
            <option v-for="key in availableKeys" :key="key" :value="key">{{ key }}</option>
          </select>
          <button class="play-btn" @click="playMessage(activeMessage()!)">Play</button>
        </div>
      </section>
    </div>

    <div v-if="isRecording" class="recording-modal">
      <div class="recording-card">
        <h3>Recording...</h3>
        <p>{{ isPaused ? 'Paused (input muted)' : 'Live capture' }}</p>
        <div class="recording-timer">{{ formatElapsed(elapsedMs) }}</div>
        <div class="recording-actions">
          <button class="record-btn" @click="stopRecording">Stop</button>
          <button class="pause-btn" @click="togglePause">
            {{ isPaused ? 'Resume' : 'Pause' }}
          </button>
          <button class="restart-btn" @click="restartRecording">Restart</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-keyer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
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

.voice-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1rem;
  flex: 1;
}

.clip-panel,
.message-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.record-controls {
  display: flex;
  gap: 0.5rem;
}

.record-controls input {
  flex: 1;
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
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
  padding: 0.4rem 0.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
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

.message-tab {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
}

.message-tab.active {
  background: rgba(255, 165, 0, 0.2);
  border-color: #ffa500;
}

.message-body {
  flex: 1;
  border: 1px dashed #3b3b3b;
  border-radius: 8px;
  padding: 0.75rem;
  background: #151515;
  min-height: 160px;
}

.message-empty {
  color: #7a7a7a;
  font-size: 0.9rem;
}

.sequence {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sequence-block {
  padding: 0.35rem 0.5rem;
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
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
  padding: 0.35rem 0.5rem;
}

.recording-modal {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.recording-card {
  background: #1f1f1f;
  border: 1px solid #2f2f2f;
  border-radius: 10px;
  padding: 1.5rem;
  min-width: 280px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recording-card h3 {
  color: #ffa500;
}

.recording-card p {
  color: #bdbdbd;
  font-size: 0.9rem;
}

.recording-timer {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.08em;
}

.recording-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.pause-btn,
.restart-btn {
  background: #2b2b2b;
  border: 1px solid #3b3b3b;
  color: #fff;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
}
</style>
