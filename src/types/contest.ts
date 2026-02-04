export type ContestExchangeType = 'none' | 'serial' | 'region' | 'grid' | 'custom';
export type ContestMultiplierField = 'country' | 'state' | 'grid' | 'prefix' | 'region';
export type ContestSessionStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'closed';

export interface ContestExchangeField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  required?: boolean;
  validate?: 'grid';
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
  multiplierFactor?: number;
  isMult: boolean;
  multValue?: string | number;
}

export interface ContestSession {
  id: string;
  profileId: string;
  startedAt?: string;
  endedAt?: string;
  qsos: ContestQso[];
  status: ContestSessionStatus;
  setup: ContestSetup;
}

export interface ContestSessionSnapshot {
  session: ContestSession;
  sessionElapsedMs: number;
  sessionLastStartedAt: number | null;
  serialCounter: number;
  scoringState: {
    points: number;
    multipliers: string[];
    score: number;
  };
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

export interface ContestSetup {
  contestName?: string;
  contestType: string;
  logType?: string;
  modeCategory: string;
  operatorCategory: string;
  assistedCategory: string;
  powerCategory: string;
  bandCategory: string;
  overlayCategory: string;
  sentExchange: string;
  serialSentStart: string;
  multipliers: Array<{ pattern: string; value: string }>;
  startTime: string;
}
