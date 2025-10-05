import { defineStore } from 'pinia';
import { useRigStore } from './rig';
import { formatAdif } from '../utils/adif';
import { StationData, BaseStationData, GeoData } from '../types/station';
import { qrzService } from '../services/QRZService';
import { CallsignHelper } from '../utils/callsign';
import { geocodeLocation } from '../utils/geocoding';
import { QsoEntry } from '../types/qso';
import { MaidenheadLocator } from '../utils/maidenhead';
import { configHelper } from '../utils/configHelper';
import { calculateDistance } from '../utils/distance';
import { getBandFromFrequency } from '../utils/bands';
import { WSJTXDecodeMessage } from '../types/wsjtx';
import * as countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import '../types/electron';
countries.registerLocale(en);

export const useQsoStore = defineStore('qso', {
  state: () => ({
    currentSession: [] as QsoEntry[],
    allQsos: [] as QsoEntry[],
    currentUTCTime: '',
    initialized: false,
    isLoading: false,
    wsjtxEnabled: false,
    wsjtxRunning: false,
    wsjtxDecodes: [] as WSJTXDecodeMessage[],
    stationInfo: {
      baseData: {} as BaseStationData,
      geodata: {} as GeoData,
      flag: '',
      weather: '',
      localTime: '',
      greetings: [],
      distance: undefined as number | undefined,
      portableSuffix: null as string | null,
      qrzError: false,
    } satisfies StationData,
    qsoForm: {
      callsign: '',
      band: '',
      mode: 'SSB',
      rstr: '59',
      rstt: '59',
      date: '',
      utc: '',
      remark: '',
      notes: '',
    },
  }),
  actions: {
    async init() {
      if (!this.initialized) {
        this.isLoading = true;
        try {
          await this.initializeStore();
          await this.initializeWSJTX();
        } finally {
          this.isLoading = false;
        }
      }
    },
    async addQso() {
      const now = new Date();
      const rigStore = useRigStore();

      // Calculate band from current rig frequency
      const band = getBandFromFrequency(rigStore.rigState.frequency);
      const bandName = band ? band.name : 'Unknown';

      const newQso: QsoEntry = {
        callsign: this.qsoForm.callsign.toUpperCase(),
        band: bandName,
        freqRx: rigStore.rigState.frequency / 1000000, // Convert Hz to MHz
        mode: rigStore.rigState.mode,
        datetime: now.toISOString(),
      };

      // Handle TX frequency
      newQso.freqTx = rigStore.rigState.split ? rigStore.rigState.splitFreq! / 1000000 : '--';

      // Use form values or defaults for RST
      newQso.rstr = this.qsoForm.rstr || '59';
      newQso.rstt = this.qsoForm.rstt || '59';
      newQso.remark = this.qsoForm.remark?.trim() || '--';
      newQso.notes = this.qsoForm.notes?.trim() || '--';

      // Send to main process to save
      try {
        const response = await window.electronAPI.addQso({
          ...newQso,
          _id: new Date().toISOString(),
        });

        if (response.ok) {
          this.currentSession.push(newQso);
          this.allQsos.push(newQso);
        }
      } catch (error) {
        console.error('Failed to save QSO:', error);
      }

      // Reset form but keep current band from rig
      const currentBand = rigStore.currentBandName || '';

      this.qsoForm = {
        callsign: '',
        band: currentBand,
        mode: rigStore.rigState.mode,
        rstr: '59',
        rstt: '59',
        date: '',
        utc: '',
        remark: '',
        notes: '',
      };
    },
    updateQsoForm(field: keyof typeof this.qsoForm, value: string) {
      this.qsoForm[field] = value;
    },
    async initializeStore() {
      try {
        this.isLoading = true;

        // Use setTimeout to allow UI to update before starting heavy work
        await new Promise(resolve => setTimeout(resolve, 10));

        const result = await window.electronAPI.getAllDocs();
        console.debug('Raw database result:', result);

        // Process QSOs in chunks to avoid blocking UI
        const qsos = result.rows.map(row => {
          const qso = row.doc as QsoEntry;
          // Ensure _id and _rev are properly set
          qso._id = qso._id || row.id;
          qso._rev = qso._rev || (row.value && row.value.rev);
          return qso;
        });

        // Process in chunks of 1000 to avoid blocking
        const chunkSize = 1000;
        this.allQsos = [];

        for (let i = 0; i < qsos.length; i += chunkSize) {
          const chunk = qsos.slice(i, i + chunkSize);
          this.allQsos.push(...chunk);

          // Allow UI to update between chunks
          if (i + chunkSize < qsos.length) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }

        this.initialized = true;
      } catch (error) {
        console.error('Failed to initialize QSO store:', error);
        this.initialized = true; // Set to true even on error to stop loading
      } finally {
        this.isLoading = false;
      }
    },

    async updateQso(updatedQso: QsoEntry) {
      try {
        console.log('Store updateQso called with:', updatedQso);
        console.log('QSO keys:', Object.keys(updatedQso));

        const qsoId = updatedQso._id;
        const qsoRev = updatedQso._rev;

        if (!qsoId) {
          console.error('QSO object:', updatedQso);
          throw new Error('QSO _id is required for update');
        }

        // Ensure the QSO has the correct _id format
        const qsoToUpdate = {
          ...updatedQso,
          _id: qsoId,
          _rev: qsoRev,
        };

        const response = await window.electronAPI.updateQso(qsoToUpdate);
        console.log('Update response:', response);

        if (response.ok) {
          // Update the _rev with the new revision from the response
          const updatedQsoWithNewRev = { ...qsoToUpdate, _rev: response.rev };

          // Update in current session if present
          const sessionIndex = this.currentSession.findIndex(qso => (qso._id || qso.id) === qsoId);
          if (sessionIndex !== -1) {
            this.currentSession[sessionIndex] = updatedQsoWithNewRev;
          }

          // Update in all QSOs
          const allIndex = this.allQsos.findIndex(qso => (qso._id || qso.id) === qsoId);
          if (allIndex !== -1) {
            this.allQsos[allIndex] = updatedQsoWithNewRev;
          }

          // Refresh the store to ensure we have the latest data
          this.isLoading = true;
          try {
            await this.initializeStore();
          } finally {
            this.isLoading = false;
          }
        } else {
          throw new Error(`Update failed: ${response.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Failed to update QSO:', error);
        throw error;
      }
    },

    async importAdif() {
      try {
        const result = await window.electronAPI.importAdif();
        if (result.imported) {
          this.isLoading = true;
          try {
            await this.initializeStore();
          } finally {
            this.isLoading = false;
          }
          return { success: true, count: result.count };
        }
        return { success: false, error: result.error };
      } catch (error) {
        console.error('Failed to import ADIF:', error);
        return { success: false, error };
      }
    },

    async exportAdif(qsos: QsoEntry[]): Promise<{ success: boolean; error?: string }> {
      try {
        const adifContent = formatAdif(qsos);
        const result = await window.electronAPI.saveAdifFile(adifContent);
        
        if (result.success) {
          return { success: true };
        } else {
          return { success: false, error: result.error || 'Export failed' };
        }
      } catch (error) {
        console.error('Failed to export ADIF:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },

    async deleteQso(qsoId: string): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await window.electronAPI.deleteQso(qsoId);
        
        if (response.ok) {
          // Remove from current session if present
          const sessionIndex = this.currentSession.findIndex(qso => (qso._id || qso.id) === qsoId);
          if (sessionIndex !== -1) {
            this.currentSession.splice(sessionIndex, 1);
          }

          // Remove from all QSOs
          const allIndex = this.allQsos.findIndex(qso => (qso._id || qso.id) === qsoId);
          if (allIndex !== -1) {
            this.allQsos.splice(allIndex, 1);
          }

          return { success: true };
        } else {
          return { success: false, error: (response.error as string) || 'Delete failed' };
        }
      } catch (error) {
        console.error('Failed to delete QSO:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },

    updateCurrentUTCTime() {
      const now = new Date();
      this.currentUTCTime = now.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },
    async fetchStationInfo(callsign: string): Promise<void | Error> {
      try {
        // Reset station info first to avoid showing stale data
        this.stationInfo = {
          baseData: {
            call: callsign,
            name: '',
            country: '',
            lat: undefined,
            lon: undefined,
            grid: '',
            qth: '',
          },
          geodata: {},
          flag: '',
          weather: '',
          localTime: '',
          greetings: [],
          distance: undefined,
          portableSuffix: null,
          qrzError: false,
        };

        // Get country information from callsign
        const countryCode = CallsignHelper.getCountryCodeForCallsign(callsign);
        const countryName = countries.getName(countryCode.toUpperCase(), 'en') || 'Unknown';

        // Set country and flag (handling portable prefixes)
        this.stationInfo.baseData.country = countryName;
        this.stationInfo.flag = await CallsignHelper.getFlagUrl(callsign);

        // Check for portable suffix to determine if we should show distance or suffix meaning
        const portableSuffix = CallsignHelper.getPortableSuffix(callsign);
        this.stationInfo.portableSuffix = portableSuffix;

        // Try to get additional info from QRZ
        // Reset QRZ error state at the beginning of each lookup
        this.stationInfo.qrzError = false;

        // First try with the full callsign (including portable prefixes/suffixes)
        let qrzData = await qrzService.lookupStationByCallsign(callsign);

        // If not found, try with base callsign (remove portable prefixes and suffixes)
        if (qrzData instanceof Error) {
          const baseCallsign = CallsignHelper.extractBaseCallsign(callsign);
          if (baseCallsign !== callsign) {
            qrzData = await qrzService.lookupStationByCallsign(baseCallsign);
          }
        }

        if (qrzData instanceof Error) {
          this.stationInfo.qrzError = true;
          console.error('QRZ lookup failed:', qrzData);
        } else {
          // Explicitly set qrzError to false on successful lookup
          this.stationInfo.qrzError = false;
          this.stationInfo.baseData.name = qrzData.name;
          this.stationInfo.baseData.grid = qrzData.grid;
          this.stationInfo.baseData.qth = qrzData.qth;
        }

        // Try to get coordinates in order of preference:
        // 1. From grid square if available
        if (this.stationInfo.baseData.grid) {
          try {
            const coords = MaidenheadLocator.gridToLatLon(this.stationInfo.baseData.grid);
            this.stationInfo.geodata = {
              lat: coords.lat,
              lon: coords.lon,
              display_name: this.stationInfo.baseData.qth || '',
            };
          } catch (error) {
            console.error('Error converting grid to coordinates:', error);
          }
        }

        // 2. From QTH if available and grid failed
        if (!this.stationInfo.geodata.lat && this.stationInfo.baseData.qth) {
          const geoData = await geocodeLocation(this.stationInfo.baseData.qth);
          if (geoData) {
            this.stationInfo.geodata = {
              lat: geoData.lat,
              lon: geoData.lon,
              display_name: geoData.display_name,
            };
          }
        }

        // Calculate distance if we have remote coordinates and local grid
        if (
          this.stationInfo.geodata.lat !== undefined &&
          this.stationInfo.geodata.lon !== undefined
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const localGrid = configHelper.getSetting(['station'], 'grid') as any;
          if (localGrid) {
            try {
              const localCoords = MaidenheadLocator.gridToLatLon(localGrid);
              this.stationInfo.distance = calculateDistance(
                localCoords.lat,
                localCoords.lon,
                this.stationInfo.geodata.lat,
                this.stationInfo.geodata.lon
              );
            } catch (error) {
              console.error('Error calculating distance:', error);
            }
          }
        }

        // Get weather if we have coordinates
        if (
          this.stationInfo.geodata.lat !== undefined &&
          this.stationInfo.geodata.lon !== undefined
        ) {
          try {
            const response = await window.electronAPI.fetchWeather(
              this.stationInfo.geodata.lat,
              this.stationInfo.geodata.lon
            );
            if (response.success && response.data?.current_weather) {
              const { temperature, weathercode } = response.data.current_weather;

              // Use the weather description mapping
              const WMO_CODES: { [key: number]: string } = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Foggy',
                48: 'Depositing rime fog',
                51: 'Light drizzle',
                53: 'Moderate drizzle',
                55: 'Dense drizzle',
                61: 'Slight rain',
                63: 'Moderate rain',
                65: 'Heavy rain',
                71: 'Slight snow',
                73: 'Moderate snow',
                75: 'Heavy snow',
                77: 'Snow grains',
                80: 'Slight rain showers',
                81: 'Moderate rain showers',
                82: 'Violent rain showers',
                95: 'Thunderstorm',
              };

              const description = WMO_CODES[weathercode] || 'Unknown';
              this.stationInfo.weather = `${Math.round(temperature)}°C, ${description}`;
            }
          } catch (error) {
            console.error('Weather fetch error:', error);
          }
        }

        // Set local time based on coordinates
        if (this.stationInfo.geodata.lon !== undefined) {
          const timeZoneOffset = Math.round(this.stationInfo.geodata.lon / 15);
          const localTime = new Date();
          localTime.setHours(localTime.getUTCHours() + timeZoneOffset);
          this.stationInfo.localTime = localTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      } catch (error) {
        console.error('Error fetching station info:', error);
        return error;
      }
    },

    // WSJT-X related actions
    async initializeWSJTX() {
      try {
        // Check WSJT-X status
        const status = await window.electronAPI.wsjtxStatus();
        if (status.success) {
          this.wsjtxEnabled = status.data?.enabled || false;
          this.wsjtxRunning = status.data?.running || false;
        }

        // Set up event listeners
        window.electronAPI.onWSJTXDecode((decode: WSJTXDecodeMessage) => {
          this.wsjtxDecodes.unshift(decode);
          // Keep only last 100 decodes
          if (this.wsjtxDecodes.length > 100) {
            this.wsjtxDecodes = this.wsjtxDecodes.slice(0, 100);
          }
        });

        window.electronAPI.onWSJTXQSOLogged((qso: QsoEntry) => {
          console.log('Received WSJT-X QSO in store:', qso);
          // Add to current session and all QSOs
          this.currentSession.unshift(qso); // Add to beginning for newest first
          this.allQsos.unshift(qso);
          console.log('WSJT-X QSO auto-logged to store:', qso.callsign);
          console.log('Current session count:', this.currentSession.length);
        });
      } catch (error) {
        console.error('Error initializing WSJT-X:', error);
      }
    },

    async startWSJTX(port: number = 2237) {
      try {
        const result = await window.electronAPI.wsjtxStart(port);
        if (result.success) {
          this.wsjtxRunning = true;
          this.wsjtxEnabled = true;
        }
        return result;
      } catch (error) {
        console.error('Error starting WSJT-X service:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },

    async stopWSJTX() {
      try {
        const result = await window.electronAPI.wsjtxStop();
        if (result.success) {
          this.wsjtxRunning = false;
        }
        return result;
      } catch (error) {
        console.error('Error stopping WSJT-X service:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },

    clearWSJTXDecodes() {
      this.wsjtxDecodes = [];
    },
  },
  getters: {
    sessionCount: state => state.currentSession.length,
    totalCount: state => state.allQsos.length,
    isCallsignValid: state => {
      return state.qsoForm.callsign ? CallsignHelper.isValidCallsign(state.qsoForm.callsign) : true;
    },
    recentWSJTXDecodes: state => state.wsjtxDecodes.slice(0, 20),
    wsjtxStatus: state => ({
      enabled: state.wsjtxEnabled,
      running: state.wsjtxRunning,
    }),
  },
});
