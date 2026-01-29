/**
 * Awards Store - Pinia store for award tracking and statistics
 */
import { defineStore } from 'pinia';
import type {
  AwardsState,
  Achievement,
  AwardSummary,
  ModeCategory,
  QSOStatistics,
  EntityStatus,
  StateStatus,
  ZoneStatus,
} from '../types/awards';
import type { QsoEntry } from '../types/qso';
import { lookupCallsign, getCurrentEntityCount, getAllEntities, getEntityByCode, type DXCCEntity } from '../utils/dxccParser';
import { US_STATES, WAS_TOTAL_STATES, isValidStateCode } from '../data/usStates';

// Helper to generate unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper to determine mode category
function getModeCategory(mode: string): ModeCategory {
  const m = mode.toUpperCase();
  
  // CW modes
  if (m === 'CW' || m === 'CWR') {
    return 'cw';
  }
  
  // Digital modes
  const digitalModes = ['FT8', 'FT4', 'JS8', 'JT65', 'JT9', 'RTTY', 'RTTYR', 'PSK31', 'PSK63', 'PSK125',
    'OLIVIA', 'MFSK', 'THOR', 'DOMINO', 'CONTESTIA', 'HELL', 'ROS', 'SSTV', 'FAX', 'PACKET',
    'AMTOR', 'PACTOR', 'WINMOR', 'VARA', 'ARDOP', 'FSK441', 'MSK144', 'WSPR', 'Q65'];
  if (digitalModes.includes(m) || m.includes('PSK') || m.includes('MFSK') || m.includes('OLIVIA')) {
    return 'digital';
  }
  
  // Phone modes (SSB, AM, FM)
  return 'phone';
}

// Helper to create empty statistics
function createEmptyStats(): QSOStatistics {
  return {
    totalQsos: 0,
    qsosByBand: {},
    qsosByMode: {},
    qsosByYear: {},
    qsosByMonth: {},
    qsosByContinent: {},
    countriesWorked: 0,
    uniqueCallsigns: 0,
    firstQsoDate: null,
    lastQsoDate: null,
  };
}

export const useAwardsStore = defineStore('awards', {
  state: (): AwardsState => ({
    dxcc: {
      mixed: new Set<number>(),
      cw: new Set<number>(),
      phone: new Set<number>(),
      digital: new Set<number>(),
    },
    was: {
      mixed: new Set<string>(),
      cw: new Set<string>(),
      phone: new Set<string>(),
      digital: new Set<string>(),
    },
    waz: {
      mixed: new Set<number>(),
      cw: new Set<number>(),
      phone: new Set<number>(),
      digital: new Set<number>(),
    },
    grids: {
      fourChar: new Set<string>(),
      sixChar: new Set<string>(),
    },
    iota: new Set<string>(),
    stats: createEmptyStats(),
    unviewedAchievements: [],
    allAchievements: [],
    lastCalculated: null,
    isCalculating: false,
    calculationProgress: 0,
  }),

  getters: {
    // DXCC progress
    dxccMixedCount: (state) => state.dxcc.mixed.size,
    dxccCwCount: (state) => state.dxcc.cw.size,
    dxccPhoneCount: (state) => state.dxcc.phone.size,
    dxccDigitalCount: (state) => state.dxcc.digital.size,
    dxccTotal: () => getCurrentEntityCount(),
    dxccPercentage: (state) => Math.round((state.dxcc.mixed.size / getCurrentEntityCount()) * 100),

    // WAS progress
    wasMixedCount: (state) => state.was.mixed.size,
    wasCwCount: (state) => state.was.cw.size,
    wasPhoneCount: (state) => state.was.phone.size,
    wasDigitalCount: (state) => state.was.digital.size,
    wasTotal: () => WAS_TOTAL_STATES,
    wasPercentage: (state) => Math.round((state.was.mixed.size / WAS_TOTAL_STATES) * 100),
    wasComplete: (state) => state.was.mixed.size >= WAS_TOTAL_STATES,

    // WAZ progress
    wazMixedCount: (state) => state.waz.mixed.size,
    wazCwCount: (state) => state.waz.cw.size,
    wazPhoneCount: (state) => state.waz.phone.size,
    wazDigitalCount: (state) => state.waz.digital.size,
    wazTotal: () => 40,
    wazPercentage: (state) => Math.round((state.waz.mixed.size / 40) * 100),
    wazComplete: (state) => state.waz.mixed.size >= 40,

    // Grid progress
    gridsFourCharCount: (state) => state.grids.fourChar.size,
    gridsSixCharCount: (state) => state.grids.sixChar.size,

    // IOTA progress
    iotaCount: (state) => state.iota.size,

    // Unviewed achievements count
    unviewedCount: (state) => state.unviewedAchievements.length,
    hasUnviewedAchievements: (state) => state.unviewedAchievements.length > 0,

    // Get award summaries
    awardSummaries(): AwardSummary[] {
      return [
        {
          name: 'DXCC',
          description: 'DX Century Club - Work 100+ DXCC entities',
          current: this.dxccMixedCount,
          total: this.dxccTotal,
          percentage: this.dxccPercentage,
          byMode: {
            mixed: this.dxccMixedCount,
            cw: this.dxccCwCount,
            phone: this.dxccPhoneCount,
            digital: this.dxccDigitalCount,
          },
        },
        {
          name: 'WAS',
          description: 'Worked All States - Work all 50 US states',
          current: this.wasMixedCount,
          total: this.wasTotal,
          percentage: this.wasPercentage,
          byMode: {
            mixed: this.wasMixedCount,
            cw: this.wasCwCount,
            phone: this.wasPhoneCount,
            digital: this.wasDigitalCount,
          },
        },
        {
          name: 'WAZ',
          description: 'Worked All Zones - Work all 40 CQ zones',
          current: this.wazMixedCount,
          total: this.wazTotal,
          percentage: this.wazPercentage,
          byMode: {
            mixed: this.wazMixedCount,
            cw: this.wazCwCount,
            phone: this.wazPhoneCount,
            digital: this.wazDigitalCount,
          },
        },
      ];
    },

    // Get entity statuses for map
    entityStatuses(): EntityStatus[] {
      const entities = getAllEntities();
      return entities.map(entity => ({
        entityCode: entity.entityCode,
        name: entity.name,
        prefix: entity.primaryPrefix,
        continent: entity.continent,
        worked: this.dxcc.mixed.has(entity.entityCode),
        workedModes: [
          ...(this.dxcc.cw.has(entity.entityCode) ? ['cw' as ModeCategory] : []),
          ...(this.dxcc.phone.has(entity.entityCode) ? ['phone' as ModeCategory] : []),
          ...(this.dxcc.digital.has(entity.entityCode) ? ['digital' as ModeCategory] : []),
        ],
        bands: [],
        qsoCount: 0,
      }));
    },

    // Get state statuses for WAS map
    stateStatuses(): StateStatus[] {
      return US_STATES.map(state => ({
        code: state.code,
        name: state.name,
        worked: this.was.mixed.has(state.code),
        workedModes: [
          ...(this.was.cw.has(state.code) ? ['cw' as ModeCategory] : []),
          ...(this.was.phone.has(state.code) ? ['phone' as ModeCategory] : []),
          ...(this.was.digital.has(state.code) ? ['digital' as ModeCategory] : []),
        ],
        bands: [],
        qsoCount: 0,
      }));
    },

    // Get zone statuses for WAZ map
    zoneStatuses(): ZoneStatus[] {
      const zones: ZoneStatus[] = [];
      for (let i = 1; i <= 40; i++) {
        zones.push({
          zone: i,
          worked: this.waz.mixed.has(i),
          workedModes: [
            ...(this.waz.cw.has(i) ? ['cw' as ModeCategory] : []),
            ...(this.waz.phone.has(i) ? ['phone' as ModeCategory] : []),
            ...(this.waz.digital.has(i) ? ['digital' as ModeCategory] : []),
          ],
          qsoCount: 0,
        });
      }
      return zones;
    },
  },

  actions: {
    /**
     * Calculate all awards from the full QSO log
     */
    async calculateFromLog(qsos: QsoEntry[]): Promise<void> {
      this.isCalculating = true;
      this.calculationProgress = 0;

      // Reset all progress
      this.dxcc = {
        mixed: new Set<number>(),
        cw: new Set<number>(),
        phone: new Set<number>(),
        digital: new Set<number>(),
      };
      this.was = {
        mixed: new Set<string>(),
        cw: new Set<string>(),
        phone: new Set<string>(),
        digital: new Set<string>(),
      };
      this.waz = {
        mixed: new Set<number>(),
        cw: new Set<number>(),
        phone: new Set<number>(),
        digital: new Set<number>(),
      };
      this.grids = {
        fourChar: new Set<string>(),
        sixChar: new Set<string>(),
      };
      this.iota = new Set<string>();
      this.stats = createEmptyStats();

      const uniqueCallsigns = new Set<string>();
      const total = qsos.length;

      for (let i = 0; i < qsos.length; i++) {
        const qso = qsos[i];
        this.processQsoForAwards(qso, uniqueCallsigns, false);
        
        // Update progress every 100 QSOs
        if (i % 100 === 0) {
          this.calculationProgress = Math.round((i / total) * 100);
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Finalize statistics
      this.stats.uniqueCallsigns = uniqueCallsigns.size;
      this.stats.countriesWorked = this.dxcc.mixed.size;

      this.lastCalculated = new Date();
      this.isCalculating = false;
      this.calculationProgress = 100;

      console.log('[Awards] Calculation complete:', {
        dxcc: this.dxcc.mixed.size,
        was: this.was.mixed.size,
        waz: this.waz.mixed.size,
        grids: this.grids.fourChar.size,
        totalQsos: this.stats.totalQsos,
      });
    },

    /**
     * Process a single QSO for awards tracking
     * Returns array of new achievements
     */
    processNewQso(qso: QsoEntry): Achievement[] {
      const achievements: Achievement[] = [];
      const uniqueCallsigns = new Set<string>(); // Not tracked incrementally
      
      // Check for new achievements before processing
      const prevDxcc = this.dxcc.mixed.size;
      const prevWas = this.was.mixed.size;
      const prevWaz = this.waz.mixed.size;
      const prevGrids = this.grids.fourChar.size;

      this.processQsoForAwards(qso, uniqueCallsigns, true);

      // Check for new DXCC entity
      if (this.dxcc.mixed.size > prevDxcc && qso.dxccEntity) {
        const entity = lookupCallsign(qso.callsign);
        if (entity) {
          achievements.push({
            id: generateId(),
            type: 'dxcc',
            title: 'New DXCC Entity!',
            description: `${entity.name} (${entity.primaryPrefix})`,
            timestamp: new Date(),
            qsoId: qso._id,
            entityCode: entity.entityCode,
            isNew: true,
          });
        }
      }

      // Check for new US state
      if (this.was.mixed.size > prevWas && qso.state) {
        achievements.push({
          id: generateId(),
          type: 'was',
          title: 'New US State!',
          description: `${qso.state} - WAS Progress: ${this.was.mixed.size}/50`,
          timestamp: new Date(),
          qsoId: qso._id,
          stateCode: qso.state,
          isNew: true,
        });
      }

      // Check for new CQ zone
      if (this.waz.mixed.size > prevWaz && qso.cqZone) {
        achievements.push({
          id: generateId(),
          type: 'waz',
          title: 'New CQ Zone!',
          description: `Zone ${qso.cqZone} - WAZ Progress: ${this.waz.mixed.size}/40`,
          timestamp: new Date(),
          qsoId: qso._id,
          zoneNumber: qso.cqZone,
          isNew: true,
        });
      }

      // Check for new grid square
      if (this.grids.fourChar.size > prevGrids && qso.grid) {
        const grid4 = qso.grid.substring(0, 4).toUpperCase();
        achievements.push({
          id: generateId(),
          type: 'grid',
          title: 'New Grid Square!',
          description: `${grid4} - Total: ${this.grids.fourChar.size} grids`,
          timestamp: new Date(),
          qsoId: qso._id,
          gridSquare: grid4,
          isNew: true,
        });
      }

      // Check for milestones
      const milestoneAchievements = this.checkMilestones(qso._id);
      achievements.push(...milestoneAchievements);

      // Add to unviewed achievements
      if (achievements.length > 0) {
        this.unviewedAchievements.push(...achievements);
        this.allAchievements.push(...achievements);
      }

      return achievements;
    },

    /**
     * Internal method to process QSO data
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    processQsoForAwards(qso: QsoEntry, uniqueCallsigns: Set<string>, _isIncremental: boolean): void {
      const modeCategory = getModeCategory(qso.mode);
      
      // Track unique callsigns
      uniqueCallsigns.add(qso.callsign.toUpperCase());

      // Update statistics
      this.stats.totalQsos++;
      
      // By band
      const band = qso.band || 'Unknown';
      this.stats.qsosByBand[band] = (this.stats.qsosByBand[band] || 0) + 1;
      
      // By mode
      this.stats.qsosByMode[qso.mode] = (this.stats.qsosByMode[qso.mode] || 0) + 1;
      
      // By year and month
      if (qso.datetime) {
        const date = new Date(qso.datetime);
        const year = date.getFullYear();
        const month = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        this.stats.qsosByYear[year] = (this.stats.qsosByYear[year] || 0) + 1;
        this.stats.qsosByMonth[month] = (this.stats.qsosByMonth[month] || 0) + 1;
        
        // Track first/last QSO dates
        if (!this.stats.firstQsoDate || qso.datetime < this.stats.firstQsoDate) {
          this.stats.firstQsoDate = qso.datetime;
        }
        if (!this.stats.lastQsoDate || qso.datetime > this.stats.lastQsoDate) {
          this.stats.lastQsoDate = qso.datetime;
        }
      }

      // DXCC tracking
      let entity: DXCCEntity | null = null;
      // Prefer live lookup against the 2022 DXCC dataset to avoid stale codes.
      entity = lookupCallsign(qso.callsign);
      if (!entity && qso.dxccEntity) {
        entity = getEntityByCode(qso.dxccEntity);
      }

      if (entity) {
        this.dxcc.mixed.add(entity.entityCode);
        if (modeCategory === 'cw') this.dxcc.cw.add(entity.entityCode);
        else if (modeCategory === 'phone') this.dxcc.phone.add(entity.entityCode);
        else if (modeCategory === 'digital') this.dxcc.digital.add(entity.entityCode);

        // Track by continent
        if (entity.continent) {
          this.stats.qsosByContinent[entity.continent] = 
            (this.stats.qsosByContinent[entity.continent] || 0) + 1;
        }
      }

      // WAS tracking (US states)
      if (qso.state && isValidStateCode(qso.state)) {
        this.was.mixed.add(qso.state);
        if (modeCategory === 'cw') this.was.cw.add(qso.state);
        else if (modeCategory === 'phone') this.was.phone.add(qso.state);
        else if (modeCategory === 'digital') this.was.digital.add(qso.state);
      }

      // WAZ tracking (CQ zones)
      const cqZone = qso.cqZone || (entity ? entity.cqZone : null);
      if (cqZone && cqZone >= 1 && cqZone <= 40) {
        this.waz.mixed.add(cqZone);
        if (modeCategory === 'cw') this.waz.cw.add(cqZone);
        else if (modeCategory === 'phone') this.waz.phone.add(cqZone);
        else if (modeCategory === 'digital') this.waz.digital.add(cqZone);
      }

      // Grid square tracking
      if (qso.grid) {
        const grid = qso.grid.toUpperCase();
        if (grid.length >= 4) {
          this.grids.fourChar.add(grid.substring(0, 4));
        }
        if (grid.length >= 6) {
          this.grids.sixChar.add(grid.substring(0, 6));
        }
      }

      // IOTA tracking
      if (qso.iota) {
        this.iota.add(qso.iota.toUpperCase());
      }
    },

    /**
     * Check for milestone achievements
     */
    checkMilestones(qsoId?: string): Achievement[] {
      const achievements: Achievement[] = [];
      const milestones = [
        // QSO count milestones
        { id: 'qso_100', type: 'qso_count' as const, threshold: 100, name: '100 QSOs', description: 'Logged 100 contacts' },
        { id: 'qso_500', type: 'qso_count' as const, threshold: 500, name: '500 QSOs', description: 'Logged 500 contacts' },
        { id: 'qso_1000', type: 'qso_count' as const, threshold: 1000, name: '1000 QSOs', description: 'Logged 1000 contacts' },
        { id: 'qso_5000', type: 'qso_count' as const, threshold: 5000, name: '5000 QSOs', description: 'Logged 5000 contacts' },
        { id: 'qso_10000', type: 'qso_count' as const, threshold: 10000, name: '10K QSOs', description: 'Logged 10,000 contacts' },
        // DXCC milestones
        { id: 'dxcc_25', type: 'dxcc_count' as const, threshold: 25, name: '25 DXCC', description: 'Worked 25 DXCC entities' },
        { id: 'dxcc_50', type: 'dxcc_count' as const, threshold: 50, name: '50 DXCC', description: 'Worked 50 DXCC entities' },
        { id: 'dxcc_100', type: 'dxcc_count' as const, threshold: 100, name: 'DXCC!', description: 'Worked 100 DXCC entities - DXCC Award!' },
        { id: 'dxcc_200', type: 'dxcc_count' as const, threshold: 200, name: '200 DXCC', description: 'Worked 200 DXCC entities' },
        { id: 'dxcc_300', type: 'dxcc_count' as const, threshold: 300, name: '300 DXCC', description: 'Worked 300 DXCC entities' },
        // WAS milestones
        { id: 'was_25', type: 'was_count' as const, threshold: 25, name: '25 States', description: 'Worked 25 US states' },
        { id: 'was_50', type: 'was_count' as const, threshold: 50, name: 'WAS Complete!', description: 'Worked All States!' },
        // WAZ milestones
        { id: 'waz_20', type: 'waz_count' as const, threshold: 20, name: '20 Zones', description: 'Worked 20 CQ zones' },
        { id: 'waz_40', type: 'waz_count' as const, threshold: 40, name: 'WAZ Complete!', description: 'Worked All Zones!' },
      ];

      // Check which milestones already exist
      const existingIds = new Set(this.allAchievements.map(a => a.id));

      for (const milestone of milestones) {
        if (existingIds.has(milestone.id)) continue;

        let currentValue = 0;
        if (milestone.type === 'qso_count') currentValue = this.stats.totalQsos;
        else if (milestone.type === 'dxcc_count') currentValue = this.dxcc.mixed.size;
        else if (milestone.type === 'was_count') currentValue = this.was.mixed.size;
        else if (milestone.type === 'waz_count') currentValue = this.waz.mixed.size;

        if (currentValue >= milestone.threshold) {
          achievements.push({
            id: milestone.id,
            type: 'milestone',
            title: milestone.name,
            description: milestone.description,
            timestamp: new Date(),
            qsoId,
            isNew: true,
          });
        }
      }

      return achievements;
    },

    /**
     * Mark all achievements as viewed
     */
    markAchievementsViewed(): void {
      this.unviewedAchievements = [];
    },

    /**
     * Clear a specific achievement from unviewed
     */
    dismissAchievement(achievementId: string): void {
      this.unviewedAchievements = this.unviewedAchievements.filter(a => a.id !== achievementId);
    },

    /**
     * Reset all award data
     */
    reset(): void {
      this.dxcc = {
        mixed: new Set<number>(),
        cw: new Set<number>(),
        phone: new Set<number>(),
        digital: new Set<number>(),
      };
      this.was = {
        mixed: new Set<string>(),
        cw: new Set<string>(),
        phone: new Set<string>(),
        digital: new Set<string>(),
      };
      this.waz = {
        mixed: new Set<number>(),
        cw: new Set<number>(),
        phone: new Set<number>(),
        digital: new Set<number>(),
      };
      this.grids = {
        fourChar: new Set<string>(),
        sixChar: new Set<string>(),
      };
      this.iota = new Set<string>();
      this.stats = createEmptyStats();
      this.unviewedAchievements = [];
      this.allAchievements = [];
      this.lastCalculated = null;
      this.isCalculating = false;
      this.calculationProgress = 0;
    },

    /**
     * Get progress for a specific DXCC entity
     */
    isEntityWorked(entityCode: number): boolean {
      return this.dxcc.mixed.has(entityCode);
    },

    /**
     * Get progress for a specific US state
     */
    isStateWorked(stateCode: string): boolean {
      return this.was.mixed.has(stateCode.toUpperCase());
    },

    /**
     * Get progress for a specific CQ zone
     */
    isZoneWorked(zone: number): boolean {
      return this.waz.mixed.has(zone);
    },

    /**
     * Get needed DXCC entities
     */
    getNeededEntities(): DXCCEntity[] {
      const allEntities = getAllEntities();
      return allEntities.filter(e => !this.dxcc.mixed.has(e.entityCode));
    },

    /**
     * Get needed US states
     */
    getNeededStates(): string[] {
      return US_STATES.filter(s => !this.was.mixed.has(s.code)).map(s => s.code);
    },

    /**
     * Get needed CQ zones
     */
    getNeededZones(): number[] {
      const needed: number[] = [];
      for (let i = 1; i <= 40; i++) {
        if (!this.waz.mixed.has(i)) {
          needed.push(i);
        }
      }
      return needed;
    },
  },
});
