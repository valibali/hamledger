import { defineStore } from 'pinia';
import { rigctldService } from '../services/RigctldService';
import {
  RigCapabilities,
  RigState,
  RigctldConnection,
  ConnectionStatus,
  RigctldDiagnostics,
  RigctldRunningCheck,
  SmeterStatus,
} from '../types/rig';
import { getBandFromFrequency } from '../utils/bands';

export const useRigStore = defineStore('rig', {
  state: () => ({
    // Connection state
    connection: {
      host: 'localhost',
      port: 4532,
      connected: false,
      model: undefined,
      device: undefined,
    } as RigctldConnection,

    // Rig capabilities
    capabilities: null as RigCapabilities | null,

    // Current rig state
    rigState: {
      frequency: 7093000,
      mode: 'LSB',
      passband: 2400,
      vfo: 'VFOA',
      ptt: false,
      split: false,
      splitFreq: undefined,
      splitMode: undefined,
      rit: 0,
      xit: 0,
      signalStrength: undefined,
    } as RigState,

    // UI state
    modes: [
      { value: 'CW', label: 'CW' },
      { value: 'LSB', label: 'LSB' },
      { value: 'USB', label: 'USB' },
      { value: 'AM', label: 'AM' },
      { value: 'FM', label: 'FM' },
      { value: 'RTTY', label: 'RTTY' },
      { value: 'DATA', label: 'DATA' },
    ],

    // Status
    isLoading: false,
    error: null as string | null,
    lastUpdate: null as Date | null,

    // Polling
    pollingInterval: null as NodeJS.Timeout | null,

    // Connection diagnostics
    connectionStatus: 'disconnected' as ConnectionStatus,
    diagnostics: null as RigctldDiagnostics | null,
    lastDiagnosticsRun: null as Date | null,
    usingExternalRigctld: false,
    connectionSuggestions: [] as string[],

    // S-meter status tracking
    smeterStatus: {
      supported: null,
      lastError: null,
      lastSuccessfulRead: null,
      consecutiveErrors: 0,
    } as SmeterStatus,

    // S-meter polling interval (separate from main polling for faster updates)
    smeterPollingInterval: null as NodeJS.Timeout | null,
  }),

  getters: {
    isConnected: state => state.connection.connected,
    currentFrequency: state => {
      const freqMHz = state.rigState.frequency / 1000000;
      // Format to 6 decimal places for Hz precision
      return freqMHz.toFixed(6);
    },
    currentFrequencyParts: state => {
      const freqMHz = state.rigState.frequency / 1000000;
      const fullFreq = freqMHz.toFixed(6);
      const parts = fullFreq.split('.');
      const wholePart = parts[0];
      const decimalPart = parts[1];
      
      // Split decimal part: first 3 digits (kHz) and last 3 digits (Hz)
      const kHzPart = decimalPart.substring(0, 3);
      const hzPart = decimalPart.substring(3, 6);
      
      return {
        main: `${wholePart}.${kHzPart}`, // MHz.kHz part
        hz: hzPart // Hz part
      };
    },
    currentMode: state => state.rigState.mode,
    currentVfo: state => state.rigState.vfo,
    currentBand: state => {
      const band = getBandFromFrequency(state.rigState.frequency);
      return band ? band.shortName : null;
    },
    currentBandName: state => {
      const band = getBandFromFrequency(state.rigState.frequency);
      return band ? band.name : 'Unknown';
    },
    splitFrequency: state => {
      if (!state.rigState.splitFreq) return undefined;
      const freqMHz = state.rigState.splitFreq / 1000000;
      // Format to 6 decimal places for Hz precision
      return freqMHz.toFixed(6);
    },
    splitFrequencyParts: state => {
      if (!state.rigState.splitFreq) return undefined;
      const freqMHz = state.rigState.splitFreq / 1000000;
      const fullFreq = freqMHz.toFixed(6);
      const parts = fullFreq.split('.');
      const wholePart = parts[0];
      const decimalPart = parts[1];
      
      // Split decimal part: first 3 digits (kHz) and last 3 digits (Hz)
      const kHzPart = decimalPart.substring(0, 3);
      const hzPart = decimalPart.substring(3, 6);
      
      return {
        main: `${wholePart}.${kHzPart}`, // MHz.kHz part
        hz: hzPart // Hz part
      };
    },
    rigModel: state => state.capabilities?.modelName || 'Unknown',
    selectedMode: state => state.rigState.mode,
    
    // Diagnostics getters
    hasError: state => state.connectionStatus === 'error',
    isExternal: state => state.usingExternalRigctld,
    hasDiagnostics: state => state.diagnostics !== null,
    diagnosticsAge: state => {
      if (!state.lastDiagnosticsRun) return null;
      return Date.now() - state.lastDiagnosticsRun.getTime();
    },
    
    // S-meter getters
    isSmeterSupported: state => state.smeterStatus.supported === true,
    isSmeterUnsupported: state => state.smeterStatus.supported === false,
    smeterHasError: state => state.smeterStatus.consecutiveErrors > 0,
    smeterStatusText: state => {
      if (state.smeterStatus.supported === null) return 'Checking...';
      if (state.smeterStatus.supported === false) return 'Not supported';
      if (state.smeterStatus.consecutiveErrors > 3) return 'Error';
      return 'OK';
    },
  },

  actions: {
    // Connection management
    async connect(
      host: string = 'localhost',
      port: number = 4532,
      model?: number,
      device?: string
    ) {
      this.isLoading = true;
      this.error = null;
      this.connectionStatus = 'connecting';
      this.connectionSuggestions = [];

      try {
        rigctldService.setConnection(host, port, model, device);
        const response = await rigctldService.connect();

        if (response.success) {
          this.connection = rigctldService.getConnection();
          this.connectionStatus = 'connected';
          
          // Check if we're connected to an external rigctld
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = response.data as any;
          this.usingExternalRigctld = data?.isExternal || false;
          
          if (this.usingExternalRigctld) {
            console.log('Connected to external rigctld instance');
          }
          
          await this.loadCapabilities();
          await this.updateRigState();
          console.log('Successfully connected to rigctld');
        } else {
          this.error = response.error || 'Connection failed';
          this.connectionStatus = 'error';
          
          // Store suggestions from the response
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const suggestions = (response as any).suggestions;
          if (suggestions && Array.isArray(suggestions)) {
            this.connectionSuggestions = suggestions;
          }
          
          console.error('Failed to connect to rigctld:', this.error);
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        this.connectionStatus = 'error';
        console.error('Connection error:', error);
        return { success: false, error: this.error };
      } finally {
        this.isLoading = false;
      }
    },

    async disconnect() {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await rigctldService.disconnect();

        if (response.success) {
          this.connection.connected = false;
          this.capabilities = null;
          this.connectionStatus = 'disconnected';
          this.usingExternalRigctld = false;
          this.connectionSuggestions = [];
          console.log('Disconnected from rigctld');
        } else {
          this.error = response.error || 'Disconnect failed';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('Disconnect error:', error);
        return { success: false, error: this.error };
      } finally {
        this.isLoading = false;
      }
    },

    async handleReconnect() {
      console.log('Reconnecting to rigctld...');
      await this.disconnect();
      await this.connect(
        this.connection.host,
        this.connection.port,
        this.connection.model,
        this.connection.device
      );
    },

    async handleDisconnect() {
      console.log('Disconnecting from rigctld...');
      await this.disconnect();
    },

    // Start rigctld with elevated (admin) privileges - one-time only
    async startRigctldElevated() {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await window.electronAPI.rigctldStartElevated();

        if (response.success) {
          console.log('Rigctld started with elevated privileges');
          // Wait a moment for rigctld to start, then try to connect
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Try to connect to the elevated rigctld
          return await this.connect(
            this.connection.host,
            this.connection.port,
            this.connection.model,
            this.connection.device
          );
        } else if (response.userCancelled) {
          this.error = 'User cancelled elevated start';
          console.log('User cancelled elevated rigctld start');
          return { success: false, error: this.error, userCancelled: true };
        } else {
          this.error = response.error || 'Failed to start elevated rigctld';
          console.error('Failed to start elevated rigctld:', this.error);
          return { success: false, error: this.error };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error starting elevated rigctld:', error);
        return { success: false, error: this.error };
      } finally {
        this.isLoading = false;
      }
    },

    // Capabilities
    async loadCapabilities() {
      try {
        const response = await rigctldService.getCapabilities();

        if (response.success && response.data) {
          this.capabilities = this.parseCapabilities(response.data);
          console.log('Loaded rig capabilities:', this.capabilities);
        } else {
          console.warn('Failed to load capabilities:', response.error);
        }
      } catch (error) {
        console.error('Error loading capabilities:', error);
      }
    },

    parseCapabilities(capData: string[]): RigCapabilities {
      const caps: Partial<RigCapabilities> = {
        modes: [],
        vfos: [],
        functions: [],
        levels: [],
        txRanges: [],
        rxRanges: [],
        tuningSteps: [],
        filters: [],
      };

      for (const line of capData) {
        if (line.startsWith('Model name:')) {
          caps.modelName = line.split('\t')[1];
        } else if (line.startsWith('Mfg name:')) {
          caps.mfgName = line.split('\t')[1];
        } else if (line.startsWith('Backend version:')) {
          caps.backendVersion = line.split('\t')[1];
        } else if (line.startsWith('Rig type:')) {
          caps.rigType = line.split('\t')[1];
        } else if (line.startsWith('PTT type:')) {
          caps.pttType = line.split('\t')[1];
        } else if (line.startsWith('DCD type:')) {
          caps.dcdType = line.split('\t')[1];
        } else if (line.startsWith('Port type:')) {
          caps.portType = line.split('\t')[1];
        } else if (line.startsWith('Serial speed:')) {
          caps.serialSpeed = line.split('\t')[1];
        } else if (line.startsWith('Mode list:')) {
          caps.modes = line
            .split('\t')[1]
            .split(' ')
            .filter(m => m.length > 0);
        } else if (line.startsWith('VFO list:')) {
          caps.vfos = line
            .split('\t')[1]
            .split(' ')
            .filter(v => v.length > 0);
        } else if (line.startsWith('Get functions:')) {
          caps.functions = line
            .split('\t')[1]
            .split(' ')
            .filter(f => f.length > 0);
        } else if (line.startsWith('Get level:')) {
          caps.levels = line
            .split('\t')[1]
            .split(' ')
            .filter(l => l.length > 0);
        }
      }

      return caps as RigCapabilities;
    },

    // Rig state management
    async updateRigState() {
      if (!this.connection.connected) return;

      try {
        // Get frequency
        const freqResponse = await rigctldService.getFrequency();
        if (freqResponse.success && freqResponse.data) {
          this.rigState.frequency = parseInt(freqResponse.data[0]);
        }

        // Get mode
        const modeResponse = await rigctldService.getMode();
        if (modeResponse.success && modeResponse.data) {
          this.rigState.mode = modeResponse.data[0];
          this.rigState.passband = parseInt(modeResponse.data[1]) || 0;
        }

        // Get VFO
        const vfoResponse = await rigctldService.getVfo();
        if (vfoResponse.success && vfoResponse.data) {
          this.rigState.vfo = vfoResponse.data[0];
        }

        // Get PTT
        const pttResponse = await rigctldService.getPtt();
        if (pttResponse.success && pttResponse.data) {
          this.rigState.ptt = pttResponse.data[0] === '1';
        }

        // Get Split
        const splitResponse = await rigctldService.getSplit();
        if (splitResponse.success && splitResponse.data) {
          this.rigState.split = splitResponse.data[0] === '1';

          if (this.rigState.split) {
            const splitFreqResponse = await rigctldService.getSplitFrequency();
            if (splitFreqResponse.success && splitFreqResponse.data) {
              this.rigState.splitFreq = parseInt(splitFreqResponse.data[0]);
            }
          }
        }

        // Get RIT
        const ritResponse = await rigctldService.getRit();
        if (ritResponse.success && ritResponse.data) {
          this.rigState.rit = parseInt(ritResponse.data[0]) || 0;
        }

        // Get XIT
        const xitResponse = await rigctldService.getXit();
        if (xitResponse.success && xitResponse.data) {
          this.rigState.xit = parseInt(xitResponse.data[0]) || 0;
        }

        // Get Signal Strength (S-meter) - only if supported
        await this.updateSmeter();

        this.lastUpdate = new Date();
      } catch (error) {
        console.error('Error updating rig state:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
      }
    },

    // Frequency control
    async setFrequency(frequency: number) {
      // Optimistically update the local state
      this.rigState.frequency = frequency;

      if (!this.connection.connected) {
        console.log('Not connected, only updating local state');
        return { success: true };
      }

      try {
        const response = await rigctldService.setFrequency(frequency);

        if (!response.success) {
          this.error = response.error || 'Failed to set frequency';
          // Optional: revert the change if the call fails
          // await this.updateRigState();
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        // Optional: revert the change on error
        // await this.updateRigState();
        return { success: false, error: this.error };
      }
    },

    // Mode control
    async setMode(mode: string, passband: number = 0) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setMode(mode, passband);

        if (response.success) {
          this.rigState.mode = mode;
          this.rigState.passband = passband;
        } else {
          this.error = response.error || 'Failed to set mode';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // Split control
    async toggleSplit() {
      try {
        const newSplitState = !this.rigState.split;
        console.log('Toggling split from', this.rigState.split, 'to', newSplitState);

        // Always update local state
        this.rigState.split = newSplitState;
        console.log('Split state updated to:', this.rigState.split);

        if (!newSplitState) {
          this.rigState.splitFreq = undefined;
          this.rigState.splitMode = undefined;
        }

        // Try to update rig if connected
        if (this.connection.connected) {
          const response = await rigctldService.setSplit(newSplitState);
          console.log('setSplit response:', response);

          if (!response.success) {
            this.error = response.error || 'Failed to toggle split';
            console.error('Failed to toggle split:', this.error);
          }

          return response;
        } else {
          console.log('Not connected to rig, only updating local state');
          return { success: true };
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error toggling split:', error);
        return { success: false, error: this.error };
      }
    },

    async setSplitFrequency(frequency: number) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setSplitFrequency(frequency);

        if (response.success) {
          this.rigState.splitFreq = frequency;
        } else {
          this.error = response.error || 'Failed to set split frequency';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // PTT control
    async setPtt(ptt: boolean) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setPtt(ptt);

        if (response.success) {
          this.rigState.ptt = ptt;
        } else {
          this.error = response.error || 'Failed to set PTT';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // VFO control
    async setVfo(vfo: string) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setVfo(vfo);

        if (response.success) {
          this.rigState.vfo = vfo;
        } else {
          this.error = response.error || 'Failed to set VFO';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // RIT/XIT control
    async setRit(rit: number) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setRit(rit);

        if (response.success) {
          this.rigState.rit = rit;
        } else {
          this.error = response.error || 'Failed to set RIT';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    async setXit(xit: number) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        const response = await rigctldService.setXit(xit);

        if (response.success) {
          this.rigState.xit = xit;
        } else {
          this.error = response.error || 'Failed to set XIT';
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // S-meter update with capability check and debug logging
    async updateSmeter() {
      if (!this.connection.connected) return;

      // Check if we've already determined S-meter is not supported
      if (this.smeterStatus.supported === false) {
        console.log('[S-meter] Skipping - not supported by this rig');
        return;
      }

      // Check capability if not yet determined
      if (this.smeterStatus.supported === null) {
        const hasStrength = this.capabilities?.levels?.includes('STRENGTH');
        console.log('[S-meter] Capability check - STRENGTH in levels:', hasStrength);
        console.log('[S-meter] Available levels:', this.capabilities?.levels);
        
        if (!hasStrength) {
          this.smeterStatus.supported = false;
          this.smeterStatus.lastError = 'STRENGTH level not supported by this rig';
          console.warn('[S-meter] Not supported - STRENGTH not in capability list');
          return;
        }
        
        this.smeterStatus.supported = true;
        console.log('[S-meter] Capability confirmed - STRENGTH is supported');
      }

      try {
        console.log('[S-meter] Polling signal strength...');
        const strengthResponse = await rigctldService.getStrength();
        console.log('[S-meter] Response:', strengthResponse);

        if (strengthResponse.success && strengthResponse.data) {
          const rawValue = strengthResponse.data[0];
          const parsedValue = parseInt(rawValue) || 0;
          console.log('[S-meter] Raw value:', rawValue, '-> Parsed:', parsedValue);
          
          this.rigState.signalStrength = parsedValue;
          this.smeterStatus.lastSuccessfulRead = new Date();
          this.smeterStatus.consecutiveErrors = 0;
          this.smeterStatus.lastError = null;
        } else {
          const errorMsg = strengthResponse.error || 'Unknown error';
          console.warn('[S-meter] Failed to read:', errorMsg);
          this.smeterStatus.consecutiveErrors++;
          this.smeterStatus.lastError = errorMsg;
          
          // After multiple consecutive errors, mark as potentially unsupported
          if (this.smeterStatus.consecutiveErrors >= 5) {
            console.warn('[S-meter] Too many errors, may not be properly supported');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[S-meter] Exception:', errorMsg);
        this.smeterStatus.consecutiveErrors++;
        this.smeterStatus.lastError = errorMsg;
      }
    },

    // Custom command
    async sendCommand(command: string) {
      if (!this.connection.connected) return { success: false, error: 'Not connected' };

      try {
        return await rigctldService.sendCommand(command);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: this.error };
      }
    },

    // Diagnostics
    async runDiagnostics(): Promise<RigctldDiagnostics | null> {
      this.connectionStatus = 'checking';

      try {
        const response = await window.electronAPI.rigctldDiagnostics();

        if (response.success && response.data) {
          this.diagnostics = response.data;
          this.lastDiagnosticsRun = new Date();
          this.connectionSuggestions = response.data.suggestions || [];

          // Update connectionStatus based on diagnostics
          if (response.data.tcpConnectable && response.data.processRunning) {
            this.connectionStatus = this.connection.connected ? 'connected' : 'disconnected';
          } else {
            this.connectionStatus = 'error';
          }

          return response.data;
        } else {
          console.error('Failed to run diagnostics:', response.error);
          this.connectionStatus = this.connection.connected ? 'connected' : 'error';
          return null;
        }
      } catch (error) {
        console.error('Error running diagnostics:', error);
        this.connectionStatus = this.connection.connected ? 'connected' : 'error';
        return null;
      }
    },

    async checkIfRunning(): Promise<RigctldRunningCheck | null> {
      try {
        const response = await window.electronAPI.rigctldCheckRunning();

        if (response.success && response.data) {
          this.usingExternalRigctld = response.data.external;
          return response.data;
        } else {
          console.error('Failed to check rigctld running status:', response.error);
          return null;
        }
      } catch (error) {
        console.error('Error checking rigctld running status:', error);
        return null;
      }
    },

    // Clear diagnostics
    clearDiagnostics() {
      this.diagnostics = null;
      this.lastDiagnosticsRun = null;
      this.connectionSuggestions = [];
    },

    startPolling(intervalMs: number = 1000) {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }

      this.pollingInterval = setInterval(() => {
        if (this.connection.connected && !this.isLoading) {
          this.updateRigState();
        }
      }, intervalMs);
    },

    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    },

    // Separate S-meter polling with faster interval from settings
    startSmeterPolling(intervalMs: number = 250) {
      if (this.smeterPollingInterval) {
        clearInterval(this.smeterPollingInterval);
      }

      console.log(`[S-meter] Starting dedicated polling at ${intervalMs}ms interval`);

      this.smeterPollingInterval = setInterval(() => {
        if (this.connection.connected && !this.isLoading && this.smeterStatus.supported !== false) {
          this.updateSmeter();
        }
      }, intervalMs);
    },

    stopSmeterPolling() {
      if (this.smeterPollingInterval) {
        clearInterval(this.smeterPollingInterval);
        this.smeterPollingInterval = null;
        console.log('[S-meter] Stopped dedicated polling');
      }
    },

    // Start all polling (main + S-meter)
    startAllPolling(mainIntervalMs: number = 1000, smeterIntervalMs: number = 250) {
      this.startPolling(mainIntervalMs);
      this.startSmeterPolling(smeterIntervalMs);
    },

    // Stop all polling
    stopAllPolling() {
      this.stopPolling();
      this.stopSmeterPolling();
    },

    // Reset S-meter status (for reconnection)
    resetSmeterStatus() {
      this.smeterStatus = {
        supported: null,
        lastError: null,
        lastSuccessfulRead: null,
        consecutiveErrors: 0,
      };
      this.rigState.signalStrength = undefined;
      console.log('[S-meter] Status reset');
    },

    // Legacy methods for backward compatibility
    setFrequencyFromString(freq: string) {
      const frequency = parseFloat(freq) * 1000000; // Convert MHz to Hz
      return this.setFrequency(frequency);
    },

    setTxFrequency(freq: string) {
      const frequency = parseFloat(freq) * 1000000; // Convert MHz to Hz
      return this.setSplitFrequency(frequency);
    },
  },
});
