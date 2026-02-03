import { ipcMain } from 'electron';

interface CommandResult {
  success: boolean;
  error?: string;
}

export function registerCatController(
  sendRigCommand: (command: string) => Promise<CommandResult>
): void {
  ipcMain.handle('cat:setPTT', async (_event, enabled: boolean) => {
    const command = `T ${enabled ? '1' : '0'}`;
    return sendRigCommand(command);
  });
}
