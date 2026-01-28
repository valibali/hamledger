/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RigCapabilities {
  modelName: string;
  mfgName: string;
  backendVersion: string;
  rigType: string;
  pttType: string;
  dcdType: string;
  portType: string;
  serialSpeed: string;
  modes: string[];
  vfos: string[];
  functions: string[];
  levels: string[];
  txRanges: TxRange[];
  rxRanges: RxRange[];
  tuningSteps: TuningStep[];
  filters: Filter[];
}

export interface TxRange {
  minFreq: number;
  maxFreq: number;
  modes: string[];
  lowPower: number;
  highPower: number;
}

export interface RxRange {
  minFreq: number;
  maxFreq: number;
  modes: string[];
}

export interface TuningStep {
  step: number;
  modes: string[];
}

export interface Filter {
  width: number;
  modes: string[];
}

export interface RigState {
  frequency: number;
  mode: string;
  passband: number;
  vfo: string;
  ptt: boolean;
  split: boolean;
  splitFreq?: number;
  splitMode?: string;
  rit: number;
  xit: number;
  signalStrength?: number; // Hamlib STRENGTH value (0-255)
}

export interface RigctldConnection {
  host: string;
  port: number;
  connected: boolean;
  model?: number;
  device?: string;
}

export interface RigctldResponse {
  success: boolean;
  data?: string[] | string | null | any;
  error?: string;
}

export interface RigModel {
  id: number;
  manufacturer: string;
  model: string;
  status: string;
}

// Connection status for more granular state tracking
export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error'
  | 'checking';

// Diagnostics result from running connection checks
export interface RigctldDiagnostics {
  // Process checks
  processRunning: boolean;
  processPath?: string;
  processPid?: number;

  // Network checks
  portListening: boolean;
  portInUseByOther: boolean; // Port is in use but not by rigctld
  tcpConnectable: boolean;

  // Windows-specific
  firewallOk: boolean;
  firewallError?: string;

  // External rigctld detection
  isExternalRigctld: boolean; // Running rigctld was not started by HamLedger

  // General
  error?: string;
  suggestions: string[];
  timestamp: Date;
}

// Result of checking if rigctld is running
export interface RigctldRunningCheck {
  running: boolean;
  external: boolean; // true if not started by HamLedger
  pid?: number;
  port?: number;
}
