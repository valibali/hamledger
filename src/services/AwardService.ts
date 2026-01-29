/**
 * Award Service - Handles QSO enrichment and award calculations
 */
import type { QsoEntry } from '../types/qso';
import type { ModeCategory, Achievement, ExportFormat } from '../types/awards';
import { lookupCallsign } from '../utils/dxccParser';
import { useAwardsStore } from '../store/awards';

class AwardService {
  /**
   * Determine mode category for award tracking
   */
  getModeCategory(mode: string): ModeCategory {
    const m = mode.toUpperCase();
    
    // CW modes
    if (m === 'CW' || m === 'CWR') {
      return 'cw';
    }
    
    // Digital modes
    const digitalModes = [
      'FT8', 'FT4', 'JS8', 'JT65', 'JT9', 'RTTY', 'RTTYR', 
      'PSK31', 'PSK63', 'PSK125', 'OLIVIA', 'MFSK', 'THOR', 
      'DOMINO', 'CONTESTIA', 'HELL', 'ROS', 'SSTV', 'FAX', 
      'PACKET', 'AMTOR', 'PACTOR', 'WINMOR', 'VARA', 'ARDOP', 
      'FSK441', 'MSK144', 'WSPR', 'Q65'
    ];
    
    if (digitalModes.includes(m) || 
        m.includes('PSK') || 
        m.includes('MFSK') || 
        m.includes('OLIVIA')) {
      return 'digital';
    }
    
    // Phone modes (SSB, AM, FM, etc.)
    return 'phone';
  }

  /**
   * Enrich QSO with DXCC data before saving
   * This adds entity code, CQ zone, ITU zone, continent, and country name
   */
  enrichQsoWithDxcc(qso: QsoEntry): QsoEntry {
    const entity = lookupCallsign(qso.callsign);
    
    if (entity) {
      return {
        ...qso,
        dxccEntity: entity.entityCode,
        cqZone: entity.cqZone,
        ituZone: entity.ituZone,
        continent: entity.continent,
        country: entity.name,
      };
    }
    
    return qso;
  }

  /**
   * Enrich QSO with QRZ data if available
   * QRZ can provide more accurate grid square, state, and IOTA info
   */
  enrichQsoWithQrz(qso: QsoEntry, qrzData: {
    grid?: string;
    state?: string;
    dxcc?: string;
    iota?: string;
  }): QsoEntry {
    const enriched = { ...qso };
    
    if (qrzData.grid && !qso.grid) {
      enriched.grid = qrzData.grid;
    }
    
    if (qrzData.state && !qso.state) {
      enriched.state = qrzData.state;
    }
    
    if (qrzData.iota && !qso.iota) {
      enriched.iota = qrzData.iota;
    }
    
    return enriched;
  }

  /**
   * Process a new QSO for awards
   * Returns any new achievements earned
   */
  processNewQso(qso: QsoEntry): Achievement[] {
    const awardsStore = useAwardsStore();
    return awardsStore.processNewQso(qso);
  }

  /**
   * Recalculate all awards from QSO list
   */
  async recalculateAwards(qsos: QsoEntry[]): Promise<void> {
    const awardsStore = useAwardsStore();
    await awardsStore.calculateFromLog(qsos);
  }

  /**
   * Export DXCC progress in various formats
   */
  exportDxccProgress(format: ExportFormat = 'csv'): string {
    const awardsStore = useAwardsStore();
    const statuses = awardsStore.entityStatuses;
    
    if (format === 'csv') {
      const headers = ['Entity Code', 'Name', 'Prefix', 'Continent', 'Worked', 'CW', 'Phone', 'Digital'];
      const rows = statuses.map(s => [
        s.entityCode,
        s.name,
        s.prefix,
        s.continent,
        s.worked ? 'Yes' : 'No',
        s.workedModes.includes('cw') ? 'Yes' : 'No',
        s.workedModes.includes('phone') ? 'Yes' : 'No',
        s.workedModes.includes('digital') ? 'Yes' : 'No',
      ].join(','));
      
      return [headers.join(','), ...rows].join('\n');
    }
    
    if (format === 'json') {
      return JSON.stringify(statuses, null, 2);
    }
    
    // ADIF format (basic)
    if (format === 'adif') {
      let adif = 'ADIF Export - DXCC Progress\n<EOH>\n\n';
      // ADIF doesn't have a standard format for progress, so we'll just list worked entities
      const worked = statuses.filter(s => s.worked);
      worked.forEach(s => {
        adif += `<DXCC:${s.entityCode.toString().length}>${s.entityCode}\n`;
        adif += `<COUNTRY:${s.name.length}>${s.name}\n`;
        adif += '<EOR>\n\n';
      });
      return adif;
    }
    
    return '';
  }

  /**
   * Export WAS progress
   */
  exportWasProgress(format: ExportFormat = 'csv'): string {
    const awardsStore = useAwardsStore();
    const statuses = awardsStore.stateStatuses;
    
    if (format === 'csv') {
      const headers = ['State Code', 'State Name', 'Worked', 'CW', 'Phone', 'Digital'];
      const rows = statuses.map(s => [
        s.code,
        s.name,
        s.worked ? 'Yes' : 'No',
        s.workedModes.includes('cw') ? 'Yes' : 'No',
        s.workedModes.includes('phone') ? 'Yes' : 'No',
        s.workedModes.includes('digital') ? 'Yes' : 'No',
      ].join(','));
      
      return [headers.join(','), ...rows].join('\n');
    }
    
    if (format === 'json') {
      return JSON.stringify(statuses, null, 2);
    }
    
    return '';
  }

  /**
   * Export statistics
   */
  exportStatistics(format: ExportFormat = 'json'): string {
    const awardsStore = useAwardsStore();
    const stats = awardsStore.stats;
    
    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    }
    
    if (format === 'csv') {
      const lines: string[] = [];
      lines.push('Statistic,Value');
      lines.push(`Total QSOs,${stats.totalQsos}`);
      lines.push(`Countries Worked,${stats.countriesWorked}`);
      lines.push(`Unique Callsigns,${stats.uniqueCallsigns}`);
      lines.push(`First QSO,${stats.firstQsoDate || 'N/A'}`);
      lines.push(`Last QSO,${stats.lastQsoDate || 'N/A'}`);
      lines.push('');
      lines.push('QSOs by Band');
      Object.entries(stats.qsosByBand).forEach(([band, count]) => {
        lines.push(`${band},${count}`);
      });
      lines.push('');
      lines.push('QSOs by Mode');
      Object.entries(stats.qsosByMode).forEach(([mode, count]) => {
        lines.push(`${mode},${count}`);
      });
      lines.push('');
      lines.push('QSOs by Year');
      Object.entries(stats.qsosByYear).forEach(([year, count]) => {
        lines.push(`${year},${count}`);
      });
      
      return lines.join('\n');
    }
    
    return '';
  }

  /**
   * Get summary text for an achievement notification
   */
  getAchievementNotificationText(achievement: Achievement): {
    title: string;
    body: string;
  } {
    return {
      title: achievement.title,
      body: achievement.description,
    };
  }

  /**
   * Check if a callsign is from the US (for WAS tracking)
   */
  isUSCallsign(callsign: string): boolean {
    const call = callsign.toUpperCase();
    // US prefixes: K, W, N, AA-AL
    const usPatterns = [
      /^[KWN]\d/,  // K, W, N followed by number
      /^A[A-L]\d/, // AA-AL followed by number
    ];
    return usPatterns.some(p => p.test(call));
  }

  /**
   * Extract US call area from callsign
   */
  getUSCallArea(callsign: string): number | null {
    const call = callsign.toUpperCase();
    const match = call.match(/[KWNA][A-Z]?\d/);
    if (match) {
      const digit = match[0].match(/\d/);
      return digit ? parseInt(digit[0]) : null;
    }
    return null;
  }
}

// Export singleton instance
export const awardService = new AwardService();
