type Task = () => Promise<void> | void;
type QueueMeta = {
  key?: string;
  mode?: 'Voice' | 'CW';
};

class VoiceKeyerQueue {
  private queue: Array<{ task: Task; meta?: QueueMeta }> = [];
  private pending: QueueMeta[] = [];
  private active: QueueMeta | null = null;
  private running = false;

  enqueue(task: Task, meta?: QueueMeta) {
    this.queue.push({ task, meta });
    if (meta?.key) {
      this.pending.push(meta);
      this.emitUpdate();
    }
    if (!this.running) {
      this.runNext();
    }
  }

  private async runNext() {
    const next = this.queue.shift();
    if (!next) {
      this.running = false;
      this.active = null;
      this.emitUpdate();
      return;
    }
    this.running = true;
    const { task, meta } = next;
    if (meta?.key) {
      const index = this.pending.findIndex(
        item => item.key === meta.key && item.mode === meta.mode
      );
      if (index > -1) {
        this.pending.splice(index, 1);
      }
      this.active = meta;
      this.emitUpdate();
    }
    try {
      await task();
    } catch (error) {
      console.error('Voice keyer queue task failed:', error);
    } finally {
      if (meta?.key && this.active?.key === meta.key && this.active?.mode === meta.mode) {
        this.active = null;
        this.emitUpdate();
      }
      this.runNext();
    }
  }

  private emitUpdate() {
    window.dispatchEvent(
      new CustomEvent('voice-keyer-queue', {
        detail: {
          pending: [...this.pending],
          active: this.active,
        },
      })
    );
  }
}

export const voiceKeyerQueue = new VoiceKeyerQueue();
