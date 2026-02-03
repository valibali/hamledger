<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
let timer: number | undefined;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 1;

  for (let i = 1; i < 6; i += 1) {
    const y = (height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let i = 1; i < 12; i += 1) {
    const x = (width / 12) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLon = (utcHours - 12) * 15; // degrees
  const graylineLon = subsolarLon + 90;
  const x = ((graylineLon + 180) / 360) * width;

  const gradient = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
  gradient.addColorStop(0, 'rgba(255, 165, 0, 0.0)');
  gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.45)');
  gradient.addColorStop(1, 'rgba(255, 165, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(Math.max(0, x - 20), 0, 40, height);

  ctx.strokeStyle = '#ffa500';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();

  ctx.fillStyle = '#9fb5d1';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('Grayline (UTC)', 8, 16);
};

onMounted(() => {
  draw();
  timer = window.setInterval(draw, 30000);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<template>
  <canvas ref="canvasRef" width="420" height="240" class="grayline-canvas"></canvas>
</template>

<style scoped>
.grayline-canvas {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 1px solid #2b2f3a;
  background: #0d0f14;
}
</style>
