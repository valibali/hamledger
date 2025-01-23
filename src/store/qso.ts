import { defineStore } from "pinia";

interface QsoEntry {
  callsign: string;
  band: string;
  freqRx: number;
  freqTx?: number;
  mode: string;
  rstr1?: string;
  rstr2?: string;
  datetime: string;
  remark?: string;
  notes?: string;
}

export const useQsoStore = defineStore("qso", {
  state: () => ({
    currentSession: [] as QsoEntry[],
    allQsos: [] as QsoEntry[],
    qsoForm: {
      callsign: "",
      band: "40m",
      mode: "SSB",
      rstr: "",
      rstr2: "",
      date: "",
      utc: "",
      remark: "",
      notes: "",
    },
  }),
  actions: {
    addQso() {
      const now = new Date();
      const rigStore = useRigStore();
      
      const newQso: QsoEntry = {
        callsign: this.qsoForm.callsign,
        band: this.qsoForm.band,
        freqRx: parseFloat(rigStore.frequency),
        mode: rigStore.selectedMode,
        datetime: now.toISOString()
      };

      // Only add TX frequency if split is active
      if (rigStore.splitActive) {
        newQso.freqTx = parseFloat(rigStore.txFrequency);
      }

      // Only add optional fields if they have content
      if (this.qsoForm.rstr) newQso.rstr1 = this.qsoForm.rstr;
      if (this.qsoForm.rstr2) newQso.rstr2 = this.qsoForm.rstr2;
      if (this.qsoForm.remark?.trim()) newQso.remark = this.qsoForm.remark;
      if (this.qsoForm.notes?.trim()) newQso.notes = this.qsoForm.notes;

      this.currentSession.push(newQso);
      this.allQsos.push(newQso);

      // Reset form
      this.qsoForm = {
        callsign: "",
        band: "40m",
        mode: "SSB",
        rstr: "",
        rstr2: "",
        date: "",
        utc: "",
        remark: "",
        notes: "",
      };
    },
    updateQsoForm(field: keyof typeof this.qsoForm, value: string) {
      this.qsoForm[field] = value;
    },
  },
  getters: {
    sessionCount: (state) => state.currentSession.length,
    totalCount: (state) => state.allQsos.length,
  },
});
