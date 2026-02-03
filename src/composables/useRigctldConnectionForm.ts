import { ref } from 'vue';
import { useRigStore } from '../store/rig';
import { configHelper } from '../utils/configHelper';

export interface ConnectionFormState {
  host: string;
  port: number;
  model: number | undefined;
  device: string | undefined;
}

const connectionForm = ref<ConnectionFormState>({
  host: 'localhost',
  port: 4532,
  model: undefined,
  device: undefined,
});

export const useRigctldConnectionForm = () => {
  const rigStore = useRigStore();

  const loadRigConfig = async () => {
    await configHelper.initSettings();
    const rigModelNumber = configHelper.getSetting(['rig'], 'rigModel');
    connectionForm.value.host = configHelper.getSetting(['rig'], 'host') || 'localhost';
    connectionForm.value.port = configHelper.getSetting(['rig'], 'port') || 4532;
    connectionForm.value.model = rigModelNumber;
    connectionForm.value.device = configHelper.getSetting(['rig'], 'device');
  };

  const saveSettings = async (options?: { restartOnModelChange?: boolean }) => {
    await configHelper.initSettings();
    const currentModel = configHelper.getSetting(['rig'], 'rigModel');
    const modelChanged = currentModel !== connectionForm.value.model;
    await configHelper.updateSetting(['rig'], 'host', connectionForm.value.host);
    await configHelper.updateSetting(['rig'], 'port', connectionForm.value.port);
    if (connectionForm.value.model) {
      await configHelper.updateSetting(['rig'], 'rigModel', connectionForm.value.model);
    }
    if (connectionForm.value.device) {
      await configHelper.updateSetting(['rig'], 'device', connectionForm.value.device);
    }
    if (options?.restartOnModelChange && modelChanged) {
      try {
        const response = await window.electronAPI.rigctldRestart();
        if (!response.success) {
          console.error('Failed to restart rigctld:', response.error);
        }
      } catch (error) {
        console.error('Error restarting rigctld:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const connectWithSettings = async () => {
    await rigStore.connect(
      connectionForm.value.host,
      connectionForm.value.port,
      connectionForm.value.model,
      connectionForm.value.device
    );
  };

  return {
    connectionForm,
    loadRigConfig,
    saveSettings,
    connectWithSettings,
  };
};
