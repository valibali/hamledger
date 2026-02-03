import { onBeforeUnmount, onMounted, ref } from 'vue';
import { usePropagationStore } from '../store/propagation';
import { useWeatherStore } from '../store/weather';
import { DateHelper } from '../utils/dateHelper';
import { configHelper } from '../utils/configHelper';
import { MaidenheadLocator } from '../utils/maidenhead';

export function usePropClockWeather(refreshMs: number = 2 * 60 * 1000) {
  const propStore = usePropagationStore();
  const weatherStore = useWeatherStore();
  const utcTime = ref('00:00:00');
  let clockInterval: number | undefined;
  let dataRefreshInterval: number | undefined;

  const updateUTCClock = () => {
    utcTime.value = DateHelper.getCurrentUTCTime();
  };

  const loadLocalWeather = async () => {
    try {
      await configHelper.initSettings();
      const grid = configHelper.getSetting(['station'], 'grid');

      if (grid) {
        const coords = MaidenheadLocator.gridToLatLon(grid);
        await weatherStore.updateWeatherInfo(coords.lat, coords.lon);
      }
    } catch (error) {
      console.error('Error loading local weather:', error);
    }
  };

  onMounted(async () => {
    updateUTCClock();
    clockInterval = window.setInterval(updateUTCClock, 1000);
    await propStore.updatePropagationData();
    await loadLocalWeather();

    dataRefreshInterval = window.setInterval(() => {
      propStore.updatePropagationData();
      loadLocalWeather();
    }, refreshMs);
  });

  onBeforeUnmount(() => {
    if (clockInterval) window.clearInterval(clockInterval);
    if (dataRefreshInterval) window.clearInterval(dataRefreshInterval);
  });

  return {
    utcTime,
    propStore,
    weatherStore,
  };
}
