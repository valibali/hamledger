<script lang="ts">
import { useAwardsStore } from '../store/awards';

interface SidebarItem {
  view: string;
  icon: string;
  active?: boolean;
}

export default {
  name: 'SideBar',
  data() {
    return {
      awardsStore: useAwardsStore(),
      currentView: 'qso',
      sidebarItems: [
        {
          view: 'qso',
          icon: `<path d="M103.844 89.068C106.385 86.868 108 83.625 108 80c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 3.625 1.615 6.868 4.156 9.068L54.14 176h15.07L96 158.14 122.79 176h15.07l-34.016-86.932zM66.789 168h-.929l9.296-23.755 13.633 9.088-22 14.667zm11.43-31.328l-.241.36 17.63-45.052c.13.004.26.02.392.02s.261-.016.393-.02l17.629 45.053-.24-.361L96 148.526l-17.781-11.854zm24.992 16.661l13.633-9.088L126.14 168h-.93l-22-14.667zM56 80c0-22.056 17.944-40 40-40s40 17.944 40 40c0 12.57-5.834 23.799-14.93 31.137l-3.095-7.908C124.142 97.392 128 89.14 128 80c0-17.645-14.355-32-32-32S64 62.355 64 80c0 9.14 3.858 17.392 10.025 23.229l-3.095 7.908C61.834 103.799 56 92.57 56 80zm-5.255 45.255C38.657 113.167 32 97.095 32 80s6.657-33.167 18.745-45.255S78.905 16 96 16s33.167 6.657 45.255 18.745S160 62.905 160 80s-6.657 33.167-18.745 45.255a64.491 64.491 0 0 1-11.17 8.919l-2.972-7.594a56.573 56.573 0 0 0 8.485-6.982C146.175 109.02 152 94.958 152 80s-5.825-29.021-16.402-39.598C125.02 29.825 110.958 24 96 24s-29.021 5.825-39.598 16.402C45.825 50.98 40 65.042 40 80s5.825 29.021 16.402 39.598a56.573 56.573 0 0 0 8.485 6.982l-2.971 7.594a64.491 64.491 0 0 1-11.17-8.92z"/>`,
        },
        {
          view: 'logbook',
          icon: `<path d="M108 32c-4.8 0-9.1 2.1-12 5.5-2.9-3.3-7.2-5.5-12-5.5H16v120h68c4.4 0 8 3.6 8 8h8c0-4.4 3.6-8 8-8h68V32h-68zM92 146.1c-2.4-1.4-5.1-2.1-8-2.1H24V40h60c4.4 0 8 3.6 8 8v98.1zm76-2.1h-60c-2.9 0-5.6.8-8 2.1V48c0-4.4 3.6-8 8-8h60v104z"/>`,
        },
        {
          view: 'awards',
          icon: `<path d="M36 16v51.358l54.707 30.284L81.527 116H50.344l24.914 24.914-14.873 34.702L96 160.352l35.616 15.264-14.873-34.702L141.657 116h-31.185l-9.179-18.358L156 67.358V16H36zm8 8h104v32H44V24zm78.343 100l-15.086 15.086 9.127 21.298L96 151.648l-20.384 8.736 9.127-21.298L69.657 124h16.815L96 104.944 105.528 124h16.815zm-24.63-33.52L96 87.056l-1.712 3.424L46.453 64h99.094L97.712 90.48z"/>`,
        },
        {
          view: 'settings',
          icon: `<path d="M170.7,81.3c-7-7-18.4-7-25.4,0l0,0l0,0l-55,55l-12.7,38.1l38.1-12.7l55-55l0,0C177.7,99.7,177.7,88.3,170.7,81.3z M90.3,161.7l5.3-15.9l10.6,10.6L90.3,161.7z M165.1,101L165.1,101l-51.5,51.5l-14.1-14.1L151,86.9c3.9-3.8,10.2-3.8,14.1,0 C169,90.8,169,97.1,165.1,101z M170.7,81.3c-7-7-18.4-7-25.4,0l-55,55l-12.7,38.1l38.1-12.7l55-55l0,0 C177.7,99.7,177.7,88.3,170.7,81.3z M90.3,161.7l5.3-15.9l10.6,10.6L90.3,161.7z M165.1,101L165.1,101l-51.5,51.5l-14.1-14.1 L151,86.9c3.9-3.8,10.2-3.8,14.1,0C169,90.8,169,97.1,165.1,101z M67,153.1l-15.8,9.3l-2.1-1.5c-6.9-5-12.9-11-17.9-17.9l-1.5-2.1 l9.3-15.8c-1.5-3-2.8-6-3.8-9.2l-17.7-4.6l-0.4-2.6c-0.7-4.2-1-8.4-1-12.6s0.3-8.4,1-12.6l0.4-2.6l17.7-4.6c1-3.1,2.3-6.2,3.8-9.1 l-9.3-15.8l1.5-2.1c5-6.9,11-12.9,17.9-17.9l2.1-1.5L67,38.9c3-1.5,6-2.8,9.2-3.8l4.6-17.7l2.6-0.4c8.4-1.3,16.9-1.3,25.3,0l2.6,0.4 l4.6,17.7c3.1,1,6.2,2.3,9.1,3.8l15.8-9.3l2.1,1.5c6.9,5,12.9,11,17.9,17.9l1.5,2.1L153.1,67c0.2,0.5,0.4,0.9,0.7,1.4 c-2.7,0.4-5.3,1.3-7.7,2.6c-0.3-0.7-0.7-1.4-1.1-2.1l-1.1-2l8.9-15.2c-3.6-4.6-7.8-8.8-12.5-12.5l-15.2,8.9l-2-1.1 c-3.7-2.1-7.6-3.7-11.7-4.9l-2.2-0.6l-4.4-17c-5.9-0.7-11.7-0.7-17.6,0l-4.4,17l-2.2,0.6c-4.1,1.2-8,2.8-11.7,4.9l-2,1.1l-15.2-8.9 c-4.6,3.6-8.8,7.8-12.5,12.5l8.9,15.2l-1.1,2c-2.1,3.7-3.7,7.6-4.9,11.7l-0.6,2.2l-17,4.4C24.2,90.1,24,93.1,24,96 c0,2.9,0.2,5.9,0.5,8.8l17,4.4l0.6,2.2c1.2,4.1,2.8,8,4.9,11.7l1.1,2l-8.9,15.2c3.6,4.6,7.8,8.8,12.5,12.5l15.2-8.9l2,1.1 c2.8,1.6,5.8,2.9,8.8,4l-2.5,7.6C72.4,155.6,69.6,154.4,67,153.1z M64,96c0-17.6,14.4-32,32-32c15,0,27.6,10.3,31,24.2l-7.1,7.1 C119.6,82.4,109,72,96,72c-13.2,0-24,10.8-24,24c0,13,10.4,23.6,23.3,24l-7.1,7.1C74.3,123.6,64,111,64,96z"/>`,
        },
      ] as SidebarItem[],
    };
  },
};
</script>

<template>
  <aside class="sidebar">
    <nav>
      <ul>
        <li
          v-for="item in sidebarItems"
          :key="item.view"
          :class="['sidebar-item', { active: item.view === currentView }]"
          :data-view="item.view"
          @click="
            currentView = item.view;
            $emit('view-change', item.view);
            if (item.view === 'awards') awardsStore.markAchievementsViewed();
          "
        >
          <div class="sidebar-icon-wrapper">
            <svg class="sidebar-icon" viewBox="0 0 192 192" v-html="item.icon"></svg>
            <!-- Achievement badge for awards -->
            <span 
              v-if="item.view === 'awards' && awardsStore.unviewedCount > 0" 
              class="achievement-badge"
            >
              {{ awardsStore.unviewedCount > 9 ? '9+' : awardsStore.unviewedCount }}
            </span>
          </div>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 60px;
  background: var(--bg-darker);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-md) 0;
  z-index: 999;
}

.sidebar nav {
  width: 100%;
}

.sidebar nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
  color: var(--gray-color);
}

.sidebar-item:hover {
  background: var(--bg-dark);
}

.sidebar-item.active {
  background: transparent;
}

.sidebar-icon {
  width: 30px;
  height: 30px;
  transition: transform 0.2s ease;
  fill: var(--gray-color);
}

.sidebar-item:hover .sidebar-icon {
  transform: scale(1.1);
  fill: var(--main-color);
}

.sidebar-icon-wrapper {
  position: relative;
  display: inline-flex;
}

.achievement-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #f44336;
  color: white;
  font-size: 10px;
  font-weight: bold;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  animation: badge-pulse 2s infinite;
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
</style>
