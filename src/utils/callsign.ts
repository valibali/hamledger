interface PrefixMap {
  [key: string]: string;
}

const prefixMap: PrefixMap = {
  F: 'fr',
  HB9: 'ch',
  OK: 'cz',
  DL: 'de',
  G: 'gb',
  EA: 'es',
  HA: 'hu',
  HG: 'hu'
};

export function getCountryCodeForCallsign(callsign: string): string {
  callsign = callsign.toUpperCase();
  const knownPrefixes = Object.keys(prefixMap).sort((a, b) => b.length - a.length);
  for (const prefix of knownPrefixes) {
    if (callsign.startsWith(prefix)) {
      return prefixMap[prefix];
    }
  }
  return 'xx';
}
