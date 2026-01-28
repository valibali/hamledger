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
    smeterStatusText() {
      return this.rigStore.smeterStatusText;
    },
    smeterSupported() {
      return this.rigStore.smeterStatus.supported;
    },
    smeterHasError() {
      return this.rigStore.smeterStatus.consecutiveErrors > 3;
    },
    smeterStatusClass() {
      if (this.smeterSupported === false) return 'smeter-unsupported';
      if (this.smeterHasError) return 'smeter-error';
      if (this.smeterSupported === null) return 'smeter-checking';
      return 'smeter-ok';
    },
    smeterHelpText() {
      return 'S-meter unavailable: Your radio does not support STRENGTH level via CAT control.';
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

      <div v-if="showSMeter" class="s-meter-container">
        <div class="s-meter" :class="smeterStatusClass">
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
        <!-- Question mark help icon when S-meter is not supported -->
        <div v-if="smeterSupported === false" class="smeter-help-icon" :title="smeterHelpText">
          <span class="help-icon">?</span>
          <div class="smeter-help-tooltip">
            <strong>S-meter unavailable</strong>
            <p>Your radio's Hamlib backend does not report the STRENGTH level capability.</p>
            <p>This means HamLedger cannot read signal strength from your rig via CAT control.</p>
            <p><em>This is a limitation of the radio model or its Hamlib driver, not a HamLedger issue.</em></p>
          </div>
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

/* S-meter status classes */
.s-meter.smeter-unsupported .s-meter-inner {
  opacity: 0.5;
  filter: grayscale(80%);
}

.s-meter.smeter-error .s-meter-inner {
  opacity: 0.6;
}

.s-meter.smeter-checking .s-meter-inner {
  opacity: 0.8;
}

/* S-meter container for icon positioning */
.s-meter-container {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  position: relative;
}

/* Help icon */
.smeter-help-icon {
  position: relative;
  cursor: help;
  margin-bottom: 2px; /* Align with tick boxes */
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 165, 0, 0.3);
  color: #ffa500;
  font-size: 11px;
  font-weight: bold;
  border: 1px solid #ffa500;
}

.smeter-help-tooltip {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  padding: 0.75rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  width: 280px;
  z-index: 100;
  text-align: left;
}

.smeter-help-tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  right: 12px;
  border: 8px solid transparent;
  border-bottom-color: #2a2a2a;
}

.smeter-help-icon:hover .smeter-help-tooltip {
  display: block;
}

.smeter-help-tooltip strong {
  display: block;
  color: #ffa500;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.smeter-help-tooltip p {
  margin: 0 0 0.5rem 0;
  font-size: 0.8rem;
  color: #ccc;
  line-height: 1.4;
}

.smeter-help-tooltip p:last-child {
  margin-bottom: 0;
}

.smeter-help-tooltip em {
  color: #888;
  font-style: italic;
}
</style>
