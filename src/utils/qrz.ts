import { StationData } from "../types/station";
import { getCountryCodeForCallsign } from "../utils/callsign";

function getCountryName(countryCode: string): string {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(countryCode.toUpperCase()) || 'Unknown';
  } catch (error) {
    console.error('Error getting country name:', error);
    return 'Unknown';
  }
}

export async function fetchQRZData(
  callsign: string
): Promise<StationData | Error> {
  try {
    // TODO: Implement actual QRZ.com API integration
    // This is a mock implementation for now
    const countryCode = getCountryCodeForCallsign(callsign);
    return {
      flag: `https://flagcdn.com/h80/${countryCode}.png`,
      name: "JOHN DOE",
      qth: "New York, NY",
      country: getCountryName(countryCode),
    };
  } catch (error) {
    console.error("Error fetching QRZ data:", error);
    return error;
  }
}
