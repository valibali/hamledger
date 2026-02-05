import { QsoEntry } from './qso';
import { WSJTXDecodeMessage } from './wsjtx';
import { RigctldDiagnostics, RigctldRunningCheck } from './rig';

interface DatabaseResponse {
  ok: boolean;
  id?: string;
  error?: Error | unknown;
}

interface UpdateResponse extends DatabaseResponse {
  rev?: string;
}

interface WeatherData {
  current_weather?: {
    temperature: number;
    weathercode: number;
  };
}

interface PropagationData {
  sfi?: number;
  aIndex?: number;
  kIndex?: number;
  lastUpdated?: string;
}

interface RawDxSpot {
  Nr: number;
  Spotter: string;
  Frequency: string;
  DXCall: string;
  Time: string;
  Date: string;
  Beacon: boolean;
  MM: boolean;
  AM: boolean;
  Valid: boolean;
  EQSL?: boolean;
  LOTW?: boolean;
  LOTW_Date?: string;
  DXHomecall: string;
  Comment: string;
  Flag: string;
  Band: number;
  Mode?: string;
  Continent_dx: string;
  Continent_spotter: string;
  DXLocator?: string;
}

type DxSpotData = RawDxSpot[];

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

interface RigConnectionData {
  connected: boolean;
  isExternal?: boolean;
}

interface WSJTXStatusData {
  enabled: boolean;
  running: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      addQso: (qso: QsoEntry) => Promise<DatabaseResponse>;
      getAllDocs: () => Promise<{
        rows: Array<{ doc: QsoEntry; id: string; value: { rev: string } }>;
      }>;
      importAdif: () => Promise<{ imported: boolean; count?: number; error?: string }>;
      selectAdifFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
      parseAdifFile: (
        filePath: string
      ) => Promise<{ success: boolean; totalCount?: number; error?: string }>;
      importAdifWithProgress: (
        filePath: string
      ) => Promise<{ success: boolean; count?: number; error?: string }>;
      onAdifImportProgress: (callback: (progress: { imported: number }) => void) => void;
      saveAdifFile: (
        content: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      loadSettings: () => Promise<Record<string, unknown> | null>;
      saveSettings: (settings: Record<string, unknown>) => Promise<void>;
      updateQso: (qso: QsoEntry) => Promise<UpdateResponse>;
      deleteQso: (qsoId: string) => Promise<DatabaseResponse>;
      fetchDxSpots: (
        params: string
      ) => Promise<{ success: boolean; data?: DxSpotData; error?: string }>;
      fetchPropagationData: () => Promise<{
        success: boolean;
        data?: PropagationData;
        error?: string;
      }>;
      fetchWeather: (
        lat: number,
        lon: number
      ) => Promise<{ success: boolean; data?: WeatherData; error?: string }>;
      rigctldConnect: (
        host: string,
        port: number,
        model?: number,
        device?: string
      ) => Promise<{
        success: boolean;
        data?: RigConnectionData;
        error?: string;
        firewallConfigured?: boolean;
        shouldRetry?: boolean;
        userCancelled?: boolean;
        firewallError?: string;
        suggestions?: string[];
      }>;
      rigctldDisconnect: () => Promise<{
        success: boolean;
        data?: RigConnectionData;
        error?: string;
      }>;
      rigctldCommand: (
        command: string
      ) => Promise<{ success: boolean; data?: string[] | string | null; error?: string }>;
      rigctldGetCapabilities: () => Promise<{ success: boolean; data?: string[]; error?: string }>;
      executeCommand: (
        command: string
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
      rigctldRestart: () => Promise<{ success: boolean; error?: string }>;
      rigctldStartElevated: () => Promise<{
        success: boolean;
        error?: string;
        userCancelled?: boolean;
      }>;
      rigctldDiagnostics: () => Promise<{
        success: boolean;
        data?: RigctldDiagnostics;
        error?: string;
      }>;
      rigctldCheckRunning: () => Promise<{
        success: boolean;
        data?: RigctldRunningCheck;
        error?: string;
      }>;
      downloadAndInstallHamlib: () => Promise<{
        success: boolean;
        message?: string;
        path?: string;
        pathUpdated?: boolean;
        error?: string;
      }>;
      checkRigctldInPath: () => Promise<{ success: boolean; inPath: boolean; path?: string }>;
      addFirewallExceptions: () => Promise<{
        success: boolean;
        userCancelled?: boolean;
        error?: string;
      }>;
      onHamlibDownloadProgress: (callback: (progress: { progress: number }) => void) => void;
      wsjtxStart: (port?: number) => Promise<{ success: boolean; error?: string }>;
      wsjtxStop: () => Promise<{ success: boolean; error?: string }>;
      wsjtxStatus: () => Promise<{ success: boolean; data?: WSJTXStatusData; error?: string }>;
      onWSJTXDecode: (callback: (decode: WSJTXDecodeMessage) => void) => void;
      onWSJTXQSOLogged: (callback: (qso: QsoEntry) => void) => void;
      onWSJTXAddQSO: (callback: (qso: QsoEntry) => void) => void;
      catSetPTT: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      serialListPorts: () => Promise<SerialPortInfo[]>;
      serialOpen: (path: string, baudRate: number) => Promise<{ success: boolean; error?: string }>;
      serialClose: (path: string) => Promise<{ success: boolean; error?: string }>;
      serialSend: (
        path: string,
        data: string | Uint8Array
      ) => Promise<{ success: boolean; error?: string }>;
      onSerialEvent: (callback: (event: unknown) => void) => void;
      saveVoiceClip: (payload: {
        name: string;
        data: ArrayBuffer | Uint8Array;
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadVoiceClip: (filePath: string) => Promise<{ success: boolean; data?: ArrayBuffer; error?: string }>;
    };
  }
}

export {};
