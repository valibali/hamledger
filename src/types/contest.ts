export type ContestExchangeType = 'serial' | 'region' | 'custom';
export type ContestMultiplierField = 'country' | 'state' | 'grid' | 'prefix' | 'region';

export interface ContestExchangeField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  required?: boolean;
}

export interface ContestProfile {
  id: string;
  name: string;
  exchangeType: ContestExchangeType;
  exchangeFields: ContestExchangeField[];
  serialStartsAt?: number;
  multiplierField?: ContestMultiplierField;
}

export interface ContestQso {
  id: string;
  callsign: string;
  band: string;
  mode: string;
  datetime: string;
  rstSent: string;
  rstRecv: string;
  exchange: Record<string, string>;
  serialSent?: number;
  serialRecv?: number;
  points: number;
  isMult: boolean;
  multValue?: string | number;
}

export interface ContestSession {
  id: string;
  profileId: string;
  startedAt: string;
  endedAt?: string;
  qsos: ContestQso[];
}

export interface ContestStats {
  totalQsos: number;
  rates: {
    last1: number;
    last5: number;
    last10: number;
    last60: number;
  };
  sparkline: number[];
  estimatedPoints: number;
  estimatedScore: number;
}

export interface ContestDraft {
  callsign: string;
  rstSent: string;
  rstRecv: string;
  exchange: Record<string, string>;
}
