import { defineStore } from "pinia";
import { useRigStore } from "./rig";

declare global {
  interface Window {
    electronAPI: {
      addQso: (qso: any) => Promise<any>;
      getAllDocs: () => Promise<any>;
    }
  }
}

const CALLSIGN_REGEX = /((2[A-Z]{1,2}|[BFGIKMNRW][A-Z]{0,2}|3[A-CE-Z][A-Z]{0,1}|4[A-MO-Z][A-Z]{0,1}|[5-9OUX][A-Z][A-Z]{0,1})([0-9][0-9A-Z]{0,3}[A-Z])|([ACDLP][2-9A-Z][A-Z]{0,1}|E[2-7A-Z][A-Z]{0,1}|H[2-46-9A-Z][A-Z]{0,1}|[JTV][2-8A-Z][A-Z]{0,1}|S[2-35-9A-RT-Z][A-Z]{0,1}|Y[2-9A-Y][A-Z]{0,1}|Z[238A-Z][A-Z]{0,1})([0-9A-Z]{0,3}[A-Z]))/;

export function isValidCallsign(callsign: string): boolean {
  return CALLSIGN_REGEX.test(callsign.toUpperCase());
}

interface StationInfo {
  flag: string;
  name: string;
  weather: string;
  qth: string;
  localTime: string;
  greetings: {
    greeting: string;
    ipa: string;
    label: string;
  }[];
}

interface QsoEntry {
  _id?: string;
  _rev?: string;
  callsign: string;
  band: string;
  freqRx: number;
  freqTx?: number | string;
  mode: string;
  rstr?: string;
  rstt?: string;
  datetime: string;
  remark?: string;
  notes?: string;
}

export const useQsoStore = defineStore("qso", {
  state: () => ({
    currentSession: [] as QsoEntry[],
    allQsos: [] as QsoEntry[],
    currentUTCTime: "",
    initialized: false,
    stationInfo: {
      flag: 'https://flagcdn.com/h80/hu.png',
      name: 'JOHN DOE',
      weather: '19°C, Cloudy',
      qth: 'New York, NY',
      localTime: '22:15',
      greetings: [
        {
          label: 'Appropriate greeting',
          greeting: 'Hello',
          ipa: 'həˈləʊ'
        },
        {
          label: 'Thank you',
          greeting: 'Thanks',
          ipa: 'θæŋks'
        },
        {
          label: 'Good luck',
          greeting: 'Good luck',
          ipa: 'ɡʊd lʌk'
        }
      ]
    } as StationInfo,
    qsoForm: {
      callsign: "",
      band: "40m",
      mode: "SSB",
      rstr: "59",
      rstt: "59",
      date: "",
      utc: "",
      remark: "",
      notes: "",
    }
  }),
  actions: {
    async init() {
      if (!this.initialized) {
        await this.initializeStore();
      }
    },
    async addQso() {
      const now = new Date();
      const utcDateStr = now.toLocaleDateString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const utcTimeStr = now.toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const rigStore = useRigStore();

      const newQso: QsoEntry = {
        callsign: this.qsoForm.callsign.toUpperCase(),
        band: this.qsoForm.band,
        freqRx: parseFloat(rigStore.frequency),
        mode: rigStore.selectedMode,
        datetime: now.toISOString(),
      };

      // Handle TX frequency
      newQso.freqTx = rigStore.splitActive
        ? parseFloat(rigStore.txFrequency)
        : "--";

      // Use form values or defaults for RST
      newQso.rstr = this.qsoForm.rstr || "59";
      newQso.rstt = this.qsoForm.rstt || "59";
      newQso.remark = this.qsoForm.remark?.trim() || "--";
      newQso.notes = this.qsoForm.notes?.trim() || "--";

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
        console.error("Failed to save QSO:", error);
      }

      // Reset form
      this.qsoForm = {
        callsign: "",
        band: "40m",
        mode: "SSB",
        rstr: "59",
        rstt: "59",
        date: "",
        utc: "",
        remark: "",
        notes: "",
      };
    },
    updateQsoForm(field: keyof typeof this.qsoForm, value: string) {
      this.qsoForm[field] = value;
    },
    async initializeStore() {
      if (!this.initialized) {
        try {
          const result = await window.electronAPI.getAllDocs();
          this.allQsos = result.rows.map((row) => row.doc as QsoEntry);
          this.initialized = true;
        } catch (error) {
          console.error("Failed to initialize QSO store:", error);
        }
      }
    },

    updateCurrentUTCTime() {
      const now = new Date();
      this.currentUTCTime = now.toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
    updateStationInfo(updates: Partial<StationData>) {
      this.stationInfo = { ...this.stationInfo, ...updates };
    },
  },
  getters: {
    sessionCount: (state) => state.currentSession.length,
    totalCount: (state) => state.allQsos.length,
    isCallsignValid: (state) => {
      return state.qsoForm.callsign ? isValidCallsign(state.qsoForm.callsign) : true;
    }
  },
});
