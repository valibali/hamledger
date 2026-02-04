<script lang="ts">
import { useQsoStore } from '../../store/qso';
import { QsoEntry } from '../../types/qso';
import { StationData } from '../../types/station';
import QsoEditDialog from './QsoEditDialog.vue';
import { resolveStationLocation } from '../../utils/stationLocation';
import BaseModal from './BaseModal.vue';
import { LMap, LTileLayer, LCircleMarker, LTooltip } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'QsoDetailDialog',
  components: {
    QsoEditDialog,
    BaseModal,
    LMap,
    LTileLayer,
    LCircleMarker,
    LTooltip,
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
          await this.qsoStore.fetchStationInfo(this.qso.callsign, { preferred: this.qso });
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
        await this.qsoStore.fetchStationInfo(this.qso.callsign, { preferred: this.qso });
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
      if (updatedQso) {
        // Emit the updated QSO to parent component
        this.$emit('qso-updated', updatedQso);
        // Refresh station info after edit
        if (updatedQso.callsign) {
          this.isLoading = true;
          this.mapLoaded = false;
          try {
            await this.qsoStore.fetchStationInfo(updatedQso.callsign, { preferred: updatedQso });
            this.stationInfo = this.qsoStore.stationInfo;
          } catch (error) {
            console.warn('Failed to fetch station info, using offline data:', error);
            this.stationInfo = this.getOfflineStationInfo();
          }
          this.isLoading = false;
        }
      }
    },
    onMapReady() {
      this.mapLoaded = true;
    },
    getResolvedCountry() {
      return resolveStationLocation({
        callsign: this.qso.callsign,
        qth: this.stationInfo?.baseData?.qth || this.qso.qth,
        country: this.stationInfo?.baseData?.country || this.qso.country,
      }).country || 'N/A';
    },
    getResolvedLocation() {
      return resolveStationLocation({
        callsign: this.qso.callsign,
        qth: this.stationInfo?.baseData?.qth || this.qso.qth,
        country: this.stationInfo?.baseData?.country || this.qso.country,
      }).label || 'N/A';
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
  <BaseModal
    :open="show"
    title="QSO Details"
    width="min(880px, 94vw)"
    height="min(90vh, 900px)"
    :close-on-esc="!showEditMode"
    :close-on-backdrop="!showEditMode"
    :on-close="close"
  >
    <template #header>
      <div class="dialog-header">
        <h2>QSO Details</h2>
        <button class="panel-action" type="button" @click="toggleEditMode">
          {{ showEditMode ? 'View Details' : 'Edit QSO' }}
        </button>
      </div>
    </template>

      <QsoEditDialog
        v-if="showEditMode"
        :qso="qso"
        :show="true"
        @close="onEditComplete"
        @qso-saved="onEditComplete"
      />

      <div v-else class="qso-details">
        <div v-if="!stationInfo || !stationInfo.baseData" class="offline-notice">
          <p>⚠️ Station data unavailable (offline mode)</p>
        </div>
        <div class="main-info">
          <div class="callsign-section">
            <h3>{{ qso.callsign }}</h3>
            <img
              v-if="stationInfo?.flag"
              :src="stationInfo.flag"
              :alt="getResolvedCountry()"
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
                <span>{{ getResolvedCountry() }}</span>
              </div>
              <div class="info-item">
                <label>Grid Square</label>
                <span>{{ stationInfo.baseData?.grid || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <label>QTH</label>
                <span>{{ getResolvedLocation() }}</span>
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

          <div class="map-container">
            <div
              v-if="isLoading || !stationInfo.geodata?.lat"
              class="map-loading"
            >
              <div class="loading-spinner"></div>
              <p>Fetching location info...</p>
            </div>
            <LMap
              v-else
              class="qso-detail-map"
              :zoom="6"
              :center="[stationInfo.geodata.lat, stationInfo.geodata.lon]"
              :use-global-leaflet="false"
              @ready="onMapReady"
            >
              <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LCircleMarker
                :lat-lng="[stationInfo.geodata.lat, stationInfo.geodata.lon]"
                :radius="6"
                :color="'#ffa500'"
                :fill-color="'#ffa500'"
                :fill-opacity="0.7"
              >
                <LTooltip>{{ stationInfo.baseData?.qth || 'QTH' }}</LTooltip>
              </LCircleMarker>
            </LMap>
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

  </BaseModal>
</template>

<style scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.qso-details {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-height: 65vh;
  overflow: auto;
  padding-right: 0.4rem;
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
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  gap: 0.4rem;
}

.map-container {
  position: relative;
  border: 1px solid #555;
  border-radius: 3px;
  min-height: 300px;
  overflow: hidden;
}

.qso-detail-map {
  height: 300px;
  width: 100%;
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

.qsl-p {
  background: #fd7e14;
  color: #fff;
}

.qsl-l {
  background: #17a2b8;
  color: #fff;
}

.qsl-q {
  background: #9b59b6;
  color: #fff;
}
</style>
