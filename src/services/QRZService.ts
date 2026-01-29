import { BaseStationData, QRZData } from '../types/station';
import { configHelper } from '../utils/configHelper';
import { OnlineStationService } from './OnlineStationService';

export class QRZService extends OnlineStationService {
  protected baseUrl = 'https://xmldata.qrz.com/xml/current';
  protected serviceName = 'QRZ.com';
  private sessionKey?: string;

  public async authenticate(): Promise<void | string> {
    if (this.sessionKey) {
      return this.sessionKey;
    }

    const username = configHelper.getSetting(['qrz'], 'username');
    const password = configHelper.getSetting(['qrz'], 'password');

    if (!username || !password) {
      throw new Error('QRZ credentials not configured in settings');
    }

    const params = new URLSearchParams({
      username,
      password,
      agent: 'HamLedger-1.0',
    });

    const response = await fetch(`${this.baseUrl}/?${params}`);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const key = xmlDoc.querySelector('Key')?.textContent;
    const error = xmlDoc.querySelector('Error')?.textContent;

    if (error) {
      throw this.handleError(error, 'Authentication error');
    }
    if (!key) {
      throw new Error('No session key returned');
    }

    this.sessionKey = key;
  }

  public async lookupStationByCallsign(callsign: string): Promise<BaseStationData | Error> {
    try {
      await this.authenticate();
      if (!this.sessionKey) {
        throw new Error('Authentication failed');
      }
      const params = new URLSearchParams({
        s: this.sessionKey,
        callsign,
      });

      const response = await fetch(`${this.baseUrl}/?${params}`);
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const error = xmlDoc.querySelector('Error')?.textContent;
      if (error) {
        throw this.handleError(error, 'Lookup error');
      }

      const callsignElem = xmlDoc.querySelector('Callsign');
      if (!callsignElem) {
        throw new Error('No callsign data returned');
      }

      return this.mapToBaseStationData(callsignElem);
    } catch (error) {
      console.error('Error fetching QRZ data:', error);
      return error as Error;
    }
  }
  protected mapToBaseStationData(callsignElem: Element): BaseStationData {
    return {
      call: callsignElem.querySelector('call')?.textContent || '',
      name: `${callsignElem.querySelector('fname')?.textContent || ''} ${
        callsignElem.querySelector('name')?.textContent || ''
      }`.trim(),
      country: callsignElem.querySelector('country')?.textContent || 'Unknown',
      lat: parseFloat(callsignElem.querySelector('lat')?.textContent || '0'),
      lon: parseFloat(callsignElem.querySelector('lon')?.textContent || '0'),
      grid: callsignElem.querySelector('grid')?.textContent || '',
      qth: callsignElem.querySelector('addr2')?.textContent || '',
      time_offset: parseInt(callsignElem.querySelector('GMTOffset')?.textContent || '0'),
      state: callsignElem.querySelector('state')?.textContent || '',
    };
  }

  public async getFullQRZData(callsign: string): Promise<QRZData | Error> {
    try {
      await this.authenticate();
      if (!this.sessionKey) {
        throw new Error('Authentication failed');
      }
      const params = new URLSearchParams({
        s: this.sessionKey,
        callsign,
      });

      const response = await fetch(`${this.baseUrl}/?${params}`);
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const error = xmlDoc.querySelector('Error')?.textContent;
      if (error) {
        throw this.handleError(error, 'Lookup error');
      }

      const callsignElem = xmlDoc.querySelector('Callsign');
      if (!callsignElem) {
        throw new Error('No callsign data returned');
      }

      return {
        ...this.mapToBaseStationData(callsignElem),
        fname: callsignElem.querySelector('fname')?.textContent || '',
        addr1: callsignElem.querySelector('addr1')?.textContent || '',
        addr2: callsignElem.querySelector('addr2')?.textContent || '',
        state: callsignElem.querySelector('state')?.textContent || '',
        zip: callsignElem.querySelector('zip')?.textContent || '',
        county: callsignElem.querySelector('county')?.textContent || '',
        class: callsignElem.querySelector('class')?.textContent || '',
        email: callsignElem.querySelector('email')?.textContent || '',
        timezone: callsignElem.querySelector('TimeZone')?.textContent || '',
        gmtOffset: parseInt(callsignElem.querySelector('GMTOffset')?.textContent || '0'),
      };
    } catch (error) {
      console.error('Error fetching QRZ data:', error);
      return error as Error;
    }
  }
}

export const qrzService = new QRZService();
