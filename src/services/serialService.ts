import '../types/electron';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export async function listPorts(): Promise<SerialPortInfo[]> {
  return window.electronAPI.serialListPorts();
}

export async function openPort(
  path: string,
  baudRate: number = 9600
): Promise<{ success: boolean; error?: string }> {
  return window.electronAPI.serialOpen(path, baudRate);
}

export async function closePort(path: string): Promise<{ success: boolean; error?: string }> {
  return window.electronAPI.serialClose(path);
}

export async function sendData(
  path: string,
  data: string | Uint8Array
): Promise<{ success: boolean; error?: string }> {
  return window.electronAPI.serialSend(path, data);
}
