<script lang="ts">
import { useRigStore } from '../../store/rig';
import { useQsoStore } from '../../store/qso';
import { configHelper } from '../../utils/configHelper';
import { useRigctldConnectionDialog } from '../../composables/useRigctldConnectionDialog';
import { useRigctldConnectionForm } from '../../composables/useRigctldConnectionForm';
import { useRigctldModels } from '../../composables/useRigctldModels';
import RigctldConnectionDialog from '../rig/RigctldConnectionDialog.vue';

export default {
  name: 'RigControl',
  components: {
    RigctldConnectionDialog,
  },
  data() {
    return {
      rigStore: useRigStore(),
      qsoStore: useQsoStore(),
      rigctldDialog: useRigctldConnectionDialog(),
      rigctldForm: useRigctldConnectionForm(),
      rigctldModels: useRigctldModels(),
      rigModel: '',
      rigPort: '',
      showWSJTXDialog: false,
      showTakeBackDialog: false,
      showAdminRetryDialog: false,
      wsjtxEnabled: false,
      firewallStatus: {
        isConfiguring: false,
        success: false,
        error: null as string | null,
        userCancelled: false,
      },
      wsjtxForm: {
        enabled: false,
        port: 2237,
        autoLog: false,
        logOnlyConfirmed: false,
      },
    };
  },
  async mounted() {
    await this.loadRigConfig();
    await this.loadRigModels();
    await this.checkWSJTXSettings();
    // Auto-connect if configuration exists and WSJT-X is not enabled
    const form = this.getConnectionForm();
    if (form.host && form.port && !this.wsjtxEnabled) {
      await this.handleConnect();
    }
  },
  computed: {
    isConnected() {
      return this.rigStore.isConnected;
    },
    connectionStatus() {
      if (this.rigStore.isLoading) return 'Connecting...';
      if (this.rigStore.connectionStatus === 'checking') return 'Checking...';
      if (this.rigStore.isConnected) {
        if (this.rigStore.usingExternalRigctld) {
          return 'Connected (External)';
        }
        return 'Connected';
      }
      if (this.rigStore.connectionStatus === 'error') return 'Error';
      return 'Disconnected';
    },
    connectionStatusClass() {
      if (this.rigStore.isLoading || this.rigStore.connectionStatus === 'checking') {
        return 'status-connecting';
      }
      if (this.rigStore.isConnected) {
        if (this.rigStore.usingExternalRigctld) {
          return 'status-external';
        }
        return 'status-connected';
      }
      if (this.rigStore.connectionStatus === 'error') return 'status-error';
      if (this.wsjtxEnabled) return 'status-wsjtx';
      return 'status-disconnected';
    },
    hasSuggestions() {
      return this.rigStore.connectionSuggestions && this.rigStore.connectionSuggestions.length > 0;
    },
    hasFirewallSuggestion() {
      if (!this.hasSuggestions) return false;
      return this.rigStore.connectionSuggestions.some(suggestion =>
        suggestion.toLowerCase().includes('firewall')
      );
    },
    showFirewallAction() {
      return (
        !this.rigStore.isConnected &&
        (this.hasFirewallSuggestion || this.rigStore.diagnostics?.firewallOk === false)
      );
    },
    firstSuggestion() {
      if (this.hasSuggestions) {
        return this.rigStore.connectionSuggestions[0];
      }
      return null;
    },
    wsjtxStatus() {
      return this.qsoStore.wsjtxStatus;
    },
    wsjtxAllowed(): boolean {
      return (configHelper.getSetting(['wsjtx'], 'enabled') as boolean) || false;
    },
    rigctldDialogOpen(): boolean {
      return this.rigctldDialog.isOpen.value;
    },
  },
  watch: {
    rigctldDialogOpen(newValue: boolean, oldValue: boolean) {
      if (!newValue && oldValue) {
        this.loadRigConfig();
      }
    },
  },
  methods: {
    getConnectionForm() {
      return (
        (this.rigctldForm.connectionForm as any).value ?? this.rigctldForm.connectionForm
      );
    },
    getRigModelsList() {
      return (this.rigctldModels.rigModels as any).value ?? this.rigctldModels.rigModels ?? [];
    },
    async loadRigConfig() {
      await this.rigctldForm.loadRigConfig();
      const rigModelNumber = configHelper.getSetting(['rig'], 'rigModel');

      const models = this.getRigModelsList();
      if (rigModelNumber && models.length > 0) {
        const rigModel = models.find(
          model => model.id === rigModelNumber
        );
        this.rigModel = rigModel
          ? `${rigModel.manufacturer} ${rigModel.model}`
          : `Model ${rigModelNumber}`;
      } else {
        this.rigModel = this.rigStore.rigModel;
      }

      this.rigPort = configHelper.getSetting(['rig'], 'port') || 'localhost:4532';
    },

    async loadRigModels() {
      await this.rigctldModels.loadRigModels();
      await this.loadRigConfig();
    },

    async handleConnect() {
      try {
        const form = this.getConnectionForm();
        const response = await this.rigStore.connect(
          form.host,
          form.port,
          form.model,
          form.device
        );

        if (this.rigStore.isConnected) {
          // Start polling for rig state updates
          this.startRigPolling();
        } else if (response.shouldRetry) {
          // Firewall was configured, automatically retry connection
          console.log('Firewall configured, retrying connection...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Retry connection without attempting firewall fix again
          await this.rigStore.connect(form.host, form.port, form.model, form.device);

          if (this.rigStore.isConnected) {
            this.startRigPolling();
          } else {
            // Still failed after firewall fix, offer admin option
            console.log('Connection still failed after firewall fix');
            this.showAdminRetryDialog = true;
          }
        } else if (response.userCancelled) {
          // User cancelled UAC prompt for firewall
          console.log('User cancelled firewall configuration');
          // Don't show admin dialog, user explicitly cancelled
        } else if (response.firewallConfigured === false && response.firewallError) {
          // Firewall configuration failed for some reason
          console.error('Firewall configuration failed:', response.firewallError);
          // Offer admin option
          this.showAdminRetryDialog = true;
        }
      } catch (error) {
        console.error('Connection failed:', error);
      }
    },

    async handleRunAsAdmin() {
      this.showAdminRetryDialog = false;
      try {
        const response = await this.rigStore.startRigctldElevated();

        if (this.rigStore.isConnected) {
          this.startRigPolling();
        } else if (response.userCancelled) {
          console.log('User cancelled elevated rigctld start');
        } else {
          console.error('Failed to start elevated rigctld:', response.error);
        }
      } catch (error) {
        console.error('Error starting elevated rigctld:', error);
      }
    },

    closeAdminRetryDialog() {
      this.showAdminRetryDialog = false;
    },

    // Start rig polling with S-meter interval from settings
    startRigPolling() {
      // Get S-meter refresh rate from settings (default 250ms)
      const smeterInterval = configHelper.getSetting(['ui', 'refreshRates'], 'smeter') as number || 250;
      console.log(`[RigControl] Starting polling with S-meter interval: ${smeterInterval}ms`);
      
      // Reset S-meter status for fresh capability check
      this.rigStore.resetSmeterStatus();
      
      // Start all polling (main at 2000ms, S-meter at configured interval)
      this.rigStore.startAllPolling(2000, smeterInterval);
    },

    async handleReconnect() {
      this.rigStore.resetSmeterStatus(); // Reset S-meter status on reconnect
      await this.rigStore.handleReconnect();
      if (this.rigStore.isConnected) {
        this.startRigPolling();
      }
    },

    async handleDisconnect() {
      this.rigStore.stopAllPolling();
      await this.rigStore.handleDisconnect();
    },

    showConnectionSettings() {
      if (this.wsjtxEnabled) {
        this.loadWSJTXSettings();
        this.showWSJTXDialog = true;
      } else {
        this.rigctldDialog.open();
      }
    },

    closeWSJTXDialog() {
      this.showWSJTXDialog = false;
    },

    showTakeBackConfirmation() {
      this.showTakeBackDialog = true;
    },

    closeTakeBackDialog() {
      this.showTakeBackDialog = false;
    },

    confirmTakeBack() {
      this.closeTakeBackDialog();
      this.takeBackFromWSJTX();
    },

    async loadWSJTXSettings() {
      await configHelper.initSettings();
      this.wsjtxForm.enabled = configHelper.getSetting(['wsjtx'], 'enabled') || false;
      this.wsjtxForm.port = configHelper.getSetting(['wsjtx'], 'port') || 2237;
      this.wsjtxForm.autoLog = configHelper.getSetting(['wsjtx'], 'autoLog') || false;
      this.wsjtxForm.logOnlyConfirmed =
        configHelper.getSetting(['wsjtx'], 'logOnlyConfirmed') || false;
    },

    async saveWSJTXSettings() {
      await configHelper.updateSetting(['wsjtx'], 'enabled', this.wsjtxForm.enabled);
      await configHelper.updateSetting(['wsjtx'], 'port', this.wsjtxForm.port);
      await configHelper.updateSetting(['wsjtx'], 'autoLog', this.wsjtxForm.autoLog);
      await configHelper.updateSetting(
        ['wsjtx'],
        'logOnlyConfirmed',
        this.wsjtxForm.logOnlyConfirmed
      );

      this.closeWSJTXDialog();
    },


    async checkWSJTXSettings() {
      await configHelper.initSettings();
      // Don't automatically enable WSJT-X mode, just check if it's allowed
      this.wsjtxEnabled = false;
    },

    async handOverToWSJTX() {
      try {
        // First disconnect from rigctld
        if (this.rigStore.isConnected) {
          this.rigStore.stopAllPolling();
          await this.rigStore.handleDisconnect();
        }

        // Set WSJT-X mode active (but don't change the enabled setting)
        this.wsjtxEnabled = true;

        // Start WSJT-X service
        const wsjtxPort = configHelper.getSetting(['wsjtx'], 'port') || 2237;
        const result = await this.qsoStore.startWSJTX(wsjtxPort);

        if (result.success) {
          console.log('WSJT-X service started, CAT control handed over');
        } else {
          console.error('Failed to start WSJT-X service:', result.error);
        }
      } catch (error) {
        console.error('Error handing over to WSJT-X:', error);
      }
    },

    async takeBackFromWSJTX() {
      try {
        // Stop WSJT-X service
        await this.qsoStore.stopWSJTX();

        // Set WSJT-X mode inactive (but don't change the enabled setting)
        this.wsjtxEnabled = false;

        // Reconnect to rigctld
        await this.handleConnect();
        if (this.rigStore.isConnected) {
          this.startRigPolling();
        }
      } catch (error) {
        console.error('Error taking back from WSJT-X:', error);
      }
    },

    async runDiagnostics() {
      console.log('Running connection diagnostics...');
      const diagnostics = await this.rigStore.runDiagnostics();
      if (diagnostics) {
        console.log('Diagnostics result:', diagnostics);
      }
    },
    async addFirewallExceptions() {
      if (this.firewallStatus.isConfiguring) return;
      this.firewallStatus.isConfiguring = true;
      this.firewallStatus.success = false;
      this.firewallStatus.error = null;
      this.firewallStatus.userCancelled = false;

      try {
        const result = await window.electronAPI.addFirewallExceptions();
        if (result.success) {
          this.firewallStatus.success = true;
        } else if (result.userCancelled) {
          this.firewallStatus.userCancelled = true;
        } else {
          this.firewallStatus.error = result.error || 'Unknown error occurred';
        }
      } catch (error) {
        this.firewallStatus.error = error instanceof Error ? error.message : 'Unknown error occurred';
      } finally {
        this.firewallStatus.isConfiguring = false;
      }
    },
  },

  beforeUnmount() {
    // Stop polling when component is destroyed
    this.rigStore.stopAllPolling();
  },
};
</script>

<template>
  <div class="header-left rig-control-section">
    <h2 class="section-title">RIG CONTROL</h2>
    <div class="rig-control-content">
      <div class="rig-info">
        <div class="rig-title">
          {{ rigModel }}
          <span class="port-badge">{{ rigPort }}</span>
        </div>
        <div class="connection-status" :class="connectionStatusClass">
          {{ wsjtxEnabled ? 'WSJT-X Mode' : connectionStatus }}
        </div>
        <div v-if="rigStore.error" class="error-message">
          {{ rigStore.error }}
        </div>
        <!-- Show first suggestion when there's an error -->
        <div v-if="hasSuggestions && !rigStore.isConnected" class="suggestion-message">
          {{ firstSuggestion }}
        </div>
        <div v-if="showFirewallAction" class="firewall-action">
          <button
            class="firewall-btn"
            @click="addFirewallExceptions"
            :disabled="firewallStatus.isConfiguring"
          >
            {{ firewallStatus.isConfiguring ? 'Adding...' : 'Add Firewall Exception' }}
          </button>
          <div v-if="firewallStatus.success" class="success-message">
            Firewall exceptions added successfully.
          </div>
          <div v-else-if="firewallStatus.userCancelled" class="warning-message">
            Firewall configuration was cancelled.
          </div>
          <div v-else-if="firewallStatus.error" class="error-message">
            Firewall configuration failed: {{ firewallStatus.error }}
          </div>
        </div>
        <!-- Diagnostics link when disconnected or error -->
        <div v-if="!rigStore.isConnected && !wsjtxEnabled" class="diagnostics-link">
          <button 
            class="diagnostics-btn" 
            @click="runDiagnostics"
            :disabled="rigStore.connectionStatus === 'checking'"
          >
            {{ rigStore.connectionStatus === 'checking' ? 'Checking...' : 'Run Diagnostics' }}
          </button>
        </div>
      </div>

      <div class="rig-buttons">
        <!-- Regular CAT Control buttons (only show when WSJT-X is disabled) -->
        <template v-if="!wsjtxEnabled">
          <button
            v-if="!isConnected"
            class="connect-btn"
            @click="handleConnect"
            :disabled="rigStore.isLoading"
          >
            {{ rigStore.isLoading ? 'Connecting...' : 'Connect' }}
          </button>
          <button
            v-if="isConnected"
            class="reconnect"
            @click="handleReconnect"
            :disabled="rigStore.isLoading"
          >
            Reconnect
          </button>
          <button
            v-if="isConnected"
            class="stop-btn"
            @click="handleDisconnect"
            :disabled="rigStore.isLoading"
          >
            Disconnect
          </button>
        </template>

        <!-- WSJT-X Mode buttons (only show when WSJT-X is enabled) -->
        <template v-if="wsjtxEnabled">
          <button
            v-if="!wsjtxStatus.running"
            class="wsjtx-btn"
            @click="handOverToWSJTX"
            :disabled="rigStore.isLoading"
          >
            Start WSJT-X Listener
          </button>
          <button
            v-if="wsjtxStatus.running"
            class="wsjtx-active-btn"
            @click="showTakeBackConfirmation"
            :disabled="rigStore.isLoading"
          >
            Take Back CAT Control
          </button>
        </template>

        <button class="settings-btn" @click="showConnectionSettings">
          {{ wsjtxEnabled ? 'WSJT-X Settings' : 'Settings' }}
        </button>
      </div>

      <!-- Hand over to WSJT-X button in separate row -->
      <div v-if="!wsjtxEnabled && isConnected && wsjtxAllowed" class="handover-section">
        <button class="handover-btn" @click="handOverToWSJTX" :disabled="rigStore.isLoading">
          Hand over to WSJT-X
        </button>
      </div>
    </div>

    <RigctldConnectionDialog />

    <!-- WSJT-X Settings Dialog -->
    <div v-if="showWSJTXDialog" class="connection-dialog-overlay" @click="closeWSJTXDialog">
      <div class="connection-dialog" @click.stop>
        <h3>WSJT-X Settings</h3>
        <form @submit.prevent="saveWSJTXSettings">
          <div class="form-group">
            <label>
              <input v-model="wsjtxForm.enabled" type="checkbox" />
              Enable WSJT-X Integration
            </label>
          </div>
          <div class="form-group">
            <label for="wsjtx-port">UDP Port:</label>
            <input
              id="wsjtx-port"
              v-model.number="wsjtxForm.port"
              type="number"
              placeholder="2237"
              required
            />
          </div>
          <div class="form-group">
            <label>
              <input v-model="wsjtxForm.autoLog" type="checkbox" />
              Automatically log QSOs from WSJT-X
            </label>
          </div>
          <div class="form-group">
            <label>
              <input v-model="wsjtxForm.logOnlyConfirmed" type="checkbox" />
              Log only confirmed QSOs (not all decodes)
            </label>
          </div>
          <div class="dialog-buttons">
            <button type="button" @click="closeWSJTXDialog">Cancel</button>
            <button type="submit" class="connect-btn">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Take Back CAT Control Confirmation Dialog -->
    <div v-if="showTakeBackDialog" class="connection-dialog-overlay" @click="closeTakeBackDialog">
      <div class="connection-dialog" @click.stop>
        <h3>⚠️ CAT Control Warning</h3>
        <div class="warning-content">
          <p>
            Please make sure you've closed WSJT-X or you've disabled WSJT-X's built-in CAT control!
          </p>
          <p>Leaving it on would cause undesired side effects!</p>
        </div>
        <div class="dialog-buttons">
          <button type="button" @click="closeTakeBackDialog">Cancel</button>
          <button type="button" class="connect-btn" @click="confirmTakeBack">
            I understand, take back control
          </button>
        </div>
      </div>
    </div>

    <!-- Run as Administrator Dialog -->
    <div v-if="showAdminRetryDialog" class="connection-dialog-overlay" @click="closeAdminRetryDialog">
      <div class="connection-dialog" @click.stop>
        <h3>🔒 Connection Failed</h3>
        <div class="warning-content">
          <p>
            Unable to connect to rigctld even after configuring the firewall.
          </p>
          <p>
            Would you like to try running rigctld with administrator privileges?
          </p>
          <p class="admin-note">
            <strong>Note:</strong> This is a one-time action. On the next app launch, rigctld will
            start with normal privileges again.
          </p>
        </div>
        <div class="dialog-buttons">
          <button type="button" @click="closeAdminRetryDialog">Cancel</button>
          <button type="button" class="connect-btn" @click="handleRunAsAdmin">
            Run as Administrator
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Just a container to keep the content below the title */
.rig-control-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rig-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 0.3rem;
}

.rig-title {
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.port-badge {
  font-size: 0.8rem;
  background: #555;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  color: var(--gray-color);
}

.connection-status {
  font-size: 0.9rem;
  font-weight: bold;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  text-align: center;
}

.status-connected {
  background: #28a745;
  color: white;
}

.status-disconnected {
  background: #dc3545;
  color: white;
}

.status-connecting {
  background: #ffc107;
  color: black;
}

.status-wsjtx {
  background: #17a2b8;
  color: white;
}

.error-message {
  color: #dc3545;
  font-size: 0.8rem;
  background: rgba(220, 53, 69, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  border: 1px solid rgba(220, 53, 69, 0.3);
}

.suggestion-message {
  color: #ffc107;
  font-size: 0.75rem;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.firewall-action {
  margin-top: 0.35rem;
}

.firewall-btn {
  background: #ff9800;
  color: #1a1a1a;
  border: none;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.firewall-btn:hover:not(:disabled) {
  background: #ffb347;
}

.firewall-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  color: #4caf50;
  font-size: 0.7rem;
  margin-top: 0.25rem;
}

.warning-message {
  color: #ffc107;
  font-size: 0.7rem;
  margin-top: 0.25rem;
}

.diagnostics-link {
  margin-top: 0.3rem;
}

.diagnostics-btn {
  background: transparent;
  border: 1px solid #6c757d;
  padding: 0.15rem 0.4rem;
  color: #adb5bd;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.diagnostics-btn:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.diagnostics-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-external {
  background: #6f42c1;
  color: white;
}

.status-error {
  background: #dc3545;
  color: white;
}

.rig-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.handover-section {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
}

/* Connect (green) */
.connect-btn {
  background: #28a745;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.connect-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Reconnect (orange) */
.reconnect {
  background: orange;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.reconnect:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Disconnect (red) */
.stop-btn {
  background: #d83838;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.stop-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Settings (blue) */
.settings-btn {
  background: #007bff;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

/* WSJT-X buttons */
.handover-btn {
  background: #17a2b8;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.wsjtx-btn {
  background: #17a2b8;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.wsjtx-active-btn {
  background: #6f42c1;
  border: none;
  padding: 0.2rem 0.5rem;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.9rem;
}

.wsjtx-btn:disabled,
.wsjtx-active-btn:disabled,
.handover-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Connection Dialog */
.connection-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.connection-dialog {
  background: #2c2c2c;
  border: 1px solid #555;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 400px;
  max-width: 500px;
}

.connection-dialog h3 {
  color: white;
  margin: 0 0 1rem 0;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: white;
  margin-bottom: 0.3rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a1a;
  color: white;
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
}

.form-group label input[type='checkbox'] {
  width: auto;
  margin-right: 0.5rem;
}

.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a1a;
  color: white;
  font-size: 0.9rem;
}

.form-group select:disabled {
  background: #333;
  color: #999;
  cursor: not-allowed;
}

.loading-text {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.2rem;
  font-style: italic;
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.dialog-buttons button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.dialog-buttons button[type='button'] {
  background: #6c757d;
  color: white;
}

.dialog-buttons .connect-btn {
  background: #28a745;
  color: white;
}

.warning-content {
  color: #ffc107;
  margin: 1rem 0;
  line-height: 1.5;
}

.warning-content p {
  margin: 0.5rem 0;
}
</style>
