<script lang="ts">

/* Bring this to the store once the rig control is implemented */
interface MajorTick {
  label: string;
  color: string;
}

export default {
  name: 'FreqSMeter',
  data() {
    return {
      frequency: '7.093',
      unit: 'kHz',
      isEditing: false,
      majorTicks: [
        { label: "S1", color: "white" },
        { label: "S3", color: "white" },
        { label: "S5", color: "white" },
        { label: "S7", color: "white" },
        { label: "S9", color: "gray" },
        { label: "+10", color: "#ffa500" },
        { label: "+20", color: "#ffa500" },
        { label: "+30", color: "#ffa500" }
      ] as MajorTick[]
    }
  },
  methods: {
    getMinorColorFromIndex(majorIndex: number): string {
      return this.majorTicks[majorIndex].color;
    },
    generateMinorTicks(majorIndex: number) {
      if (majorIndex >= this.majorTicks.length - 1) return [];

      return Array(4).fill(null).map(() => ({
        color: this.getMinorColorFromIndex(majorIndex)
      }));
    }
  }
}
</script>

<template>
  <div class="header-center freq-s-meter">
    <div class="freq-s-meter-content">
      <div class="rig-frequency" @click="isEditing = true">
        <input v-if="isEditing" type="text" v-model="frequency" @blur="isEditing = false"
          @keyup.enter="isEditing = false"
          style="background: transparent; border: none; color: inherit; font: inherit; text-align: right; width: 80px;">
        <span v-else>{{ frequency }} {{ unit }}</span>
      </div>

      <div class="s-meter">
        <div class="s-meter-inner">
          <template v-for="(majorTick, index) in majorTicks" :key="'major-' + index">
            <div class="tick major-tick">
              <div class="tick-label">{{ majorTick.label }}</div>
              <div class="tick-line"></div>
            </div>

            <template v-for="(minorTick, minorIndex) in generateMinorTicks(index)"
              :key="'minor-' + index + '-' + minorIndex">
              <div class="tick minor-tick">
                <div class="tick-box" :style="{ background: minorTick.color }"></div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
