import { defineStore } from 'pinia';
import type {
  DxClusterFilters,
  DxSpot,
  FrequencyRange,
  FilterArrayKey,
  DxSpotApiResponse,
} from '../types/dxCluster';
import { getBandFrequencyRange, getAllBandNames } from '../utils/bands';

interface DxClusterState {
  spots: DxSpot[];
  loading: boolean;
  error: string | null;
  lastFetchTime: Date | null;
  filters: DxClusterFilters;
}

export const useDxClusterStore = defineStore('dxCluster', {
  state: (): DxClusterState => ({
    spots: [],
    loading: false,
    error: null,
    lastFetchTime: null,
    filters: {
      selectedCdx: ['EU', 'NA', 'SA', 'AS', 'AF', 'OC', 'AN'],
      selectedCde: ['EU', 'NA', 'SA', 'AS', 'AF', 'OC', 'AN'],
      selectedBand: '40',
      selectedModes: ['PHONE'],
      validatedOnly: true,
      pageLength: 65,
    },
  }),

  getters: {
    actualFrequencyRange(): FrequencyRange {
      if (this.spots.length === 0) {
        // Fallback to band ranges if no spots
        const bandRange = getBandFrequencyRange(this.filters.selectedBand);
        return bandRange || { min: 14000, max: 14350 }; // Default to 20m
      }

      const frequencies: number[] = this.spots.map((spot: DxSpot) => parseFloat(spot.Frequency));
      const minFreq: number = Math.min(...frequencies);
      const maxFreq: number = Math.max(...frequencies);

      // Add 5% padding on both sides
      const padding: number = (maxFreq - minFreq) * 0.05;

      return {
        min: Math.max(minFreq - padding, 0),
        max: maxFreq + padding,
      };
    },

    availableBands(): string[] {
      return getAllBandNames();
    },
  },

  actions: {
    async fetchSpots(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const params: URLSearchParams = new URLSearchParams();
        params.append('a', this.filters.pageLength.toString());
        
        // Map band to API parameter
        let bandParam = this.filters.selectedBand.replace('m', '');
        if (this.filters.selectedBand === '2m') {
          bandParam = 'VHF';
        } else if (this.filters.selectedBand === '70cm' || this.filters.selectedBand === '33cm' || this.filters.selectedBand === '23cm') {
          bandParam = 'UHF';
        } else {
          // Check if it's an SHF band (above 1 GHz)
          const bandRange = getBandFrequencyRange(this.filters.selectedBand);
          if (bandRange && bandRange.min >= 1000000) { // 1 GHz in kHz
            bandParam = 'SHF';
          }
        }
        
        params.append('b', bandParam);

        this.filters.selectedCdx.forEach((cdx: string) => params.append('cdx', cdx));
        this.filters.selectedCde.forEach((cde: string) => params.append('cde', cde));
        this.filters.selectedModes.forEach((mode: string) => params.append('m', mode));

        if (this.filters.validatedOnly) {
          params.append('valid', '1');
        }
        
        // Ensure spam filtering is enabled
        params.append('spam', '0');

        console.log('DX Cluster request URL params:', params.toString());
        console.log('Full URL would be: https://dxheat.com/source/spots/?' + params.toString());
        console.log('Band mapping:', this.filters.selectedBand, '->', bandParam);

        const result = await window.electronAPI.fetchDxSpots(params.toString());

        if (!result.success || !result.data) {
          throw new Error(result.error || 'API hívás sikertelen');
        }

        // Process and deduplicate spots
        const processedSpots: DxSpot[] = [];
        const spotIndex: Record<string, number> = {};

        result.data.forEach((rawSpot) => {
          const spot: DxSpot = {
            Nr: rawSpot.Nr || 0,
            Spotter: rawSpot.Spotter || '',
            Frequency: rawSpot.Frequency || '0',
            DXCall: rawSpot.DXCall || '',
            Time: rawSpot.Time || '',
            Date: rawSpot.Date || '',
            Beacon: rawSpot.Beacon || false,
            MM: rawSpot.MM || false,
            AM: rawSpot.AM || false,
            Valid: rawSpot.Valid || false,
            EQSL: rawSpot.EQSL,
            LOTW: rawSpot.LOTW,
            LOTW_Date: rawSpot.LOTW_Date,
            DXHomecall: rawSpot.DXHomecall || '',
            Comment: rawSpot.Comment || '',
            Flag: rawSpot.Flag || '',
            Band: rawSpot.Band || 0,
            Mode: rawSpot.Mode || 'UNKNOWN',
            Continent_dx: rawSpot.Continent_dx || '',
            Continent_spotter: rawSpot.Continent_spotter || '',
            DXLocator: rawSpot.DXLocator,
            Spotters: [rawSpot.Spotter || ''],
          };

          const key = `${spot.DXCall}-${spot.Frequency}`;
          const existingIndex = spotIndex[key];

          if (existingIndex !== undefined) {
            const existingSpot = processedSpots[existingIndex];
            
            // Add spotter to the list if not already present
            if (!existingSpot.Spotters.includes(spot.Spotter)) {
              existingSpot.Spotters.push(spot.Spotter);
            }

            // Keep the most recent time
            const existingTime = new Date(
              `20${existingSpot.Date.split('/')[2]}-${existingSpot.Date.split('/')[1]}-${existingSpot.Date.split('/')[0]}T${existingSpot.Time}:00Z`
            );
            const newTime = new Date(
              `20${spot.Date.split('/')[2]}-${spot.Date.split('/')[1]}-${spot.Date.split('/')[0]}T${spot.Time}:00Z`
            );

            if (newTime > existingTime) {
              existingSpot.Time = spot.Time;
              existingSpot.Date = spot.Date;
              existingSpot.Spotter = spot.Spotter;
            }
          } else {
            // First occurrence of this callsign/frequency combination
            spotIndex[key] = processedSpots.length;
            processedSpots.push(spot);
          }
        });

        // Apply local filtering for UHF and SHF bands
        let finalSpots = processedSpots;
        if (bandParam === 'UHF' || bandParam === 'SHF') {
          const bandRange = getBandFrequencyRange(this.filters.selectedBand);
          if (bandRange) {
            finalSpots = processedSpots.filter(spot => {
              const freqKHz = parseFloat(spot.Frequency);
              return freqKHz >= bandRange.min && freqKHz <= bandRange.max;
            });
          }
        }

        this.spots = finalSpots;
        this.lastFetchTime = new Date();
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Ismeretlen hiba történt';
        console.error('DX Cluster fetch error:', err);
      } finally {
        this.loading = false;
      }
    },

    startAutoRefresh(): void {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      // Initial fetch
      this.fetchSpots();

      // Set up 10-second interval
      refreshInterval = setInterval((): void => {
        this.fetchSpots();
      }, 10000);
    },

    stopAutoRefresh(): void {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    },

    updateFilters(newFilters: Partial<DxClusterFilters>): void {
      this.filters = { ...this.filters, ...newFilters };
      // Trigger immediate refresh when filters change
      this.fetchSpots();
    },

    selectBand(band: string): void {
      this.updateFilters({ selectedBand: band });
    },

    toggleFilter(filterArray: FilterArrayKey, value: string): void {
      const currentArray: string[] = [...this.filters[filterArray]];
      const index: number = currentArray.indexOf(value);

      if (index > -1) {
        currentArray.splice(index, 1);
      } else {
        currentArray.push(value);
      }

      this.updateFilters({ [filterArray]: currentArray });
    },
  },
});

// Auto-refresh interval - moved outside store to avoid reactivity issues
let refreshInterval: ReturnType<typeof setInterval> | null = null;
