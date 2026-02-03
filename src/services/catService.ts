import '../types/electron';

export async function setPTT(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  return window.electronAPI.catSetPTT(enabled);
}
