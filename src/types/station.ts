export interface QRZData {
  name: string;
  qth: string;
}

export interface StationData {
  flag: string;
  country: string;
  qrzData?: QRZData;
  weather: string;
  localTime: string;
  greetings: {
    greeting: string;
    ipa: string;
    label: string;
  }[];
}
