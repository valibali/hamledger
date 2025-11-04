<script lang="ts">
import { useRigStore } from '../../store/rig';
import type { MajorTick } from '../../types/smeter';
import { smeterHelper } from '../../utils/smeterHelper';

export default {
  name: 'FreqSMeter',
  data() {
    const store = useRigStore();
    return {
      rigStore: store,
      isEditing: false,
      isTxEditing: false,
      editingFrequency: '',
      unit: 'MHz',
      smeterHelper: smeterHelper,
    };
  },
  computed: {
    majorTicks(): MajorTick[] {
      return this.smeterHelper.getMajorTicks();
    },
    signalStrength(): number {
      return this.rigStore.rigState.signalStrength || 0; // Default to 0 (no signal)
    },
    activeTicks(): number {
      const manufacturer = this.rigStore.capabilities?.mfgName || 'generic';
      return this.smeterHelper.getActiveTicks(this.signalStrength, manufacturer);
    },
    smeterInfo() {
      const manufacturer = this.rigStore.capabilities?.mfgName || 'generic';
      return this.smeterHelper.strengthToSMeter(this.signalStrength, manufacturer);
    },
    frequency: {
      get() {
        return this.rigStore.currentFrequency;
      },
      set(value: string) {
        this.rigStore.setFrequencyFromString(value);
      },
    },
    frequencyParts() {
      return this.rigStore.currentFrequencyParts;
    },
    txFrequency: {
      get() {
        return this.rigStore.splitFrequency || '0';
      },
      set(value: string) {
        const frequency = parseFloat(value) * 1000000; // Convert MHz to Hz
        this.rigStore.setSplitFrequency(frequency);
      },
    },
    txFrequencyParts() {
      return this.rigStore.splitFrequencyParts;
    },
    splitActive() {
      return this.rigStore.rigState.split;
    },
    showSMeter() {
      return this.rigStore.isConnected;
    },
    currentVfo() {
      return this.rigStore.currentVfo;
    },
    selectedMode: {
      get() {
        return this.rigStore.currentMode;
      },
      set(value: string) {
        this.rigStore.setMode(value);
      },
    },
  },
  methods: {
    startEditing() {
      this.editingFrequency = this.frequency;
      this.isEditing = true;
      this.$nextTick(() => {
        if (this.$refs.freqInput) {
          this.$refs.freqInput.focus();
          this.$refs.freqInput.select();
        }
      });
    },
    finishEditing() {
      this.rigStore.setFrequencyFromString(this.editingFrequency);
      this.isEditing = false;
    },
    async toggleSplit() {
      console.log('FreqSMeter: toggleSplit called');
      console.log('Current split state:', this.rigStore.rigState.split);
      console.log('Is connected:', this.rigStore.isConnected);

      const result = await this.rigStore.toggleSplit();
      console.log('toggleSplit result:', result);
    },
  },
};
</script>

<template>
  <div class="header-center freq-s-meter">
    <div class="freq-s-meter-content">
      <div class="freq-display">
        <button class="split-btn mode-badge" :class="{ active: splitActive }" @click="toggleSplit">
          SPLIT
        </button>
        <div class="rig-frequency" @click="startEditing">
          <div class="freq-main">
            <input
              v-if="isEditing"
              type="text"
              v-model="editingFrequency"
              @blur="finishEditing"
              @keyup.enter="finishEditing"
              class="freq-input"
              ref="freqInput"
            />
            <template v-else>
              <span class="freq-main-part">{{ frequencyParts.main }}</span><span class="freq-decimal-dot">.</span><span class="freq-hz-part">{{ frequencyParts.hz }}</span>
              <template v-if="splitActive">
                <span class="tx-freq" @click.stop="isTxEditing = true">
                  <input
                    v-if="isTxEditing"
                    type="text"
                    v-model="txFrequency"
                    @blur="isTxEditing = false"
                    @keyup.enter="isTxEditing = false"
                    style="
                      background: transparent;
                      border: none;
                      color: inherit;
                      font: inherit;
                      width: 60px;
                    "
                  />
                  <span v-else>
                    (<span class="freq-main-part">{{ txFrequencyParts?.main || '0.000' }}</span><span class="freq-decimal-dot">.</span><span class="freq-hz-part">{{ txFrequencyParts?.hz || '000' }}</span>)
                  </span>
                </span>
              </template>
            </template>
          </div>
          <span class="freq-unit">{{ unit }}</span>
          <span v-if="showSMeter && currentVfo" class="vfo-indicator">{{ currentVfo }}</span>
        </div>
      </div>

      <div v-if="showSMeter" class="s-meter">
        <div class="s-meter-inner">
          <template v-for="(majorTick, index) in majorTicks" :key="'major-' + index">
            <div class="tick major-tick" :class="{ active: index * 5 < activeTicks }">
              <div class="tick-label">{{ majorTick.label }}</div>
              <div
                class="tick-line"
                :style="{ background: index * 5 < activeTicks ? majorTick.color : '#333' }"
              ></div>
            </div>

            <template
              v-for="(minorTick, minorIndex) in smeterHelper.generateMinorTicks(index)"
              :key="'minor-' + index + '-' + minorIndex"
            >
              <div
                class="tick minor-tick"
                :class="{ active: index * 5 + minorIndex + 1 < activeTicks }"
              >
                <div
                  class="tick-box"
                  :class="{
                    'tick-box-inactive': index * 5 + minorIndex + 1 >= activeTicks,
                    'tick-box-active': index * 5 + minorIndex + 1 < activeTicks,
                  }"
                  :style="{
                    backgroundColor:
                      index * 5 + minorIndex + 1 < activeTicks ? minorTick.color : 'transparent',
                    borderColor: minorTick.color,
                  }"
                ></div>
              </div>
            </template>
          </template>
        </div>
      </div>

      <div class="rig-mode-badges">
        <template v-for="mode in rigStore.modes" :key="mode.value">
          <input
            type="radio"
            :id="'mode-' + mode.value.toLowerCase()"
            :value="mode.value"
            v-model="selectedMode"
            name="rig-mode"
          />
          <label :for="'mode-' + mode.value.toLowerCase()" class="mode-badge">
            {{ mode.label }}
          </label>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.split-btn {
  background: transparent;
  border: 1px solid var(--gray-color);
  padding: 0.2rem 0.5rem;
  color: var(--gray-color);
  cursor: pointer;
  border-radius: 3px;
}

.split-btn.active {
  background: var(--main-color);
  color: #000;
}

/* Mode badges */
.rig-mode-badges {
  display: inline-flex;
  gap: 0.5rem;
}

.rig-mode-badges input[type='radio'] {
  display: none;
}

.mode-badge {
  display: inline-block;
  padding: 0.3rem 0.6rem;
  background: #444;
  color: var(--gray-color);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9rem;
  text-transform: uppercase;
  border: 1px solid var(--main-color);
}

.rig-mode-badges input[type='radio']:checked + .mode-badge {
  background: var(--main-color);
  color: #000;
}

/* Center: freq + s-meter */
.header-center.freq-s-meter {
  display: flex;
  flex-direction: column;
  text-align: center;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
}

/* Additional container below the title if needed */
.freq-s-meter-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.freq-controls {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.freq-display {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.rig-frequency {
  font-size: 3rem;
  font-weight: bold;
  color: #ffffff;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.freq-main {
  display: flex;
  align-items: baseline;
}

.tx-freq {
  font-size: 1.5rem;
  color: var(--main-color);
  cursor: pointer;
}

.freq-unit {
  font-size: 2rem;
}

.vfo-indicator {
  font-size: 0.9rem;
  color: var(--main-color);
  font-weight: bold;
  padding: 0.1rem 0.3rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-left: 0.5rem;
  margin-top: -0.5rem;
}

.freq-main-part {
  font-size: 3rem;
  font-weight: bold;
}

.freq-decimal-dot {
  font-size: 2rem;
  font-weight: normal;
}

.freq-hz-part {
  font-size: 1.2rem;
  font-weight: normal;
  opacity: 0.8;
}

.freq-input {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-align: right;
  width: 140px;
  font-size: 3rem;
  font-weight: bold;
}

/* S-meter */
.s-meter {
  display: inline-block;
  position: relative;
  vertical-align: middle;
}

.s-meter::before,
.s-meter::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #fff;
}

.s-meter::before {
  top: 3px;
}

.s-meter::after {
  bottom: 4px;
}

.s-meter-inner {
  display: inline-flex;
  align-items: flex-end;
  padding: 2px;
}

.tick {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.tick-label {
  position: absolute;
  top: -15px;
  transform: translateY(-110%);
  font-size: 0.8rem;
  color: #fff;
  white-space: nowrap;
}

.tick-line {
  position: absolute;
  top: -17px;
  width: 1px;
  height: 4px;
  left: 50%;
  background: white;
}

.tick-box {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid;
  margin-top: auto;
  margin-right: 1px;
  transition: all 0.2s ease;
}

.tick-box-inactive {
  opacity: 0.5;
  background-color: transparent !important;
}

.tick-box-active {
  opacity: 1;
  border-color: transparent;
}
</style>
