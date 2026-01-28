import { ConfigHelper } from './configHelper';

export interface BandRange {
  name: string;
  shortName: string; // Short name without 'm' suffix (e.g., "160" for "160m")
  min: number; // kHz
  max: number; // kHz
  IARU1: { min: number; max: number }; // IARU Region 1 (Europe, Africa, Middle East, Northern Asia)
  IARU2: { min: number; max: number }; // IARU Region 2 (Americas)
  IARU3: { min: number; max: number }; // IARU Region 3 (Asia-Pacific)
}

// IARU band definitions with regional variations
export const BAND_RANGES: BandRange[] = [
  // LF/MF bands
  {
    name: '2200m',
    shortName: '2200',
    min: 135.7,
    max: 137.8,
    IARU1: { min: 135.7, max: 137.8 },
    IARU2: { min: 135.7, max: 137.8 },
    IARU3: { min: 135.7, max: 137.8 },
  },
  {
    name: '630m',
    shortName: '630',
    min: 472,
    max: 479,
    IARU1: { min: 472, max: 479 },
    IARU2: { min: 472, max: 479 },
    IARU3: { min: 472, max: 479 },
  },
  {
    name: '160m',
    shortName: '160',
    min: 1800,
    max: 2000,
    IARU1: { min: 1810, max: 2000 },
    IARU2: { min: 1800, max: 2000 },
    IARU3: { min: 1800, max: 2000 },
  },
  // HF bands
  {
    name: '80m',
    shortName: '80',
    min: 3500,
    max: 4000,
    IARU1: { min: 3500, max: 3800 },
    IARU2: { min: 3500, max: 4000 },
    IARU3: { min: 3500, max: 3900 },
  },
  {
    name: '60m',
    shortName: '60',
    min: 5351.5,
    max: 5366.5,
    IARU1: { min: 5351.5, max: 5366.5 },
    IARU2: { min: 5330.5, max: 5406.4 },
    IARU3: { min: 5351.5, max: 5366.5 },
  },
  {
    name: '40m',
    shortName: '40',
    min: 7000,
    max: 7300,
    IARU1: { min: 7000, max: 7200 },
    IARU2: { min: 7000, max: 7300 },
    IARU3: { min: 7000, max: 7300 },
  },
  {
    name: '30m',
    shortName: '30',
    min: 10100,
    max: 10150,
    IARU1: { min: 10100, max: 10150 },
    IARU2: { min: 10100, max: 10150 },
    IARU3: { min: 10100, max: 10150 },
  },
  {
    name: '20m',
    shortName: '20',
    min: 14000,
    max: 14350,
    IARU1: { min: 14000, max: 14350 },
    IARU2: { min: 14000, max: 14350 },
    IARU3: { min: 14000, max: 14350 },
  },
  {
    name: '17m',
    shortName: '17',
    min: 18068,
    max: 18168,
    IARU1: { min: 18068, max: 18168 },
    IARU2: { min: 18068, max: 18168 },
    IARU3: { min: 18068, max: 18168 },
  },
  {
    name: '15m',
    shortName: '15',
    min: 21000,
    max: 21450,
    IARU1: { min: 21000, max: 21450 },
    IARU2: { min: 21000, max: 21450 },
    IARU3: { min: 21000, max: 21450 },
  },
  {
    name: '12m',
    shortName: '12',
    min: 24890,
    max: 24990,
    IARU1: { min: 24890, max: 24990 },
    IARU2: { min: 24890, max: 24990 },
    IARU3: { min: 24890, max: 24990 },
  },
  {
    name: '10m',
    shortName: '10',
    min: 28000,
    max: 29700,
    IARU1: { min: 28000, max: 29700 },
    IARU2: { min: 28000, max: 29700 },
    IARU3: { min: 28000, max: 29700 },
  },
  // VHF bands
  {
    name: '6m',
    shortName: '6',
    min: 50000,
    max: 54000,
    IARU1: { min: 50000, max: 52000 },
    IARU2: { min: 50000, max: 54000 },
    IARU3: { min: 50000, max: 54000 },
  },
  {
    name: '4m',
    shortName: '4',
    min: 70000,
    max: 70500,
    IARU1: { min: 70000, max: 70500 },
    IARU2: { min: 70000, max: 70500 },
    IARU3: { min: 70000, max: 70500 },
  },
  {
    name: '2m',
    shortName: '2',
    min: 144000,
    max: 148000,
    IARU1: { min: 144000, max: 146000 },
    IARU2: { min: 144000, max: 148000 },
    IARU3: { min: 144000, max: 148000 },
  },
  // UHF bands
  {
    name: '70cm',
    shortName: '70',
    min: 420000,
    max: 450000,
    IARU1: { min: 430000, max: 440000 },
    IARU2: { min: 420000, max: 450000 },
    IARU3: { min: 430000, max: 450000 },
  },
  {
    name: '33cm',
    shortName: '33',
    min: 902000,
    max: 928000,
    IARU1: { min: 902000, max: 928000 },
    IARU2: { min: 902000, max: 928000 },
    IARU3: { min: 902000, max: 928000 },
  },
  {
    name: '23cm',
    shortName: '23',
    min: 1240000,
    max: 1300000,
    IARU1: { min: 1240000, max: 1300000 },
    IARU2: { min: 1240000, max: 1300000 },
    IARU3: { min: 1240000, max: 1300000 },
  },
  // SHF bands
  {
    name: '13cm',
    shortName: '13',
    min: 2300000,
    max: 2450000,
    IARU1: { min: 2300000, max: 2450000 },
    IARU2: { min: 2300000, max: 2450000 },
    IARU3: { min: 2300000, max: 2450000 },
  },
  {
    name: '9cm',
    shortName: '9',
    min: 3300000,
    max: 3500000,
    IARU1: { min: 3300000, max: 3500000 },
    IARU2: { min: 3300000, max: 3500000 },
    IARU3: { min: 3300000, max: 3500000 },
  },
  {
    name: '6cm',
    shortName: '6cm',
    min: 5650000,
    max: 5925000,
    IARU1: { min: 5650000, max: 5925000 },
    IARU2: { min: 5650000, max: 5925000 },
    IARU3: { min: 5650000, max: 5925000 },
  },
  {
    name: '3cm',
    shortName: '3',
    min: 10000000,
    max: 10500000,
    IARU1: { min: 10000000, max: 10500000 },
    IARU2: { min: 10000000, max: 10500000 },
    IARU3: { min: 10000000, max: 10500000 },
  },
  {
    name: '1.2cm',
    shortName: '1.2',
    min: 24000000,
    max: 24250000,
    IARU1: { min: 24000000, max: 24250000 },
    IARU2: { min: 24000000, max: 24250000 },
    IARU3: { min: 24000000, max: 24250000 },
  },
  {
    name: '6mm',
    shortName: '6mm',
    min: 47000000,
    max: 47200000,
    IARU1: { min: 47000000, max: 47200000 },
    IARU2: { min: 47000000, max: 47200000 },
    IARU3: { min: 47000000, max: 47200000 },
  },
  {
    name: '4mm',
    shortName: '4mm',
    min: 75500000,
    max: 81000000,
    IARU1: { min: 75500000, max: 81000000 },
    IARU2: { min: 75500000, max: 81000000 },
    IARU3: { min: 75500000, max: 81000000 },
  },
  {
    name: '2.5mm',
    shortName: '2.5mm',
    min: 119980000,
    max: 120020000,
    IARU1: { min: 119980000, max: 120020000 },
    IARU2: { min: 119980000, max: 120020000 },
    IARU3: { min: 119980000, max: 120020000 },
  },
  {
    name: '2mm',
    shortName: '2mm',
    min: 142000000,
    max: 149000000,
    IARU1: { min: 142000000, max: 149000000 },
    IARU2: { min: 142000000, max: 149000000 },
    IARU3: { min: 142000000, max: 149000000 },
  },
  {
    name: '1mm',
    shortName: '1mm',
    min: 241000000,
    max: 250000000,
    IARU1: { min: 241000000, max: 250000000 },
    IARU2: { min: 241000000, max: 250000000 },
    IARU3: { min: 241000000, max: 250000000 },
  },
];

export type IARURegion = 'IARU1' | 'IARU2' | 'IARU3';

export function getBandFromFrequency(freq: number): BandRange | null {
  // Convert Hz to kHz for comparison with band ranges
  const freqKHz = freq / 1000;
  return BAND_RANGES.find(band => freqKHz >= band.min && freqKHz <= band.max) || null;
}

export function getBandByName(name: string): BandRange | null {
  return BAND_RANGES.find(band => band.name === name) || null;
}

export function getRegionalBandRange(
  name: string,
  region?: IARURegion
): { min: number; max: number } | null {
  const band = getBandByName(name);
  if (!band) return null;

  // Use provided region or try to get from config, fallback to IARU1
  const targetRegion = region || getConfiguredRegion();
  return band[targetRegion];
}

export function getConfiguredRegion(): IARURegion {
  try {
    // Import configHelper dynamically to avoid circular dependencies
    const configHelper = new ConfigHelper();
    return configHelper.getIARURegion();
  } catch {
    // Fallback to IARU1 if configHelper is not available
    return 'IARU1';
  }
}

export function getAllBandNames(): string[] {
  return BAND_RANGES.map(band => band.name);
}

export function getBandFrequencyRange(name: string): { min: number; max: number } | null {
  const band = getBandByName(name);
  return band ? { min: band.min, max: band.max } : null;
}
