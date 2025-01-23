export interface BandRange {
  name: string;
  min: number;
  max: number;
}

export const BAND_RANGES: BandRange[] = [
  { name: '10m', min: 28.000, max: 29.700 },
  { name: '20m', min: 14.000, max: 14.350 },
  { name: '40m', min: 7.000, max: 7.300 }
];

export function getBandFromFrequency(freq: number): string {
  const band = BAND_RANGES.find(band => 
    freq >= band.min && freq <= band.max
  );
  return band ? band.name : '';
}
