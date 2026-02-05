<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useContestStore } from '../../store/contest';
import ContestModePage from './ContestModePage.vue';
import VoiceKeyerPage from './VoiceKeyerPage.vue';
import RigctldConnectionDialog from '../rig/RigctldConnectionDialog.vue';

const contestStore = useContestStore();

const switchView = (view: 'contest' | 'voiceKeyer') => {
  contestStore.setActiveView(view);
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

</style>
