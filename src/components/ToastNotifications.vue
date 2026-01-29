<script lang="ts">
import { useAwardsStore } from '../store/awards';
import type { Achievement } from '../types/awards';

export default {
  name: 'ToastNotifications',
  data() {
    return {
      awardsStore: useAwardsStore(),
      displayedToasts: [] as Achievement[],
      maxToasts: 3,
    };
  },
  watch: {
    'awardsStore.unviewedAchievements': {
      handler(newAchievements: Achievement[]) {
        // Show new achievements as toasts
        const newOnes = newAchievements.filter(
          a => !this.displayedToasts.find(d => d.id === a.id)
        );
        
        for (const achievement of newOnes) {
          this.showToast(achievement);
        }
      },
      deep: true,
    },
  },
  methods: {
    showToast(achievement: Achievement) {
      // Add to displayed toasts
      this.displayedToasts.push(achievement);
      
      // Limit visible toasts
      if (this.displayedToasts.length > this.maxToasts) {
        this.displayedToasts.shift();
      }
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        this.dismissToast(achievement.id);
      }, 5000);
    },
    
    dismissToast(id: string) {
      const index = this.displayedToasts.findIndex(t => t.id === id);
      if (index > -1) {
        this.displayedToasts.splice(index, 1);
      }
    },
    
    getIcon(type: string): string {
      const icons: Record<string, string> = {
        dxcc: '🌍',
        was: '🇺🇸',
        waz: '🗺️',
        grid: '📍',
        iota: '🏝️',
        milestone: '🏆',
      };
      return icons[type] || '🎉';
    },
  },
};
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div 
        v-for="toast in displayedToasts" 
        :key="toast.id" 
        :class="['toast', `toast-${toast.type}`]"
        @click="dismissToast(toast.id)"
      >
        <span class="toast-icon">{{ getIcon(toast.type) }}</span>
        <div class="toast-content">
          <span class="toast-title">{{ toast.title }}</span>
          <span class="toast-description">{{ toast.description }}</span>
        </div>
        <button class="toast-close" @click.stop="dismissToast(toast.id)">×</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border-left: 4px solid var(--main-color);
  min-width: 300px;
  max-width: 400px;
  pointer-events: auto;
  cursor: pointer;
  animation: slideIn 0.3s ease-out;
}

.toast:hover {
  background: #333;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-dxcc {
  border-left-color: #4caf50;
}

.toast-was {
  border-left-color: #2196f3;
}

.toast-waz {
  border-left-color: #ff9800;
}

.toast-grid {
  border-left-color: #9c27b0;
}

.toast-iota {
  border-left-color: #00bcd4;
}

.toast-milestone {
  border-left-color: #ffd700;
}

.toast-icon {
  font-size: 1.5rem;
}

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.toast-title {
  font-weight: bold;
  font-size: 0.95rem;
  color: #fff;
}

.toast-description {
  font-size: 0.85rem;
  color: #aaa;
}

.toast-close {
  background: none;
  border: none;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.toast-close:hover {
  color: #fff;
}

/* Transition animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
