/**
 * Award tracking type definitions
 */

// Mode categories for award tracking
export type ModeCategory = 'mixed' | 'cw' | 'phone' | 'digital';

// Award types
export type AwardType = 'dxcc' | 'was' | 'waz' | 'grid' | 'iota' | 'milestone';

// Achievement notification
export interface Achievement {
  id: string;
  type: AwardType;
  title: string;
  description: string;
  timestamp: Date;
  qsoId?: string;
  entityCode?: number;    // For DXCC achievements
  stateCode?: string;     // For WAS achievements
  zoneNumber?: number;    // For WAZ achievements
  gridSquare?: string;    // For grid achievements
  iotaRef?: string;       // For IOTA achievements
  isNew: boolean;         // First time working this entity/state/etc
}

// Progress tracking for each award by mode
export interface ModeProgress {
  mixed: Set<number | string>;
  cw: Set<number | string>;
  phone: Set<number | string>;
  digital: Set<number | string>;
}

// DXCC progress (entity codes)
export interface DXCCProgress {
  mixed: Set<number>;
  cw: Set<number>;
  phone: Set<number>;
  digital: Set<number>;
}

// WAS progress (state codes)
export interface WASProgress {
  mixed: Set<string>;
  cw: Set<string>;
  phone: Set<string>;
  digital: Set<string>;
}

// WAZ progress (CQ zone numbers 1-40)
export interface WAZProgress {
  mixed: Set<number>;
  cw: Set<number>;
  phone: Set<number>;
  digital: Set<number>;
}

// Grid square progress
export interface GridProgress {
  fourChar: Set<string>;   // e.g., "FN31"
  sixChar: Set<string>;    // e.g., "FN31pr"
}

// QSO statistics
export interface QSOStatistics {
  totalQsos: number;
  qsosByBand: Record<string, number>;
  qsosByMode: Record<string, number>;
  qsosByYear: Record<number, number>;
  qsosByMonth: Record<string, number>;  // Format: "YYYY-MM"
  qsosByContinent: Record<string, number>;
  countriesWorked: number;
  uniqueCallsigns: number;
  firstQsoDate: string | null;
  lastQsoDate: string | null;
}

// Full awards state
export interface AwardsState {
  // Progress tracking
  dxcc: DXCCProgress;
  was: WASProgress;
  waz: WAZProgress;
  grids: GridProgress;
  iota: Set<string>;
  
  // Statistics
  stats: QSOStatistics;
  
  // Notifications
  unviewedAchievements: Achievement[];
  allAchievements: Achievement[];
  
  // State tracking
  lastCalculated: Date | null;
  isCalculating: boolean;
  calculationProgress: number;  // 0-100
}

// Award summary for display
export interface AwardSummary {
  name: string;
  description: string;
  current: number;
  total: number;
  percentage: number;
  byMode: {
    mixed: number;
    cw: number;
    phone: number;
    digital: number;
  };
}

// DXCC entity status for map display
export interface EntityStatus {
  entityCode: number;
  name: string;
  prefix: string;
  continent: string;
  worked: boolean;
  workedModes: ModeCategory[];
  bands: string[];
  firstQso?: string;
  lastQso?: string;
  qsoCount: number;
}

// US State status for map display
export interface StateStatus {
  code: string;
  name: string;
  worked: boolean;
  workedModes: ModeCategory[];
  bands: string[];
  qsoCount: number;
}

// CQ Zone status for map display
export interface ZoneStatus {
  zone: number;
  worked: boolean;
  workedModes: ModeCategory[];
  qsoCount: number;
}

// Grid square status
export interface GridStatus {
  grid: string;
  qsoCount: number;
  callsigns: string[];
}

// Filter options for award views
export interface AwardFilter {
  mode: ModeCategory | 'all';
  band: string | 'all';
  showWorked: boolean;
  showNeeded: boolean;
}

// Export format options
export type ExportFormat = 'csv' | 'json' | 'adif';

// Milestone definitions
export interface Milestone {
  id: string;
  type: 'qso_count' | 'dxcc_count' | 'was_count' | 'waz_count' | 'grid_count';
  threshold: number;
  name: string;
  description: string;
}

// Predefined milestones
export const MILESTONES: Milestone[] = [
  // QSO count milestones
  { id: 'qso_100', type: 'qso_count', threshold: 100, name: '100 QSOs', description: 'Logged 100 contacts' },
  { id: 'qso_500', type: 'qso_count', threshold: 500, name: '500 QSOs', description: 'Logged 500 contacts' },
  { id: 'qso_1000', type: 'qso_count', threshold: 1000, name: '1000 QSOs', description: 'Logged 1000 contacts' },
  { id: 'qso_5000', type: 'qso_count', threshold: 5000, name: '5000 QSOs', description: 'Logged 5000 contacts' },
  { id: 'qso_10000', type: 'qso_count', threshold: 10000, name: '10K QSOs', description: 'Logged 10,000 contacts' },
  
  // DXCC milestones
  { id: 'dxcc_25', type: 'dxcc_count', threshold: 25, name: '25 DXCC', description: 'Worked 25 DXCC entities' },
  { id: 'dxcc_50', type: 'dxcc_count', threshold: 50, name: '50 DXCC', description: 'Worked 50 DXCC entities' },
  { id: 'dxcc_100', type: 'dxcc_count', threshold: 100, name: '100 DXCC', description: 'Worked 100 DXCC entities' },
  { id: 'dxcc_200', type: 'dxcc_count', threshold: 200, name: '200 DXCC', description: 'Worked 200 DXCC entities' },
  { id: 'dxcc_300', type: 'dxcc_count', threshold: 300, name: '300 DXCC', description: 'Worked 300 DXCC entities' },
  
  // WAS milestones
  { id: 'was_25', type: 'was_count', threshold: 25, name: '25 States', description: 'Worked 25 US states' },
  { id: 'was_50', type: 'was_count', threshold: 50, name: 'WAS Complete', description: 'Worked All States!' },
  
  // WAZ milestones
  { id: 'waz_20', type: 'waz_count', threshold: 20, name: '20 Zones', description: 'Worked 20 CQ zones' },
  { id: 'waz_40', type: 'waz_count', threshold: 40, name: 'WAZ Complete', description: 'Worked All Zones!' },
  
  // Grid milestones
  { id: 'grid_50', type: 'grid_count', threshold: 50, name: '50 Grids', description: 'Worked 50 grid squares' },
  { id: 'grid_100', type: 'grid_count', threshold: 100, name: '100 Grids', description: 'Worked 100 grid squares' },
  { id: 'grid_500', type: 'grid_count', threshold: 500, name: '500 Grids', description: 'Worked 500 grid squares' },
];
