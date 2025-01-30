import { QRZData } from "../types/station";

export abstract class OnlineStationService {
  protected abstract baseUrl: string;
  protected abstract serviceName: string;

  abstract authenticate(): Promise<void | string>;
  abstract lookupStationByCallsign(callsign: string): Promise<QRZData | Error>;

  protected handleError(error: string, context: string): Error {
    const message = `${this.serviceName} ${context}: ${error}`;
    console.error(message);
    return new Error(message);
  }
}
