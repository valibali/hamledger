import { EventEmitter } from 'events';
// serialport is required for ELKEYS COM port integration in contest mode.
import { SerialPort } from 'serialport';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export type SerialEvent =
  | { type: 'connected'; path: string }
  | { type: 'disconnected'; path: string }
  | { type: 'error'; path: string; error: string };

interface SerialPortListItem {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export class SerialManager extends EventEmitter {
  private ports = new Map<string, SerialPort>();

  async listPorts(): Promise<SerialPortInfo[]> {
    const ports = (await SerialPort.list()) as SerialPortListItem[];
    return ports.map((port: SerialPortListItem) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId,
    }));
  }

  async open(path: string, baudRate: number = 9600): Promise<void> {
    if (this.ports.has(path)) return;

    const port = new SerialPort({ path, baudRate, autoOpen: false });
    this.ports.set(path, port);

    port.on('open', () => this.emit('event', { type: 'connected', path } satisfies SerialEvent));
    port.on('close', () => this.emit('event', { type: 'disconnected', path } satisfies SerialEvent));
    port.on('error', (error: Error) =>
      this.emit('event', { type: 'error', path, error: error.message } satisfies SerialEvent)
    );

    await new Promise<void>((resolve, reject) => {
      port.open((error: Error | null | undefined) => (error ? reject(error) : resolve()));
    });
  }

  async close(path: string): Promise<void> {
    const port = this.ports.get(path);
    if (!port) return;

    await new Promise<void>((resolve, reject) => {
      port.close((error: Error | null | undefined) => (error ? reject(error) : resolve()));
    });

    this.ports.delete(path);
  }

  async send(path: string, data: string | Uint8Array): Promise<void> {
    const port = this.ports.get(path);
    if (!port) {
      throw new Error(`Port not open: ${path}`);
    }

    await new Promise<void>((resolve, reject) => {
      port.write(data, (error: Error | null | undefined) => (error ? reject(error) : resolve()));
    });
  }
}
