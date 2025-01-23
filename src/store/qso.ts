import { defineStore } from "pinia";
import { useRigStore } from "./rig";

interface QsoEntry {
  callsign: string;
  band: string;
  freqRx: number;
  freqTx?: number;
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
    currentUTCTime: '',
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
    },
  }),
  actions: {
    addQso() {
      const now = new Date(); 
      const utcDateStr = now.toLocaleDateString('en-US', { 
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const utcTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const rigStore = useRigStore();

      const newQso: QsoEntry = {
        callsign: this.qsoForm.callsign,
        band: this.qsoForm.band,
        freqRx: parseFloat(rigStore.frequency),
        mode: rigStore.selectedMode,
        datetime: now.toISOString(),
      };

      // Only add TX frequency if split is active
      if (rigStore.splitActive) {
        newQso.freqTx = parseFloat(rigStore.txFrequency);
      }

      // Only add optional fields if they have content
      if (this.qsoForm.rstr) newQso.rstr = this.qsoForm.rstr;
      if (this.qsoForm.rstt) newQso.rstt = this.qsoForm.rstt;
      if (this.qsoForm.remark?.trim()) newQso.remark = this.qsoForm.remark;
      if (this.qsoForm.notes?.trim()) newQso.notes = this.qsoForm.notes;

      this.currentSession.push(newQso);
      this.allQsos.push(newQso);

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
    updateCurrentUTCTime() {
      const now = new Date();
      this.currentUTCTime = now.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    },
  },
  getters: {
    sessionCount: (state) => state.currentSession.length,
    totalCount: (state) => state.allQsos.length,
  },
});
