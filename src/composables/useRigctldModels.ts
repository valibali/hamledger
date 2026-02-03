import { computed, ref } from 'vue';
import type { RigModel } from '../types/rig';

interface GroupedModel {
  name: string;
  models: RigModel[];
}

const parseRigModels = (output: string): RigModel[] => {
  const lines = output.split('\n');
  const models: RigModel[] = [];

  for (const line of lines) {
    if (line.trim() === '' || line.includes('Rig #') || line.includes('---')) {
      continue;
    }

    const match = line.match(
      /^\s*(\d+)\s+([^\s]+)\s+(.+?)\s+\d{8}\.\d+\s+(Alpha|Beta|Stable|Untested)\s+/
    );
    if (match) {
      const [, id, manufacturer, model, status] = match;
      models.push({
        id: parseInt(id),
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        status: status.trim(),
      });
    }
  }

  return models;
};

const rigModels = ref<RigModel[]>([]);
const loadingModels = ref(false);

export const useRigctldModels = () => {

  const groupedModels = computed<GroupedModel[]>(() => {
    const grouped = new Map<string, GroupedModel>();

    for (const model of rigModels.value) {
      if (!grouped.has(model.manufacturer)) {
        grouped.set(model.manufacturer, { name: model.manufacturer, models: [] });
      }
      grouped.get(model.manufacturer)!.models.push(model);
    }

    const result = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
    result.forEach(group => {
      group.models.sort((a, b) => a.model.localeCompare(b.model));
    });

    return result;
  });

  const loadRigModels = async () => {
    loadingModels.value = true;
    try {
      const response = await window.electronAPI.executeCommand('rigctld -l');
      if (response.success && response.data) {
        rigModels.value = parseRigModels(response.data);
      } else {
        console.error('Failed to load rig models:', response.error);
      }
    } catch (error) {
      console.error('Error loading rig models:', error);
    } finally {
      loadingModels.value = false;
    }
  };

  return {
    rigModels,
    loadingModels,
    groupedModels,
    loadRigModels,
  };
};
