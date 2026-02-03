import type { ContestQso, ContestSession } from '../types/contest';
import { CallsignHelper } from '../utils/callsign';

export function isCallsignWorked(
  callsign: string,
  session: ContestSession,
  band?: string,
  mode?: string
): boolean {
  const target = CallsignHelper.extractBaseCallsign(callsign);
  return session.qsos.some(qso => {
    if (band && qso.band !== band) return false;
    if (mode && qso.mode !== mode) return false;
    return CallsignHelper.extractBaseCallsign(qso.callsign) === target;
  });
}

export function getMultiplierValue(qso: ContestQso, session: ContestSession): string | number | undefined {
  const profileId = session.profileId;
  // Basic default: use country code prefix mapping if possible
  if (profileId) {
    const baseCall = CallsignHelper.extractBaseCallsign(qso.callsign);
    const countryCode = CallsignHelper.getCountryCodeForCallsign(baseCall);
    if (countryCode && countryCode !== 'xx') {
      return countryCode.toUpperCase();
    }
  }

  // Fallbacks based on common exchange fields
  if (qso.exchange?.region) return qso.exchange.region;
  if (qso.exchange?.state) return qso.exchange.state;
  if (qso.exchange?.grid) return qso.exchange.grid;

  return undefined;
}

export function isMultiplierWorked(value: string | number, session: ContestSession): boolean {
  const target = String(value).toUpperCase();
  return session.qsos.some(qso => {
    const multValue = qso.multValue ?? getMultiplierValue(qso, session);
    if (!multValue) return false;
    return String(multValue).toUpperCase() === target;
  });
}
