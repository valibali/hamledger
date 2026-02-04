import { CallsignHelper } from './callsign';
import * as countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

let localeReady = false;

const ensureLocale = () => {
  if (localeReady) return;
  countries.registerLocale(en);
  localeReady = true;
};

export const resolveStationLocation = (input: {
  callsign?: string;
  qth?: string;
  country?: string;
}) => {
  ensureLocale();
  const callsign = input.callsign || '';
  const countryCode = callsign ? CallsignHelper.getCountryCodeForCallsign(callsign) : '';
  const countryName = countryCode ? countries.getName(countryCode.toUpperCase(), 'en') : '';
  const resolvedCountry = input.country || countryName || '';
  const resolvedCity = input.qth || '';
  const label = resolvedCountry
    ? resolvedCity
      ? `${resolvedCity}, ${resolvedCountry}`
      : resolvedCountry
    : resolvedCity;
  return {
    country: resolvedCountry,
    label,
  };
};
