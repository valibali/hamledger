import { QsoEntry } from './qso';
import { WSJTXDecodeMessage } from './wsjtx';

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

interface DxSpotData {
  spots?: Array<{
    Nr: number;
    Spotter: string;
    Frequency: string;
    DXCall: string;
    Time: string;
    Date: string;
  }>;
}

interface RigConnectionData {
  connected: boolean;
}

interface WSJTXStatusData {
  enabled: boolean;
  running: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      addQso: (qso: QsoEntry) => Promise<DatabaseResponse>;
      getAllDocs: () => Promise<{ rows: Array<{ doc: QsoEntry; id: string; value: { rev: string } }> }>;
      importAdif: () => Promise<{ imported: boolean; count?: number; error?: string }>;
      selectAdifFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
      parseAdifFile: (
        filePath: string
      ) => Promise<{ success: boolean; totalCount?: number; error?: string }>;
      importAdifWithProgress: (
        filePath: string
      ) => Promise<{ success: boolean; count?: number; error?: string }>;
      onAdifImportProgress: (callback: (progress: { imported: number }) => void) => void;
      saveAdifFile: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      loadSettings: () => Promise<Record<string, unknown> | null>;
      saveSettings: (settings: Record<string, unknown>) => Promise<void>;
      updateQso: (qso: QsoEntry) => Promise<UpdateResponse>;
      deleteQso: (qsoId: string) => Promise<DatabaseResponse>;
      fetchDxSpots: (params: string) => Promise<{ success: boolean; data?: DxSpotData; error?: string }>;
      fetchPropagationData: () => Promise<{ success: boolean; data?: PropagationData; error?: string }>;
      fetchWeather: (
        lat: number,
        lon: number
      ) => Promise<{ success: boolean; data?: WeatherData; error?: string }>;
      rigctldConnect: (
        host: string,
        port: number,
        model?: number,
        device?: string
      ) => Promise<{ success: boolean; data?: RigConnectionData; error?: string }>;
      rigctldDisconnect: () => Promise<{ success: boolean; data?: RigConnectionData; error?: string }>;
      rigctldCommand: (
        command: string
      ) => Promise<{ success: boolean; data?: string[] | string | null; error?: string }>;
      rigctldGetCapabilities: () => Promise<{ success: boolean; data?: string[]; error?: string }>;
      executeCommand: (
        command: string
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
      rigctldRestart: () => Promise<{ success: boolean; error?: string }>;
      downloadAndInstallHamlib: () => Promise<{ success: boolean; message?: string; path?: string; error?: string }>;
      checkRigctldInPath: () => Promise<{ success: boolean; inPath: boolean; path?: string }>;
      addFirewallExceptions: () => Promise<{ success: boolean; userCancelled?: boolean; error?: string }>;
      onHamlibDownloadProgress: (callback: (progress: { progress: number }) => void) => void;
      wsjtxStart: (port?: number) => Promise<{ success: boolean; error?: string }>;
      wsjtxStop: () => Promise<{ success: boolean; error?: string }>;
      wsjtxStatus: () => Promise<{ success: boolean; data?: WSJTXStatusData; error?: string }>;
      onWSJTXDecode: (callback: (decode: WSJTXDecodeMessage) => void) => void;
      onWSJTXQSOLogged: (callback: (qso: QsoEntry) => void) => void;
    };
  }
}

export {};
