<script lang="ts">
import SideBar from './components/SideBar.vue';
import MainContent from './components/MainContent.vue';
import SetupWizard from './components/SetupWizard.vue';
import ToastNotifications from './components/ToastNotifications.vue';
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
  },
  data() {
    return {
      showSetupWizard: false,
      isInitialized: false,
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
    },
  },
};
</script>

<template>
  <div class="app-container">
    <template v-if="isInitialized">
      <SideBar
        v-if="!showSetupWizard"
        @view-change="view => ($refs.mainContent as any)?.handleViewChange(view)"
      />
      <MainContent v-if="!showSetupWizard" ref="mainContent" />
      <SetupWizard v-if="showSetupWizard" @complete="onSetupComplete" />
      <!-- Toast notifications for achievements -->
      <ToastNotifications v-if="!showSetupWizard" />
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
  padding: 1rem;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
