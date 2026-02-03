<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ContestProfile, ContestSetup } from '../../types/contest';
import type { ContestCatalogEntry } from '../../types/contestCatalog';
import contestCatalogRaw from '../../data/contestCatalog.json';
import { TextMatcher } from '../../utils/textMatcher';

const contestCatalog = contestCatalogRaw as ContestCatalogEntry[];

const props = defineProps<{
  open: boolean;
  profiles: ContestProfile[];
  initialSetup?: ContestSetup | null;
  initialProfileId?: string | null;
  setupMode?: 'new' | 'reconfig' | null;
  onSave: (setup: ContestSetup, profileId: string) => void;
  onCancel: () => void;
}>();

const defaultContest = contestCatalog.find(entry => entry.id === 'DX') ?? contestCatalog[0];

const form = ref<ContestSetup>({
  logType: defaultContest.id,
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
});

const selectedProfileId = ref('dxserial');

const selectedContest = computed(() =>
  contestCatalog.find(entry => entry.id === form.value.logType) ?? defaultContest
);

const suggestedLogTypeLabel = computed(() => {
  switch (selectedContest.value.suggestedProfileId) {
    case 'generic-serial':
      return 'Serial';
    case 'region':
      return 'Region/State';
    case 'grid':
      return 'Grid';
    default:
      return 'DX';
  }
});

watch(
  () => form.value.logType,
  () => {
    form.value.sentExchange = selectedContest.value.defaultSentExchange;
    selectedProfileId.value =
      {
        DX: 'dx',
        DXPEDITION: 'dxpedition',
        DXSERIAL: 'dxserial',
        DXSATELLIT: 'dxsatellit',
        VHFDX: 'vhfdx',
        VHFSERIAL: 'vhfserial',
      }[selectedContest.value.id] || 'dxserial';
  }
);

watch(
  () => props.open,
  open => {
    if (!open) return;
    if (props.initialSetup) {
      form.value = {
        ...props.initialSetup,
        multipliers: props.initialSetup.multipliers ?? [],
      };
    } else {
      form.value.startTime = new Date().toISOString();
    }
    if (props.initialProfileId) {
      selectedProfileId.value = props.initialProfileId;
    }
  }
);

const multipliersOpen = ref(false);
const testCallsign = ref('');
const newRulePattern = ref('');
const newRuleValue = ref('');
const addRuleErrors = ref({ pattern: false, value: false });

const normalizePattern = (value: string) => value.toUpperCase();

const addMultiplierRule = () => {
  if (!form.value.multipliers) form.value.multipliers = [];
  const pattern = normalizePattern(newRulePattern.value.trim());
  const value = newRuleValue.value.trim();
  addRuleErrors.value = { pattern: !pattern, value: !value };
  if (!pattern || !value) return;
  form.value.multipliers.push({
    pattern,
    value,
  });
  newRulePattern.value = '';
  newRuleValue.value = '';
  addRuleErrors.value = { pattern: false, value: false };
};

const removeMultiplierRule = (index: number) => {
  form.value.multipliers.splice(index, 1);
};

const matchesTest = (pattern: string) => {
  if (!testCallsign.value.trim()) return false;
  return TextMatcher.matches(testCallsign.value.trim(), pattern, {
    useRegex: false,
    useWildcard: true,
    caseSensitive: false,
  });
};

const handleSave = () => {
  props.onSave({ ...form.value }, selectedProfileId.value);
};

const openRules = () => {
  if (!selectedContest.value.rulesUrl) return;
  window.electronAPI?.openExternal(selectedContest.value.rulesUrl);
};
</script>

<template>
  <div v-if="open" class="contest-setup-backdrop">
    <div class="contest-setup panel">
      <div class="modal-header">
        <h3 class="panel-title">Setup for Contest</h3>
      </div>
      <div class="modal-body">
        <label class="field">
          <span>Log type</span>
          <select v-model="form.logType">
            <option v-for="contest in contestCatalog" :key="contest.id" :value="contest.id">
              {{ contest.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Profile:</span>
          <select v-model="selectedProfileId">
            <option v-for="profile in props.profiles" :key="profile.id" :value="profile.id">
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
          <input v-model="form.sentExchange" type="text" />
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
          <div class="rules-suggestion">
            Suggested log type: {{ suggestedLogTypeLabel }}
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
      <div class="modal-footer">
        <button class="modal-secondary" type="button" @click="props.onCancel">Cancel</button>
        <button class="modal-primary" type="button" @click="handleSave">Save &amp; Load</button>
      </div>
    </div>
  </div>

  <div v-if="multipliersOpen" class="contest-setup-backdrop">
    <div class="contest-setup panel multipliers-modal">
      <div class="modal-header">
        <h3 class="panel-title">Multipliers</h3>
      </div>
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
      <div class="modal-footer">
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
              if (props.setupMode === 'reconfig') {
                props.onSave({ ...form.value }, selectedProfileId.value);
              }
            }
          "
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contest-setup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2300;
}

.contest-setup {
  width: min(560px, 92vw);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-header,
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

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

.rules-suggestion {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: #9ec3ff;
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
