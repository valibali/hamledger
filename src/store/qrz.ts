import { defineStore } from 'pinia';
import type { BaseStationData } from '../types/station';
import { qrzService } from '../services/QRZService';
import { CallsignHelper } from '../utils/callsign';

interface QrzState {
  cache: Record<string, BaseStationData | null>;
  inFlight: Record<string, boolean>;
  errors: Record<string, string | undefined>;
}

export const useQrzStore = defineStore('qrz', {
  state: (): QrzState => ({
    cache: {},
    inFlight: {},
    errors: {},
  }),
  actions: {
    normalize(callsign: string): string {
      return CallsignHelper.extractBaseCallsign(callsign).toUpperCase();
    },
    getCached(callsign: string): BaseStationData | null | undefined {
      return this.cache[this.normalize(callsign)];
    },
    async enqueueLookup(callsign: string): Promise<void> {
      const key = this.normalize(callsign);
      if (!key) return;
      if (this.cache[key] !== undefined || this.inFlight[key]) return;

      this.inFlight[key] = true;
      this.errors[key] = undefined;

      try {
        const result = await qrzService.lookupStationByCallsign(key);
        if (result instanceof Error) {
          this.cache[key] = null;
          this.errors[key] = result.message;
          return;
        }
        this.cache[key] = result;
      } catch (error) {
        this.cache[key] = null;
        this.errors[key] = error instanceof Error ? error.message : 'Lookup failed';
      } finally {
        this.inFlight[key] = false;
      }
    },
    async resolveLookup(callsign: string): Promise<BaseStationData | null> {
      const key = this.normalize(callsign);
      if (this.cache[key] !== undefined) {
        return this.cache[key] ?? null;
      }
      await this.enqueueLookup(key);
      return this.cache[key] ?? null;
    },
  },
});
