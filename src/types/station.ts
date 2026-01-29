export interface BaseStationData {
  call: string;
  name: string;
  country: string;
  lat?: number;
  lon?: number;
  grid?: string;
  qth: string;
  time_offset?: number;
  state?: string;
}

export interface QRZData extends BaseStationData {
  call: string;
  aliases?: string;
  fname: string;
  name: string;
  nickname?: string;
  addr1?: string;
  addr2?: string;
  state?: string;
  zip?: string;
  country: string;
  lat?: number;
  lon?: number;
  grid?: string;
  county?: string;
  class?: string;
  email?: string;
  url?: string;
  image?: string;
  timezone?: string;
  gmtOffset?: number;
  dxcc?: string;
  born?: string;
  qth: string;
}

export interface QRZSessionResponse {
  version: string;
  callsign: string;
  session: {
    key: string;
    count: number;
    subExp: string;
    gmTime: string;
  };
}

export interface StationData {
  baseData: BaseStationData;
  flag: string;
  weather: string;
  localTime: string;
  geodata: GeoData;
  greetings: {
    greeting: string;
    ipa: string;
    label: string;
  }[];
  distance?: number;
  portableSuffix: string | null;
  qrzError?: boolean;
}

export interface GeoData {
  lat: number;
  lon: number;
  display_name?: string;
}
