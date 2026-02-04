<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ timestamps: number[]; startedAt: string }>();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const nowTick = ref(Date.now());
let timerHandle: number | undefined;
let resizeObserver: ResizeObserver | undefined;
let resizeRaf: number | undefined;
const cssSize = ref({ width: 0, height: 0 });

const sessionStartMs = computed(() => {
  if (!props.startedAt) return null;
  const time = new Date(props.startedAt).getTime();
  return Number.isNaN(time) ? null : time;
});

const formatElapsed = (ms: number) => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const axisLabels = computed(() => {
  const labels: string[] = [];
  const ticks = 5;
  const start = sessionStartMs.value ?? nowTick.value;
  const span = Math.max(1, nowTick.value - start);
  const step = span / (ticks - 1);
  for (let i = 0; i < ticks; i += 1) {
    labels.push(formatElapsed(step * i));
  }
  return labels;
});

const averageFor = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

const legendValues = computed(() => Math.round(averageFor(buildBuckets())));

const buildBuckets = () => {
  const start = sessionStartMs.value;
  if (!start) return new Array(24).fill(0);
  const now = nowTick.value;
  const buckets = 24;
  const span = Math.max(1, now - start);
  const bucketMs = span / buckets;
  const counts = new Array(buckets).fill(0);

  props.timestamps.forEach(time => {
    if (time < start) return;
    const index = Math.min(buckets - 1, Math.floor((time - start) / bucketMs));
    counts[index] += 1;
  });

  const bucketMinutes = bucketMs / 60000;
  return counts.map(count => (bucketMinutes > 0 ? (count / bucketMinutes) * 60 : 0));
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const parent = canvas.parentElement as HTMLElement | null;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.floor(rect.width));
  const nextHeight = Math.max(1, Math.floor(rect.height));
  if (
    Math.abs(cssSize.value.width - nextWidth) < 1 &&
    Math.abs(cssSize.value.height - nextHeight) < 1
  ) {
    return;
  }
  cssSize.value = { width: nextWidth, height: nextHeight };
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(nextWidth * dpr));
  canvas.height = Math.max(1, Math.floor(nextHeight * dpr));
  canvas.style.width = `${nextWidth}px`;
  canvas.style.height = `${nextHeight}px`;
};

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = cssSize.value.width || canvas.clientWidth || canvas.width / dpr;
  const height = cssSize.value.height || canvas.clientHeight || canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const values = buildBuckets();
  const maxValue = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  const average = averageFor(values);

  ctx.strokeStyle = '#ffa500';
  ctx.lineWidth = 0.75;
  ctx.lineCap = 'round';
  ctx.beginPath();

  const plotHeight = Math.max(1, height - 2);
  const baseY = height - 1;

  values.forEach((value, index) => {
    const x = index * step;
    const y = baseY - (value / maxValue) * plotHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  if (values.length > 1) {
    const lastValue = values[values.length - 1];
    const endY = baseY - (lastValue / maxValue) * plotHeight;
    ctx.lineTo(width - 0.5, endY);
  }

  ctx.stroke();
  ctx.lineCap = 'butt';

  const avgY = baseY - (average / maxValue) * plotHeight;

  ctx.lineWidth = 0.75;
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#4aa3ff';
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(width + 1, avgY);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.lineWidth = 0.5;
  ctx.strokeStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(0, height - 1);
  ctx.lineTo(width, height - 1);
  ctx.stroke();
};

onMounted(() => {
  resizeCanvas();
  draw();
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = undefined;
        resizeCanvas();
        draw();
      });
    });
    resizeObserver.observe(canvasRef.value.parentElement as Element);
  }
  timerHandle = window.setInterval(() => {
    nowTick.value = Date.now();
    draw();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerHandle) {
    window.clearInterval(timerHandle);
  }
  if (resizeRaf) {
    window.cancelAnimationFrame(resizeRaf);
  }
  resizeObserver?.disconnect();
});

watch(() => props.timestamps, draw, { deep: true });
watch(() => props.startedAt, draw);
watch(nowTick, draw);
</script>

<template>
  <div class="sparkline-shell">
    <div class="sparkline-legend">
      <span class="legend-item avg">
        <span class="legend-line"></span>
        Avg {{ legendValues }}
      </span>
    </div>
    <div class="sparkline-area">
      <canvas ref="canvasRef" class="sparkline"></canvas>
    </div>
    <div class="sparkline-axis">
      <span v-for="(label, index) in axisLabels" :key="index" class="axis-label">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.sparkline-shell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.sparkline-area {
  flex: 1;
  min-height: 0;
  display: flex;
  width: 100%;
  align-items: stretch;
  border-radius: 6px;
  border: 1px solid #333;
  background: #1f1f1f;
  overflow: hidden;
}

.sparkline {
  width: 100%;
  height: 100%;
  background: transparent;
  border: 0;
  box-sizing: border-box;
  padding: 0;
  display: block;
  flex: 1;
  align-self: stretch;
}

.sparkline-legend {
  display: flex;
  gap: 0.8rem;
  font-size: 0.7rem;
  color: #bdbdbd;
  flex: 0 0 auto;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.legend-line {
  width: 18px;
  height: 0;
  border-top: 1px dashed currentColor;
}

.legend-item.avg {
  color: #4aa3ff;
}

.sparkline-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #9a9a9a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0;
  flex: 0 0 auto;
  height: 16px;
}

.axis-label {
  text-align: center;
  white-space: nowrap;
}

</style>
