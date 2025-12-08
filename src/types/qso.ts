export interface QsoEntry {
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
  qslStatus?: string;
  qrzLogId?: string;
}
