<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useContestStore } from '../../store/contest';
import ContestModePage from './ContestModePage.vue';
import VoiceKeyerPage from './VoiceKeyerPage.vue';
import RigctldConnectionDialog from '../rig/RigctldConnectionDialog.vue';
import { useRigctldConnectionDialog } from '../../composables/useRigctldConnectionDialog';

const contestStore = useContestStore();
const { open: openRigctldDialog } = useRigctldConnectionDialog();

const switchView = (view: 'contest' | 'voiceKeyer') => {
  contestStore.setActiveView(view);
};

const openCatSettings = () => {
  openRigctldDialog();
};

onMounted(() => {
  contestStore.enterContestMode();
});

onBeforeUnmount(() => {
  contestStore.exitContestMode();
});
</script>

<template>
  <div class="contest-shell">
    <div class="contest-tabs-bar">
      <div class="contest-tabs">
        <button
          :class="{ active: contestStore.activeView === 'contest' }"
          @click="switchView('contest')"
        >
          Contest
        </button>
        <button
          :class="{ active: contestStore.activeView === 'voiceKeyer' }"
          @click="switchView('voiceKeyer')"
        >
          Voice Keyer
        </button>
      </div>
      <button class="cat-settings-btn" type="button" title="CAT Settings" @click="openCatSettings">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm9 3.4-.9-.5.1-1.1-1.7-1-.8.7-1-.4-.3-1-2-.3-.5.9-1.1.1-1-1.7.7-.8-.4-1-.9-.3-.3-2 1-.5.4-1 .8-.7 1.7 1-.1 1.1.9.5v2l-.9.5.1 1.1-1.7 1 .8.7.4 1 .9.3.3 2-1 .5-.4 1-.8.7 1 1.7 1.1-.1.5.9 2 .3.3-1 1-.4.8.7 1.7-1-.1-1.1.9-.5v-2z"
          />
        </svg>
      </button>
    </div>

    <ContestModePage v-if="contestStore.activeView === 'contest'" />
    <VoiceKeyerPage v-else />
    <RigctldConnectionDialog />
  </div>
</template>

<style scoped>
.contest-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0;
}

.contest-tabs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.contest-tabs {
  display: flex;
  gap: 0.5rem;
}

.contest-tabs button {
  background: #222;
  border: 1px solid #333;
  color: #fff;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.contest-tabs button.active {
  background: rgba(255, 165, 0, 0.2);
  border-color: #ffa500;
}

.cat-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #333;
  background: #222;
  color: #eaeaea;
  cursor: pointer;
}

.cat-settings-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
</style>
