<script lang="ts">
import { useAwardsStore } from '../store/awards';
import { useNotificationsStore } from '../store/notifications';
import type { Achievement } from '../types/awards';
import type { NotificationToast } from '../store/notifications';

export default {
  name: 'ToastNotifications',
  data() {
    return {
      awardsStore: useAwardsStore(),
      notificationsStore: useNotificationsStore(),
      displayedToasts: [] as Achievement[],
      displayedNotifications: [] as NotificationToast[],
      notificationTimers: {} as Record<string, number>,
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
    'notificationsStore.toasts': {
      handler(newToasts: NotificationToast[]) {
        const newOnes = newToasts.filter(
          t => !this.displayedNotifications.find(d => d.id === t.id)
        );
        for (const toast of newOnes) {
          this.showNotification(toast);
        }
        for (const toast of newToasts) {
          this.syncNotification(toast);
        }
        const stale = this.displayedNotifications.filter(
          toast => !newToasts.find(item => item.id === toast.id)
        );
        for (const toast of stale) {
          this.dismissNotification(toast.id);
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
    showNotification(toast: NotificationToast) {
      this.displayedNotifications.push(toast);
      if (this.displayedNotifications.length > this.maxToasts) {
        this.displayedNotifications.shift();
      }
      if (toast.status !== 'pending') {
        this.scheduleDismiss(toast.id);
      }
    },
    syncNotification(toast: NotificationToast) {
      const existing = this.displayedNotifications.find(item => item.id === toast.id);
      if (existing) {
        Object.assign(existing, toast);
      }
      if (toast.status !== 'pending' && !this.notificationTimers[toast.id]) {
        this.scheduleDismiss(toast.id);
      }
    },
    scheduleDismiss(id: string) {
      if (this.notificationTimers[id]) return;
      this.notificationTimers[id] = window.setTimeout(() => {
        this.dismissNotification(id);
      }, 4000);
    },
    dismissNotification(id: string) {
      const index = this.displayedNotifications.findIndex(t => t.id === id);
      if (index > -1) {
        this.displayedNotifications.splice(index, 1);
      }
      if (this.notificationTimers[id]) {
        window.clearTimeout(this.notificationTimers[id]);
        delete this.notificationTimers[id];
      }
      this.notificationsStore.dismissToast(id);
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
        keyer: '📣',
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
      <div
        v-for="toast in displayedNotifications"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`, { pending: toast.status === 'pending' }]"
        @click="dismissNotification(toast.id)"
      >
        <span class="toast-icon">{{ getIcon(toast.type) }}</span>
        <div class="toast-content">
          <span class="toast-title">{{ toast.title }}</span>
          <span class="toast-description">{{ toast.description }}</span>
        </div>
        <span v-if="toast.status === 'pending'" class="toast-pending">Pending</span>
        <button class="toast-close" @click.stop="dismissNotification(toast.id)">×</button>
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
  position: relative;
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

.toast-keyer {
  border-left-color: #34d399;
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
.toast.pending {
  opacity: 0.5;
}

.toast-pending {
  position: absolute;
  top: 0.4rem;
  right: 2.2rem;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f3b240;
}
