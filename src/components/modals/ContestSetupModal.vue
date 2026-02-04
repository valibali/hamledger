<script lang="ts">
import { TextMatcher } from '../../utils/textMatcher';
import BaseModal from './BaseModal.vue';
import contestCatalogRaw from '../../data/contestCatalog.json';
import type { ContestCatalogEntry } from '../../types/contestCatalog';
import type { ContestProfile, ContestSetup } from '../../types/contest';

export default {
  name: 'ContestSetupModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    profiles: { type: Array as () => ContestProfile[], required: true },
    initialSetup: { type: Object as () => ContestSetup | null, default: null },
    initialProfileId: { type: String, default: null },
    setupMode: { type: String, default: null },
    onSave: { type: Function, required: true },
    onCancel: { type: Function, required: true },
  },
  data() {
    const contestCatalog = contestCatalogRaw as ContestCatalogEntry[];
    const defaultContest = contestCatalog.find(entry => entry.id === 'DX') ?? contestCatalog[0];
    return {
      contestCatalog,
      defaultContest,
      form: {
        contestName: defaultContest.name,
        contestType: defaultContest.id,
        logType: undefined,
        modeCategory: 'MIXED',
        operatorCategory: 'SINGLE-OP',
        assistedCategory: 'UNASSISTED',
        powerCategory: 'LOW',
        bandCategory: 'ALL',
        overlayCategory: 'NONE',
        sentExchange: defaultContest.defaultSentExchange,
        serialSentStart: '001',
        multipliers: [],
        startTime: new Date().toISOString(),
      } as ContestSetup,
      selectedProfileId: 'dxserial',
      autoContestName: defaultContest.name,
      multipliersOpen: false,
      testCallsign: '',
      newRulePattern: '',
      newRuleValue: '',
      addRuleErrors: { pattern: false, value: false },
    };
  },
  computed: {
    selectedContest() {
      return (
        this.contestCatalog.find(entry => entry.id === this.form.contestType) ||
        this.defaultContest
      );
    },
  },
  watch: {
    open(newVal: boolean) {
      if (!newVal) return;
      if (this.initialSetup) {
        const contestType =
          this.initialSetup.contestType ?? this.initialSetup.logType ?? this.defaultContest.id;
        this.form = {
          ...this.initialSetup,
          contestType,
          logType: undefined,
          contestName: this.initialSetup.contestName ?? this.selectedContest.name,
          multipliers: this.initialSetup.multipliers ?? [],
        };
        this.autoContestName = this.form.contestName || this.selectedContest.name;
      } else {
        this.autoContestName = this.selectedContest.name;
        this.form.startTime = new Date().toISOString();
      }
      if (this.initialProfileId) {
        this.selectedProfileId = this.initialProfileId;
      }
    },
    'form.contestType'() {
      const nextName = this.selectedContest.name;
      if (!this.form.contestName || this.form.contestName === this.autoContestName) {
        this.form.contestName = nextName;
      }
      this.autoContestName = nextName;
      this.form.sentExchange = this.selectedContest.defaultSentExchange;
      this.selectedProfileId =
        {
          DX: 'dx',
          DXPEDITION: 'dxpedition',
          DXSERIAL: 'dxserial',
          DXSATELLIT: 'dxsatellit',
          VHFDX: 'vhfdx',
          VHFSERIAL: 'vhfserial',
        }[this.selectedContest.id] || 'dxserial';
    },
  },
  methods: {
    normalizePattern(value: string) {
      return value.toUpperCase();
    },
    addMultiplierRule() {
      if (!this.form.multipliers) this.form.multipliers = [];
      const pattern = this.normalizePattern(this.newRulePattern.trim());
      const value = this.newRuleValue.trim();
      this.addRuleErrors = { pattern: !pattern, value: !value };
      if (!pattern || !value) return;
      this.form.multipliers.push({ pattern, value });
      this.newRulePattern = '';
      this.newRuleValue = '';
      this.addRuleErrors = { pattern: false, value: false };
    },
    removeMultiplierRule(index: number) {
      this.form.multipliers.splice(index, 1);
    },
    matchesTest(pattern: string) {
      if (!this.testCallsign.trim()) return false;
      return TextMatcher.matches(this.testCallsign.trim(), pattern, {
        useRegex: false,
        useWildcard: true,
        caseSensitive: false,
      });
    },
    handleSave() {
      this.onSave(
        {
          ...this.form,
          multipliers: this.form.multipliers ? [...this.form.multipliers] : [],
          contestType: this.form.contestType,
          contestName: this.form.contestName || this.selectedContest.name,
        },
        this.selectedProfileId
      );
    },
    openRules() {
      if (!this.selectedContest.rulesUrl) return;
      window.electronAPI?.openExternal(this.selectedContest.rulesUrl);
    },
    handleCancel() {
      this.onCancel();
    },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Setup for Contest"
    width="min(560px, 92vw)"
    :on-close="handleCancel"
  >
    <div class="modal-body">
        <label class="field field-primary">
          <span>Contest name</span>
          <input v-model="form.contestName" type="text" placeholder="e.g. My Field Day" />
        </label>
        <label class="field">
          <span>Contest type</span>
          <select v-model="form.contestType">
            <option v-for="contest in contestCatalog" :key="contest.id" :value="contest.id">
              {{ contest.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Profile:</span>
          <select v-model="selectedProfileId">
            <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
              {{ profile.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Start time (UTC)</span>
          <input v-model="form.startTime" type="text" />
        </label>
        <label class="field">
          <span>Operator</span>
          <select v-model="form.operatorCategory">
            <option>SINGLE-OP</option>
            <option>MULTI-OP</option>
          </select>
        </label>
        <label class="field">
          <span>Assisted</span>
          <select v-model="form.assistedCategory">
            <option>UNASSISTED</option>
            <option>ASSISTED</option>
          </select>
        </label>
        <label class="field">
          <span>Power</span>
          <select v-model="form.powerCategory">
            <option>LOW</option>
            <option>HIGH</option>
            <option>QRP</option>
          </select>
        </label>
        <label class="field">
          <span>Band</span>
          <select v-model="form.bandCategory">
            <option>ALL</option>
            <option>HF</option>
            <option>VHF</option>
            <option>UHF</option>
          </select>
        </label>
        <label class="field">
          <span>Mode</span>
          <select v-model="form.modeCategory">
            <option>MIXED</option>
            <option>CW</option>
            <option>SSB</option>
            <option>DIGITAL</option>
            <option>MIXED+DIG</option>
          </select>
        </label>
        <label class="field">
          <span>Overlay</span>
          <select v-model="form.overlayCategory">
            <option>NONE</option>
            <option>ROOKIE</option>
            <option>CLASSIC</option>
          </select>
        </label>
        <label class="field">
          <span>Sent exchange</span>
          <input v-model="form.sentExchange" type="text" placeholder="e.g.: BP" />
        </label>
        <label class="field">
          <span>Serial S start</span>
          <input v-model="form.serialSentStart" type="text" />
        </label>
        <div class="field rules-summary">
          <button class="rules-open" type="button" @click="multipliersOpen = true">
            Setup multipliers...
          </button>
        </div>
        <div class="field rules-summary">
          <span>Rules summary</span>
          <div class="summary-text">
            {{ selectedContest.rulesSummary || selectedContest.description || 'No summary available.' }}
          </div>
          <div class="rules-note">
            Always verify the official rules first:
            <span class="rules-url">{{ selectedContest.rulesUrl || 'No rules URL' }}</span>
            <button
              v-if="selectedContest.rulesUrl"
              class="rules-open"
              type="button"
              @click="openRules"
            >
              Open Rules
            </button>
          </div>
        </div>
    </div>
    <template #footer>
      <button class="modal-secondary" type="button" @click="handleCancel">Cancel</button>
      <button class="modal-primary" type="button" @click="handleSave">Save</button>
    </template>
  </BaseModal>

  <BaseModal
    :open="multipliersOpen"
    title="Multipliers"
    width="min(720px, 92vw)"
    :on-close="() => { multipliersOpen = false; }"
  >
    <div class="modal-body multipliers-body">
        <div class="multiplier-controls">
          <label>
            <span>Callsign pattern</span>
            <input
              v-model="newRulePattern"
              type="text"
              placeholder="e.g. HA* or I?3*"
              @input="newRulePattern = normalizePattern(($event.target as HTMLInputElement).value)"
              :class="{ 'input-error': addRuleErrors.pattern }"
            />
          </label>
          <label>
            <span>Multiplier</span>
            <input
              v-model="newRuleValue"
              type="text"
              placeholder="e.g. 2"
              :class="{ 'input-error': addRuleErrors.value }"
            />
          </label>
          <button class="modal-primary" type="button" @click="addMultiplierRule">
            Add rule
          </button>
        </div>
        <div class="multiplier-list">
          <div class="multiplier-row header">
            <span>Callsign pattern</span>
            <span>Multiplier</span>
            <span></span>
          </div>
          <div
            v-for="(rule, index) in form.multipliers"
            :key="`${rule.pattern}-${index}`"
            class="multiplier-row"
            :class="{ match: matchesTest(rule.pattern) }"
          >
            <input
              v-model="rule.pattern"
              type="text"
              placeholder="e.g. HA* or I?3*"
              @input="rule.pattern = normalizePattern(($event.target as HTMLInputElement).value)"
            />
            <input v-model="rule.value" type="text" placeholder="e.g. 1" />
            <button class="remove-rule" type="button" @click="removeMultiplierRule(index)">
              −
            </button>
          </div>
        </div>
    </div>
    <template #footer>
      <label class="multiplier-test">
        <span>Test callsign</span>
        <input v-model="testCallsign" type="text" placeholder="e.g. HA5XYZ" />
      </label>
      <button
        class="modal-primary"
        type="button"
        @click="
          () => {
            multipliersOpen = false;
            if (setupMode === 'reconfig') {
              onSave({ ...form }, selectedProfileId);
            }
          }
        "
      >
        Done
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-footer .multiplier-test {
  margin-right: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #b9b9b9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.modal-footer .multiplier-test input {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}

.modal-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem 0.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #d6d6d6;
}

.field input,
.field select {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}

.field-primary span {
  color: #fbbf24;
}

.field-primary input {
  border-color: rgba(251, 191, 36, 0.6);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.2);
}

.rules-summary {
  grid-column: 1 / -1;
}

.summary-text {
  background: #242424;
  border: 1px solid #323232;
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #d6d6d6;
}

.rules-note {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: #c9a86a;
}

.rules-url {
  display: block;
  color: #e2e2e2;
  word-break: break-all;
}

.rules-open {
  margin-top: 0.4rem;
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #f2f2f2;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}


.multipliers-modal {
  width: min(600px, 94vw);
}

.multipliers-body {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0.6rem;
}

.multiplier-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  gap: 0.6rem;
  align-items: end;
}

.multiplier-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #b9b9b9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.multiplier-controls input {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}

.multiplier-controls input.input-error {
  border-color: rgba(231, 76, 60, 0.9);
  box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.35);
}

.multiplier-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px auto;
  gap: 0.6rem;
  align-items: center;
}

.multiplier-row.header {
  font-size: 0.75rem;
  color: #b9b9b9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.multiplier-row input {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}

.multiplier-row.match {
  border: 1px solid rgba(255, 165, 0, 0.4);
  border-radius: 8px;
  padding: 0.35rem;
  background: rgba(255, 165, 0, 0.08);
}

.multiplier-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 0.6rem;
}

.remove-rule {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: none;
  background: #c94b4b;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal-primary {
  border-radius: 8px;
  border: 1px solid rgba(46, 204, 113, 0.7);
  background: rgba(46, 204, 113, 0.18);
  color: #9bf1c9;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}

.modal-secondary {
  border-radius: 8px;
  border: 1px solid #3a3a3a;
  background: #2b2b2b;
  color: #f2f2f2;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
}
</style>
.multiplier-test label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #b9b9b9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.multiplier-test input {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f2f2f2;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}
