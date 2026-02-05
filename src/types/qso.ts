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
  contestSessionId?: string;
  contestLogType?: string;
  contestProfileId?: string;
  contestExchange?: Record<string, string>;
  contestPoints?: number;
  contestMultiplierFactor?: number;
  contestIsMult?: boolean;
  contestMultValue?: string | number;
  name?: string;
  qth?: string;
  
  // Award-related fields (computed on save)
  dxccEntity?: number;     // DXCC entity code
  cqZone?: number;         // CQ zone (1-40)
  ituZone?: number;        // ITU zone (1-90)
  continent?: string;      // Continent code (AF, AN, AS, EU, NA, OC, SA)
  country?: string;        // Country/entity name
  state?: string;          // US state code (for WAS)
  grid?: string;           // Grid square (4 or 6 char)
  iota?: string;           // IOTA reference (e.g., "EU-005")
}
