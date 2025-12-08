<script lang="ts">
import { useQsoStore } from '../../store/qso';
import { QsoEntry } from '../../types/qso';
import { StationData } from '../../types/station';
import QsoEditDialog from './QsoEditDialog.vue';

export default {
  name: 'QsoDetailDialog',
  components: {
    QsoEditDialog,
  },
  props: {
    qso: {
      type: Object as () => QsoEntry,
      required: true,
    },
    show: {
      type: Boolean,
      required: true,
    },
  },
  setup() {
    const qsoStore = useQsoStore();
    return { qsoStore };
  },
  data() {
    return {
      showEditMode: false,
      stationInfo: {} as StationData,
      isLoading: true,
      mapLoaded: false,
    };
  },
  watch: {
    async show(newVal) {
      if (newVal && this.qso.callsign) {
        this.isLoading = true;
        this.mapLoaded = false;
        try {
          await this.qsoStore.fetchStationInfo(this.qso.callsign);
          this.stationInfo = this.qsoStore.stationInfo;
        } catch (error) {
          console.warn('Failed to fetch station info, using offline data:', error);
          this.stationInfo = this.getOfflineStationInfo();
        }
        this.isLoading = false;
      }
    },
  },
  async created() {
    if (this.show && this.qso.callsign) {
      this.isLoading = true;
      this.mapLoaded = false;
      try {
        await this.qsoStore.fetchStationInfo(this.qso.callsign);
        this.stationInfo = this.qsoStore.stationInfo;
      } catch (error) {
        console.warn('Failed to fetch station info, using offline data:', error);
        this.stationInfo = this.getOfflineStationInfo();
      }
      this.isLoading = false;
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    toggleEditMode() {
      this.showEditMode = !this.showEditMode;
    },
    async onEditComplete(updatedQso) {
      this.showEditMode = false;
      // Emit the updated QSO to parent component
      this.$emit('qso-updated', updatedQso);
      // Refresh station info after edit
      if (updatedQso.callsign) {
        this.isLoading = true;
        this.mapLoaded = false;
        try {
          await this.qsoStore.fetchStationInfo(updatedQso.callsign);
          this.stationInfo = this.qsoStore.stationInfo;
        } catch (error) {
          console.warn('Failed to fetch station info, using offline data:', error);
          this.stationInfo = this.getOfflineStationInfo();
        }
        this.isLoading = false;
      }
    },
    onMapLoad() {
      this.mapLoaded = true;
    },
    getOfflineStationInfo() {
      // Create basic station info from QSO data when offline
      return {
        baseData: {
          country: 'N/A',
          grid: this.qso.grid || 'N/A',
          qth: this.qso.qth || 'N/A',
          name: this.qso.name || 'N/A',
        },
        flag: '',
        weather: 'N/A (Offline)',
        localTime: 'N/A (Offline)',
        geodata: {
          lat: null,
          lon: null,
        },
        distance: null,
      };
    },
  },
};
</script>

<template>
  <div v-if="show" class="dialog-overlay" @click="close">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h2>QSO Details</h2>
        <button class="edit-btn" @click="toggleEditMode">
          {{ showEditMode ? 'View Details' : 'Edit QSO' }}
        </button>
      </div>

      <QsoEditDialog
        v-if="showEditMode"
        :qso="qso"
        :show="true"
        @close="onEditComplete"
        @qso-saved="onEditComplete"
      />

      <div v-else class="qso-details">
        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <p>Loading station data...</p>
        </div>
        <div v-else-if="!stationInfo || !stationInfo.baseData" class="offline-notice">
          <p>⚠️ Station data unavailable (offline mode)</p>
        </div>
        <div class="main-info">
          <div class="callsign-section">
            <h3>{{ qso.callsign }}</h3>
            <img
              v-if="stationInfo?.flag"
              :src="stationInfo.flag"
              :alt="stationInfo?.baseData?.country"
              class="country-flag"
            />
            <div class="station-name">{{ stationInfo?.baseData?.name }}</div>
          </div>

          <div class="qso-info">
            <div class="info-grid">
              <div class="info-item">
                <label>Date/Time (UTC)</label>
                <span>{{ new Date(qso.datetime).toUTCString() }}</span>
              </div>
              <div class="info-item">
                <label>Band</label>
                <span>{{ qso.band }}</span>
              </div>
              <div class="info-item">
                <label>Mode</label>
                <span>{{ qso.mode }}</span>
              </div>
              <div class="info-item">
                <label>Frequency RX</label>
                <span>{{ qso.freqRx }} MHz</span>
              </div>
              <div class="info-item">
                <label>Frequency TX</label>
                <span>{{ qso.freqTx }} MHz</span>
              </div>
              <div class="info-item">
                <label>RST Received</label>
                <span>{{ qso.rstr }}</span>
              </div>
              <div class="info-item">
                <label>RST Sent</label>
                <span>{{ qso.rstt }}</span>
              </div>
              <div class="info-item">
                <label>QSL Status</label>
                <span class="qsl-status" :class="'qsl-' + (qso.qslStatus || 'N').toLowerCase()">
                  {{ qso.qslStatus || 'N' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="station-details" v-if="stationInfo && stationInfo.baseData">
          <div class="location-info">
            <h4>Location Information</h4>
            <div class="info-grid">
              <div class="info-item">
                <label>Country</label>
                <span>{{ stationInfo.baseData?.country || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <label>Grid Square</label>
                <span>{{ stationInfo.baseData?.grid || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <label>QTH</label>
                <span>{{ stationInfo.baseData?.qth || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <label>Local Time</label>
                <span>{{ stationInfo.localTime }}</span>
              </div>
              <div class="info-item">
                <label>Weather</label>
                <span>{{ stationInfo.weather }}</span>
              </div>
              <div class="info-item">
                <label>Distance</label>
                <span v-if="stationInfo.distance">{{ Math.round(stationInfo.distance) }} km</span>
              </div>
            </div>
          </div>

          <div class="map-container" v-if="stationInfo.geodata?.lat">
            <div v-if="!mapLoaded" class="map-loading">
              <div class="loading-spinner"></div>
              <p>Loading map...</p>
            </div>
            <iframe
              width="100%"
              height="300"
              frameborder="0"
              scrolling="no"
              marginheight="0"
              marginwidth="0"
              :src="
                'https://www.openstreetmap.org/export/embed.html?bbox=' +
                (stationInfo.geodata?.lon - 1) +
                '%2C' +
                (stationInfo.geodata?.lat - 1) +
                '%2C' +
                (stationInfo.geodata?.lon + 1) +
                '%2C' +
                (stationInfo.geodata?.lat + 1) +
                '&layer=mapnik&marker=' +
                stationInfo.geodata?.lat +
                '%2C' +
                stationInfo.geodata?.lon
              "
              @load="onMapLoad"
            ></iframe>
          </div>
        </div>

        <div class="notes-section">
          <h4>Notes</h4>
          <div class="remark">
            <label>Remark</label>
            <p>{{ qso.remark }}</p>
          </div>
          <div class="notes">
            <label>Additional Notes</label>
            <p>{{ qso.notes }}</p>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button class="close-btn" @click="close">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: #333;
  padding: 2rem;
  border-radius: 5px;
  width: 80%;
  max-width: 1000px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.edit-btn {
  background: var(--main-color);
  color: #000;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}

.qso-details {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.main-info {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
}

.callsign-section {
  text-align: center;
}

.callsign-section h3 {
  font-size: 2rem;
  margin: 0 0 1rem 0;
}

.country-flag {
  max-width: 200px;
  border: 1px solid #555;
  border-radius: 3px;
  margin: 1rem 0;
}

.station-name {
  font-size: 1.2rem;
  color: var(--gray-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.info-item label {
  color: var(--gray-color);
  font-size: 0.9rem;
}

.station-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notes-section h4 {
  margin: 0;
}

.remark,
.notes {
  background: #444;
  padding: 1rem;
  border-radius: 3px;
}

.remark label,
.notes label {
  color: var(--gray-color);
  font-size: 0.9rem;
  display: block;
  margin-bottom: 0.5rem;
}

.remark p,
.notes p {
  margin: 0;
  white-space: pre-wrap;
}

.dialog-actions {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
}

.close-btn {
  background: #555;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(51, 51, 51, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #555;
  border-top: 4px solid var(--main-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.map-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(51, 51, 51, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.map-container {
  position: relative;
  border: 1px solid #555;
  border-radius: 3px;
  overflow: hidden;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.offline-notice {
  background: #444;
  border: 1px solid #666;
  border-radius: 3px;
  padding: 1rem;
  text-align: center;
  color: var(--gray-color);
  margin: 1rem 0;
}

.offline-notice p {
  margin: 0;
}

.qsl-status {
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: bold;
  text-align: center;
  display: inline-block;
  min-width: 20px;
}

.qsl-n {
  background: #e74c3c;
  color: #fff;
}

.qsl-s {
  background: #f39c12;
  color: #fff;
}

.qsl-r {
  background: #27ae60;
  color: #fff;
}

.qsl-b {
  background: #3498db;
  color: #fff;
}

.qsl-q {
  background: #9b59b6;
  color: #fff;
}
</style>
