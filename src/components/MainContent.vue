<script lang="ts">
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import QsoPanel from './QsoPanel.vue'
import LogArea from './LogArea.vue'
import LogBook from './LogBook.vue'

export default {
  name: 'MainContent',
  components: {
    AppHeader,
    QsoPanel,
    LogArea,
    LogBook
  },
  setup() {
    const currentView = ref('qso')
    return { currentView }
  },
  methods: {
    handleViewChange(view: string) {
      this.currentView = view;
    }
  }
}
</script>

<template>
  <div class="main-content">
    <template v-if="currentView === 'qso'">
      <AppHeader />
      <QsoPanel />
      <LogArea />
    </template>
    <LogBook v-else-if="currentView === 'logbook'" />
  </div>
</template>
