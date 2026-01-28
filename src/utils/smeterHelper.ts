import type { MajorTick, MinorTick } from '../types/smeter';

export class SMeterHelper {
  private majorTicks: MajorTick[];

  constructor() {
    this.majorTicks = [
      { label: 'S1', color: 'white' },
      { label: 'S2', color: 'white' },
      { label: 'S3', color: 'white' },
      { label: 'S4', color: 'white' },
      { label: 'S5', color: 'white' },
      { label: 'S6', color: 'white' },
      { label: 'S7', color: 'white' },
      { label: 'S8', color: 'white' },
      { label: 'S9', color: '#ffa500' },
      { label: '+10', color: '#ff6600' },
      { label: '+20', color: '#ff4400' },
      { label: '+30', color: '#ff0000' },
    ];
  }

  public getMajorTicks(): MajorTick[] {
    return this.majorTicks;
  }

  public getMinorColorFromIndex(majorIndex: number): string {
    return this.majorTicks[majorIndex]?.color || 'white';
  }

  public generateMinorTicks(majorIndex: number): MinorTick[] {
    if (typeof majorIndex !== 'number' || majorIndex >= this.majorTicks.length - 1) {
      return [];
    }

    const color = this.getMinorColorFromIndex(majorIndex);
    return Array(4)
      .fill(null)
      .map(() => ({ color }));
  }

  /**
   * Convert Hamlib STRENGTH (0-255) to S-meter units
   * Uses manufacturer-specific formulas for accurate conversion
   */
  public strengthToSMeter(
    strength: number,
    manufacturer: string = 'generic'
  ): { sUnit: number; isOverS9: boolean; overS9Value: number } {
    // Clamp strength to valid range
    strength = Math.max(0, Math.min(255, strength));

    let sUnit = 0;
    let overS9dB = 0;

    const mfg = manufacturer.toLowerCase();

    if (mfg.includes('yaesu')) {
      // Yaesu formula
      if (strength <= 95) {
        sUnit = Math.round(strength / 10);
      } else {
        sUnit = 9;
        overS9dB = Math.round(((strength - 95) * 30) / (255 - 95));
      }
    } else if (mfg.includes('icom')) {
      // Icom formula
      if (strength <= 190) {
        sUnit = Math.round(strength / 20);
      } else {
        sUnit = 9;
        overS9dB = Math.round(((strength - 190) * 30) / (255 - 190));
      }
    } else if (mfg.includes('kenwood')) {
      // Kenwood formula
      if (strength <= 160) {
        sUnit = Math.round(strength / 18);
      } else {
        sUnit = 9;
        overS9dB = Math.round(((strength - 160) * 30) / (255 - 160));
      }
    } else {
      // Generic formula (similar to Yaesu)
      if (strength <= 95) {
        sUnit = Math.round(strength / 10);
      } else {
        sUnit = 9;
        overS9dB = Math.round(((strength - 95) * 30) / (255 - 95));
      }
    }

    // Ensure sUnit is within valid range
    sUnit = Math.max(0, Math.min(9, sUnit));
    overS9dB = Math.max(0, Math.min(30, overS9dB));

    return {
      sUnit,
      isOverS9: sUnit === 9 && overS9dB > 0,
      overS9Value: overS9dB,
    };
  }

  /**
   * Get the active tick count based on Hamlib STRENGTH value
   * Each S-unit has 5 ticks (1 major + 4 minor)
   * S1-S9 = 45 ticks, then +10, +20, +30 = 15 more ticks
   * Total: 60 ticks max
   */
  public getActiveTicks(strength: number, manufacturer: string = 'generic'): number {
    const { sUnit, isOverS9, overS9Value } = this.strengthToSMeter(strength, manufacturer);

    if (!isOverS9) {
      // Each S-unit has 5 ticks (1 major + 4 minor)
      // S1 = 5 ticks, S2 = 10 ticks, etc.
      return Math.max(0, sUnit * 5);
    } else {
      // S9 + over S9 ticks
      const s9Ticks = 9 * 5; // 45 ticks for S1-S9
      const overS9Ticks = Math.min(15, Math.floor(overS9Value / 10) * 5); // +10, +20, +30
      return s9Ticks + overS9Ticks;
    }
  }
}

export const smeterHelper = new SMeterHelper();
