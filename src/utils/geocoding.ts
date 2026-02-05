import { configHelper } from './configHelper';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    country_code?: string;
  };
}

export async function geocodeLocation(
  qth: string,
  options: { countryCode?: string } = {}
): Promise<GeocodingResult | null> {
  try {
    const baseUrl =
      configHelper.getSetting(['apis', 'nominatim'], 'baseUrl') ||
      'https://nominatim.openstreetmap.org';
    const userAgent =
      configHelper.getSetting(['apis', 'nominatim'], 'userAgent') || 'HamLedger/1.0';
    const countryParam = options.countryCode
      ? `&countrycodes=${encodeURIComponent(options.countryCode.toLowerCase())}`
      : '';
    const addressDetailsParam = options.countryCode ? '&addressdetails=1' : '';

    const response = await fetch(
      `${baseUrl}/search?q=${encodeURIComponent(
        qth
      )}&format=json&limit=5${countryParam}${addressDetailsParam}`,
      {
        headers: {
          'User-Agent': userAgent,
        },
      }
    );

    const data = (await response.json()) as NominatimResult[];

    if (data && data.length > 0) {
      if (options.countryCode) {
        const match = data.find(
          item =>
            item.address?.country_code?.toLowerCase() === options.countryCode?.toLowerCase()
        );
        if (match) {
          return {
            lat: parseFloat(match.lat),
            lon: parseFloat(match.lon),
            display_name: match.display_name,
          };
        }
      }
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
