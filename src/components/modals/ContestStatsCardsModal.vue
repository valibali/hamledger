<script lang="ts">
import BaseModal from './BaseModal.vue';

type StatsCard = { key: string; label: string };

export default {
  name: 'ContestStatsCardsModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    cards: { type: Array as () => StatsCard[], required: true },
    enabled: { type: Object as () => Record<string, boolean>, required: true },
    onToggle: { type: Function, required: true },
    onClose: { type: Function, required: true },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Rate & Score Cards"
    width="min(520px, 92vw)"
    :on-close="onClose"
  >
    <div class="cards-body">
      <label v-for="card in cards" :key="card.key" class="toggle-row">
        <input
          type="checkbox"
          :checked="enabled[card.key]"
          @change="onToggle(card.key, $event.target.checked)"
        />
        <span>{{ card.label }}</span>
      </label>
    </div>
  </BaseModal>
</template>

<style scoped>
.cards-body {
  display: grid;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.75);
}
</style>
