<script lang="ts">
import Sidebar from './components/Sidebar.vue'
import MainContent from './components/MainContent.vue'
import { useQsoStore } from './store/qso'

export default {
  name: 'App',
  components: {
    Sidebar,
    MainContent
  },
  async mounted() {
    const qsoStore = useQsoStore()
    await qsoStore.init()
  }
}
</script>

<template>
  <div class="app-container">
    <Sidebar />
    <MainContent />
  </div>
</template>

<style>
@import './assets/styles.css';

.app-container {
  display: flex;
  min-height: 100vh;
}
</style>
