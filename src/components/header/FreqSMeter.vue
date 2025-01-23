<script lang="ts">
import { useRigStore } from '../../store/rig'

/* Bring this to the store once the rig control is implemented */
interface MajorTick {
  label: string;
  color: string;
}

export default {
  name: 'FreqSMeter',
  data() {
    const store = useRigStore()
    return {
      rigStore: store,
      isEditing: false,
      isTxEditing: false,
      unit: 'kHz',
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
      <div class="freq-display">
        <button class="split-btn mode-badge" :class="{ active: rigStore.splitActive }"
          @click="rigStore.toggleSplit()">SPLIT</button>
        <div class="rig-frequency" @click="isEditing = true">
          <div class="freq-main">
            <input v-if="isEditing" type="text" :value="rigStore.frequency"
              @input="e => rigStore.setFrequency((e.target as HTMLInputElement).value)" @blur="isEditing = false"
              @keyup.enter="isEditing = false" class="freq-input">
            <template v-else>
              <span>{{ rigStore.frequency }}</span>
              <template v-if="rigStore.splitActive">
                <span class="tx-freq" @click.stop="isTxEditing = true">
                  <input v-if="isTxEditing" type="text" :value="rigStore.txFrequency"
                    @input="e => rigStore.setTxFrequency((e.target as HTMLInputElement).value)"
                    @blur="isTxEditing = false" @keyup.enter="isTxEditing = false"
                    style="background: transparent; border: none; color: inherit; font: inherit; width: 60px;">
                  <span v-else>({{ rigStore.txFrequency }})</span>
                </span>
              </template>
            </template>
          </div>
          <span class="freq-unit">{{ unit }}</span>
        </div>
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


      <div class="rig-mode-badges">
        <template v-for="mode in rigStore.modes" :key="mode.value">
          <input type="radio" :id="'mode-' + mode.value.toLowerCase()" :value="mode.value"
            v-model="rigStore.selectedMode" name="rig-mode" />
          <label :for="'mode-' + mode.value.toLowerCase()" class="mode-badge">
            {{ mode.label }}
          </label>
        </template>
      </div>
    </div>
  </div>
</template>
