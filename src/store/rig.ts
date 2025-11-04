import { defineStore } from 'pinia';
import { rigctldService } from '../services/RigctldService';
import { RigCapabilities, RigState, RigctldConnection } from '../types/rig';
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

      try {
        rigctldService.setConnection(host, port, model, device);
        const response = await rigctldService.connect();

        if (response.success) {
          this.connection = rigctldService.getConnection();
          await this.loadCapabilities();
          await this.updateRigState();
          console.log('Successfully connected to rigctld');
        } else {
          this.error = response.error || 'Connection failed';
          console.error('Failed to connect to rigctld:', this.error);
        }

        return response;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error';
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

        // Get Signal Strength (S-meter)
        const strengthResponse = await rigctldService.getStrength();
        if (strengthResponse.success && strengthResponse.data) {
          // Store the raw Hamlib STRENGTH value (0-255)
          this.rigState.signalStrength = parseInt(strengthResponse.data[0]) || 0;
        }

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
