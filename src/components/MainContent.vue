<script lang="ts">
import { computed, ref } from 'vue';
import AppHeader from './AppHeader.vue';
import QsoPanel from './QsoPanel.vue';
import LogArea from './LogArea.vue';
import LogBook from './LogBook.vue';
import ConfigView from './ConfigView.vue';
import DxCluster from './DxCluster.vue';
import Awards from './Awards.vue';
import ContestModeShell from './contest/ContestModeShell.vue';
import VoiceKeyerPage from './contest/VoiceKeyerPage.vue';
import { configHelper } from '../utils/configHelper';

export default {
  name: 'MainContent',
  components: {
    AppHeader,
    QsoPanel,
    LogArea,
    LogBook,
    ConfigView,
    DxCluster,
    Awards,
    ContestModeShell,
    VoiceKeyerPage,
  },
  setup() {
    const currentView = ref('qso');
    const viewClass = computed(() =>
      currentView.value === 'contest' ? 'mode-contest' : 'mode-normal'
    );
    return { currentView, viewClass };
  },
  methods: {
    handleViewChange(view: string) {
      this.currentView = view;
    },
  },
  async mounted() {
    await configHelper.initSettings();
  },
};
</script>

<template>
  <div class="main-content" :class="viewClass">
    <template v-if="currentView === 'qso'">
      <div class="qso-layout">
        <div class="left-column">
          <AppHeader />
          <QsoPanel />
          <LogArea />
        </div>
        <div class="right-column">
          <DxCluster />
        </div>
      </div>
    </template>
    <ContestModeShell v-else-if="currentView === 'contest'" />
    <VoiceKeyerPage v-else-if="currentView === 'voiceKeyer'" />
    <LogBook v-else-if="currentView === 'logbook'" />
    <Awards v-else-if="currentView === 'awards'" />
    <ConfigView v-else-if="currentView === 'settings'" />
  </div>
</template>

<style scoped>
.main-content {
  margin-left: 60px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--page-pad, 0.35rem);
  box-sizing: border-box;
  min-height: 0;
}

.main-content.mode-contest {
  padding-bottom: var(--page-pad);
}

.qso-layout {
  height: 100%;
  width: auto;
  display: flex;
  gap: var(--spacing-md, 1rem);
}

.left-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 1rem);
}

.right-column {
  width: 300px;
  min-width: 300px;
}
</style>
