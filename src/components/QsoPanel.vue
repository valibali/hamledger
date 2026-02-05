<script lang="ts">
import QsoInput from './qso/QsoInput.vue';
import RemoteStation from './qso/RemoteStation.vue';

export default {
  name: 'QsoPanel',
  components: {
    QsoInput,
    RemoteStation,
  },
};
</script>

<template>
  <div class="qso-panel">
    <QsoInput />
    <RemoteStation />
  </div>
</template>

<style scoped>
.qso-panel {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md, 1rem);
}
</style>
