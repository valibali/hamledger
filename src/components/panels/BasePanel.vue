<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'BasePanel',
  props: {
    title: {
      type: String,
      default: '',
    },
    tag: {
      type: String,
      default: 'section',
    },
  },
});
</script>

<template>
  <component :is="tag" class="base-panel panel">
    <div v-if="$slots.header" class="base-panel-header">
      <slot name="header" />
    </div>
    <h3 v-else-if="title" class="panel-title">{{ title }}</h3>
    <slot />
  </component>
</template>

<style scoped>
.base-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  --panel-scroll-gutter: 0.45rem;
}

.base-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.base-panel :deep(.panel-scroll) {
  padding-right: var(--panel-scroll-gutter);
  margin-right: calc(var(--panel-scroll-gutter) * -1);
}
</style>
