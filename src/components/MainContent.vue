<script lang="ts">
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import QsoPanel from './QsoPanel.vue'
import LogArea from './LogArea.vue'
import LogBook from './LogBook.vue'
import ConfigView from './ConfigView.vue'
import { configHelper } from '../utils/configHelper'

export default {
  name: 'MainContent',
  components: {
    AppHeader,
    QsoPanel,
    LogArea,
    LogBook,
    ConfigView
  },
  setup() {
    const currentView = ref('qso')
    return { currentView }
  },
  methods: {
    handleViewChange(view: string) {
      this.currentView = view;
    }
  },
  async mounted() {
    await configHelper.initSettings()
  }
}
</script>

<template>
  <div class="main-content">
    <template v-if="currentView === 'qso'">
      <div class="qso-layout">
        <AppHeader />
        <QsoPanel />
        <LogArea />
      </div>
    </template>
    <LogBook v-else-if="currentView === 'logbook'" />
    <ConfigView v-else-if="currentView === 'settings'" />
  </div>
</template>

<style scoped>
.main-content {
  margin-left: 60px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.qso-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>
