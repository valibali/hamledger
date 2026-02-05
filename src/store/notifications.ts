import { defineStore } from 'pinia';

export interface NotificationToast {
  id: string;
  type: 'keyer' | 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string;
  status?: 'pending' | 'active';
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    toasts: [] as NotificationToast[],
  }),
  actions: {
    pushToast(toast: Omit<NotificationToast, 'id'>) {
      const entry: NotificationToast = {
        id: `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...toast,
      };
      this.toasts.push(entry);
      return entry.id;
    },
    updateToast(id: string, patch: Partial<NotificationToast>) {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index > -1) {
        this.toasts[index] = { ...this.toasts[index], ...patch };
      }
    },
    dismissToast(id: string) {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    },
  },
});
