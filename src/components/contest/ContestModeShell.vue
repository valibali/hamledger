<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useContestStore } from '../../store/contest';
import ContestModePage from './ContestModePage.vue';
import RigctldConnectionDialog from '../rig/RigctldConnectionDialog.vue';

const contestStore = useContestStore();


onMounted(() => {
  contestStore.enterContestMode();
});

onBeforeUnmount(() => {
  contestStore.exitContestMode();
});
</script>

<template>
  <div class="contest-shell">
    <ContestModePage />
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

</style>
