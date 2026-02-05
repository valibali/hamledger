<script lang="ts">
import SideBar from './components/SideBar.vue';
import MainContent from './components/MainContent.vue';
import SetupWizard from './components/SetupWizard.vue';
import ToastNotifications from './components/ToastNotifications.vue';
import VoiceKeyerHotkeys from './components/VoiceKeyerHotkeys.vue';
import { useQsoStore } from './store/qso';
import { useAwardsStore } from './store/awards';
import { configHelper } from './utils/configHelper';

export default {
  name: 'App',
  components: {
    SideBar,
    MainContent,
    SetupWizard,
    ToastNotifications,
    VoiceKeyerHotkeys,
  },
  data() {
    return {
      showSetupWizard: false,
      isInitialized: false,
      showModeSelector: false,
    };
  },
  async mounted() {
    await this.checkInitialSetup();

    if (!this.showSetupWizard) {
      const qsoStore = useQsoStore();
      await qsoStore.init();
      
      // Initialize awards from existing QSOs
      await this.initializeAwards();
    }

    this.isInitialized = true;
    if (!this.showSetupWizard) {
      this.showModeSelector = true;
    }
  },
  methods: {
    async checkInitialSetup() {
      try {
        await configHelper.initSettings();
        // If we get here without error, settings exist
        this.showSetupWizard = false;
      } catch {
        // Settings don't exist or failed to load, show wizard
        console.log('No settings found, showing setup wizard');
        this.showSetupWizard = true;
      }
    },
    async initializeAwards() {
      const qsoStore = useQsoStore();
      const awardsStore = useAwardsStore();
      
      // Calculate awards from existing log
      if (qsoStore.allQsos.length > 0) {
        console.log('[Awards] Initializing from existing log...');
        await awardsStore.calculateFromLog(qsoStore.allQsos);
        // Clear any achievements from initial calculation (they're historical)
        awardsStore.markAchievementsViewed();
      }
    },
    async onSetupComplete() {
      this.showSetupWizard = false;

      // Initialize config helper with new settings
      await configHelper.initSettings();

      // Initialize QSO store
      const qsoStore = useQsoStore();
      await qsoStore.init();
      
      // Initialize awards
      await this.initializeAwards();

      this.showModeSelector = true;
    },
    selectStartupView(view: string) {
      this.showModeSelector = false;
      (this.$refs.mainContent as any)?.handleViewChange(view);
      (this.$refs.sideBar as any)?.setView?.(view);
    },
  },
};
</script>

<template>
  <div class="app-container">
    <template v-if="isInitialized">
      <SideBar
        v-if="!showSetupWizard"
        ref="sideBar"
        @view-change="view => ($refs.mainContent as any)?.handleViewChange(view)"
      />
      <MainContent v-if="!showSetupWizard" ref="mainContent" />
      <SetupWizard v-if="showSetupWizard" @complete="onSetupComplete" />
      <!-- Toast notifications for achievements -->
      <ToastNotifications v-if="!showSetupWizard" />
      <VoiceKeyerHotkeys v-if="!showSetupWizard" />
      <div v-if="showModeSelector" class="startup-modal">
        <div class="startup-card">
          <h2>Start Mode</h2>
          <p>Select the operating mode to open.</p>
          <div class="startup-actions">
            <button class="startup-btn" @click="selectStartupView('qso')">
              Normal Logging
            </button>
            <button class="startup-btn primary" @click="selectStartupView('contest')">
              Contest Mode
            </button>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="loading-container">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span class="loading-text">Initializing application...</span>
        <div class="loading-subtext">Please wait while we set up everything</div>
      </div>
    </div>
  </div>
</template>

<style>
@import './assets/styles.css';

.app-container {
  display: flex;
  height: 100vh;
  padding: 0;
  box-sizing: border-box;
}

.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: #2b2b2b;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #444;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #444;
  border-top: 4px solid var(--main-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: var(--main-color);
  font-size: 1.1rem;
  font-weight: bold;
}

.loading-subtext {
  color: var(--gray-color);
  font-size: 0.9rem;
}

.startup-modal {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.startup-card {
  background: #1f1f1f;
  border: 1px solid #2f2f2f;
  border-radius: 10px;
  padding: 2rem;
  min-width: 360px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.startup-card h2 {
  color: var(--main-color);
  font-size: 1.4rem;
}

.startup-card p {
  color: var(--gray-color);
  font-size: 0.95rem;
}

.startup-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.startup-btn {
  background: #2b2b2b;
  border: 1px solid #3a3a3a;
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.startup-btn.primary {
  background: rgba(255, 165, 0, 0.2);
  border-color: var(--main-color);
  color: var(--main-color);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
