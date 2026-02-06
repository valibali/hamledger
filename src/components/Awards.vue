<script lang="ts">
import { useAwardsStore } from '../store/awards';
import { useQsoStore } from '../store/qso';
import { getAllEntities } from '../utils/dxccParser';
import { US_STATES } from '../data/usStates';
import type { AwardSummary, ModeCategory } from '../types/awards';
import DXCCMap from './awards/DXCCMap.vue';
import WASMap from './awards/WASMap.vue';
import WAZMap from './awards/WAZMap.vue';
import GridMap from './awards/GridMap.vue';
import StatisticsCharts from './awards/StatisticsCharts.vue';

export default {
  name: 'AwardsPage',
  components: {
    DXCCMap,
    WASMap,
    WAZMap,
    GridMap,
    StatisticsCharts,
  },
  data() {
    return {
      awardsStore: useAwardsStore(),
      qsoStore: useQsoStore(),
      activeTab: 'overview' as 'overview' | 'dxcc' | 'was' | 'waz' | 'grids',
      selectedMode: 'mixed' as ModeCategory,
      searchQuery: '',
      showWorked: true,
      showNeeded: true,
      showMap: true,
    };
  },
  computed: {
    awardSummaries(): AwardSummary[] {
      return this.awardsStore.awardSummaries;
    },
    stats() {
      return this.awardsStore.stats;
    },
    isCalculating() {
      return this.awardsStore.isCalculating;
    },
    calculationProgress() {
      return this.awardsStore.calculationProgress;
    },
    lastCalculated() {
      return this.awardsStore.lastCalculated;
    },
    recentAchievements() {
      return this.awardsStore.allAchievements.slice(0, 10);
    },
    
    // DXCC entities list
    dxccEntities() {
      const entities = getAllEntities();
      const workedSet = this.awardsStore.dxcc[this.selectedMode];
      
      return entities
        .map(e => ({
          ...e,
          worked: workedSet.has(e.entityCode),
        }))
        .filter(e => {
          if (!this.showWorked && e.worked) return false;
          if (!this.showNeeded && !e.worked) return false;
          if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            return e.name.toLowerCase().includes(query) || 
                   e.primaryPrefix.toLowerCase().includes(query);
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    
    // US states list
    usStates() {
      const workedSet = this.awardsStore.was[this.selectedMode];
      
      return US_STATES
        .map(s => ({
          ...s,
          worked: workedSet.has(s.code),
        }))
        .filter(s => {
          if (!this.showWorked && s.worked) return false;
          if (!this.showNeeded && !s.worked) return false;
          if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            return s.name.toLowerCase().includes(query) || 
                   s.code.toLowerCase().includes(query);
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    
    // CQ zones list
    cqZones() {
      const workedSet = this.awardsStore.waz[this.selectedMode];
      
      return Array.from({ length: 40 }, (_, i) => ({
        zone: i + 1,
        worked: workedSet.has(i + 1),
      }))
        .filter(z => {
          if (!this.showWorked && z.worked) return false;
          if (!this.showNeeded && !z.worked) return false;
          return true;
        });
    },
    
    // Grid squares list
    gridSquares() {
      return Array.from(this.awardsStore.grids.fourChar).sort();
    },
    
  },
  methods: {
    async recalculateAwards() {
      await this.awardsStore.calculateFromLog(this.qsoStore.allQsos);
    },
    formatDate(date: Date | string | null): string {
      if (!date) return 'Never';
      const d = new Date(date);
      return d.toLocaleString();
    },
    getProgressBarWidth(current: number, total: number): string {
      return `${Math.min(100, (current / total) * 100)}%`;
    },
    getProgressColor(percentage: number): string {
      if (percentage >= 100) return '#4caf50';
      if (percentage >= 75) return '#8bc34a';
      if (percentage >= 50) return '#ffc107';
      if (percentage >= 25) return '#ff9800';
      return '#f44336';
    },
  },
  async mounted() {
    // Calculate awards if not done yet
    if (!this.awardsStore.lastCalculated && this.qsoStore.allQsos.length > 0) {
      await this.recalculateAwards();
    }
  },
};
</script>

<template>
  <main class="awards-container">
    <div class="awards-header">
      <h2 class="section-title">Awards and Statistics</h2>
      <div class="header-actions">
        <button 
          class="btn btn-primary" 
          @click="recalculateAwards" 
          :disabled="isCalculating"
        >
          {{ isCalculating ? 'Calculating...' : 'Recalculate' }}
        </button>
        <span v-if="lastCalculated" class="last-updated">
          Last updated: {{ formatDate(lastCalculated) }}
        </span>
      </div>
    </div>

    <!-- Progress bar during calculation -->
    <div v-if="isCalculating" class="calculation-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: calculationProgress + '%' }"></div>
      </div>
      <span class="progress-text">{{ calculationProgress }}%</span>
    </div>

    <!-- Tabs -->
    <div class="awards-tabs">
      <button 
        :class="['tab-btn', { active: activeTab === 'overview' }]"
        @click="activeTab = 'overview'"
      >
        Overview
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'dxcc' }]"
        @click="activeTab = 'dxcc'"
      >
        DXCC ({{ awardsStore.dxccMixedCount }})
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'was' }]"
        @click="activeTab = 'was'"
      >
        WAS ({{ awardsStore.wasMixedCount }}/50)
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'waz' }]"
        @click="activeTab = 'waz'"
      >
        WAZ ({{ awardsStore.wazMixedCount }}/40)
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'grids' }]"
        @click="activeTab = 'grids'"
      >
        Grids ({{ awardsStore.gridsFourCharCount }})
      </button>
    </div>

    <div class="awards-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="tab-content overview-tab">
        <!-- Award Progress Cards -->
        <div class="progress-cards">
          <div v-for="award in awardSummaries" :key="award.name" class="progress-card">
            <div class="card-header">
              <h3>{{ award.name }}</h3>
              <span class="percentage">{{ award.percentage }}%</span>
            </div>
            <p class="card-description">{{ award.description }}</p>
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ 
                    width: getProgressBarWidth(award.current, award.total),
                    backgroundColor: getProgressColor(award.percentage)
                  }"
                ></div>
              </div>
              <span class="progress-text">{{ award.current }} / {{ award.total }}</span>
            </div>
            <div class="mode-breakdown">
              <span class="mode-item">Mixed: {{ award.byMode.mixed }}</span>
              <span class="mode-item">CW: {{ award.byMode.cw }}</span>
              <span class="mode-item">Phone: {{ award.byMode.phone }}</span>
              <span class="mode-item">Digital: {{ award.byMode.digital }}</span>
            </div>
          </div>
          
          <!-- Grid Squares Card -->
          <div class="progress-card">
            <div class="card-header">
              <h3>Grid Squares</h3>
            </div>
            <p class="card-description">Unique grid squares worked</p>
            <div class="grid-stats">
              <div class="stat-item">
                <span class="stat-value">{{ awardsStore.gridsFourCharCount }}</span>
                <span class="stat-label">4-char grids</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ awardsStore.gridsSixCharCount }}</span>
                <span class="stat-label">6-char grids</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics Charts -->
        <StatisticsCharts />

        <!-- Recent Achievements -->
        <div v-if="recentAchievements.length > 0" class="recent-achievements">
          <h3>Recent Achievements</h3>
          <div class="achievement-list">
            <div 
              v-for="achievement in recentAchievements" 
              :key="achievement.id" 
              class="achievement-item"
            >
              <span class="achievement-icon">
                <template v-if="achievement.type === 'dxcc'">🌍</template>
                <template v-else-if="achievement.type === 'was'">🇺🇸</template>
                <template v-else-if="achievement.type === 'waz'">🗺️</template>
                <template v-else-if="achievement.type === 'grid'">📍</template>
                <template v-else>🏆</template>
              </span>
              <div class="achievement-info">
                <span class="achievement-title">{{ achievement.title }}</span>
                <span class="achievement-description">{{ achievement.description }}</span>
              </div>
              <span class="achievement-time">{{ formatDate(achievement.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- DXCC Tab -->
      <div v-else-if="activeTab === 'dxcc'" class="tab-content dxcc-tab">
        <div class="filter-bar">
          <select v-model="selectedMode" class="mode-select">
            <option value="mixed">All Modes</option>
            <option value="cw">CW Only</option>
            <option value="phone">Phone Only</option>
            <option value="digital">Digital Only</option>
          </select>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search entities..." 
            class="search-input"
          />
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showWorked" /> Worked
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showNeeded" /> Needed
          </label>
          <button 
            :class="['view-toggle', { active: showMap }]" 
            @click="showMap = !showMap"
          >
            {{ showMap ? 'List View' : 'Map View' }}
          </button>
        </div>
        
        <!-- Map View -->
        <DXCCMap v-if="showMap" :key="'dxcc-map-' + selectedMode" :selected-mode="selectedMode" :show-worked="showWorked" :show-needed="showNeeded" />
        
        <!-- List View -->
        <template v-else>
          <div class="entity-list">
            <div 
              v-for="entity in dxccEntities" 
              :key="entity.entityCode" 
              :class="['entity-item', { worked: entity.worked }]"
            >
              <span class="entity-prefix">{{ entity.primaryPrefix }}</span>
              <span class="entity-name">{{ entity.name }}</span>
              <span class="entity-continent">{{ entity.continent }}</span>
              <span class="entity-zone">CQ {{ entity.cqZone }}</span>
              <span :class="['entity-status', entity.worked ? 'status-worked' : 'status-needed']">
                {{ entity.worked ? 'Worked' : 'Needed' }}
              </span>
            </div>
          </div>
          
          <div class="list-summary">
            Showing {{ dxccEntities.length }} entities 
            ({{ dxccEntities.filter(e => e.worked).length }} worked, 
            {{ dxccEntities.filter(e => !e.worked).length }} needed)
          </div>
        </template>
      </div>

      <!-- WAS Tab -->
      <div v-else-if="activeTab === 'was'" class="tab-content was-tab">
        <div class="filter-bar">
          <select v-model="selectedMode" class="mode-select">
            <option value="mixed">All Modes</option>
            <option value="cw">CW Only</option>
            <option value="phone">Phone Only</option>
            <option value="digital">Digital Only</option>
          </select>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search states..." 
            class="search-input"
          />
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showWorked" /> Worked
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showNeeded" /> Needed
          </label>
          <button 
            :class="['view-toggle', { active: showMap }]" 
            @click="showMap = !showMap"
          >
            {{ showMap ? 'Grid View' : 'Map View' }}
          </button>
        </div>
        
        <!-- Map View -->
        <WASMap v-if="showMap" :key="'was-map-' + selectedMode" :selected-mode="selectedMode" :show-worked="showWorked" :show-needed="showNeeded" />
        
        <!-- Grid View -->
        <template v-else>
          <div class="state-grid">
            <div 
              v-for="state in usStates" 
              :key="state.code" 
              :class="['state-item', { worked: state.worked }]"
            >
              <span class="state-code">{{ state.code }}</span>
              <span class="state-name">{{ state.name }}</span>
            </div>
          </div>
          
          <div class="list-summary">
            {{ usStates.filter(s => s.worked).length }} / 50 states worked
          </div>
        </template>
      </div>

      <!-- WAZ Tab -->
      <div v-else-if="activeTab === 'waz'" class="tab-content waz-tab">
        <div class="filter-bar">
          <select v-model="selectedMode" class="mode-select">
            <option value="mixed">All Modes</option>
            <option value="cw">CW Only</option>
            <option value="phone">Phone Only</option>
            <option value="digital">Digital Only</option>
          </select>
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showWorked" /> Worked
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" v-model="showNeeded" /> Needed
          </label>
          <button
            :class="['view-toggle', { active: showMap }]"
            @click="showMap = !showMap"
          >
            {{ showMap ? 'Grid View' : 'Map View' }}
          </button>
        </div>

        <!-- Map View -->
        <WAZMap v-if="showMap" :key="'waz-map-' + selectedMode" :selected-mode="selectedMode" :show-worked="showWorked" :show-needed="showNeeded" />

        <!-- Grid View -->
        <template v-else>
          <div class="zone-grid">
            <div
              v-for="zone in cqZones"
              :key="zone.zone"
              :class="['zone-item', { worked: zone.worked }]"
            >
              <span class="zone-number">{{ zone.zone }}</span>
            </div>
          </div>

          <div class="list-summary">
            {{ cqZones.filter(z => z.worked).length }} / 40 zones worked
          </div>
        </template>
      </div>

      <!-- Grids Tab -->
      <div v-else-if="activeTab === 'grids'" class="tab-content grids-tab">
        <GridMap key="grid-map" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.awards-container {
  background: #333;
  border-radius: 5px;
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.awards-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.last-updated {
  font-size: 0.8rem;
  color: var(--gray-color);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-primary {
  background: var(--main-color);
  color: #000;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.calculation-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--main-color);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--gray-color);
  min-width: 40px;
}

/* Tabs */
.awards-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.5rem 1rem;
  background: #444;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #555;
}

.tab-btn.active {
  background: var(--main-color);
  color: #000;
  border-color: var(--main-color);
}

.awards-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tab-content {
  padding: 0.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.overview-tab {
  gap: 1rem;
}

.dxcc-tab,
.was-tab,
.waz-tab,
.grids-tab {
  overflow: hidden;
}

/* Ensure map components fill their containers */
.dxcc-tab > :deep(.dxcc-map-container),
.was-tab > :deep(.was-map-container),
.waz-tab > :deep(.waz-map-container),
.grids-tab > :deep(.grid-map-container) {
  flex: 1;
  min-height: 0;
}

/* Progress Cards */
.progress-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.progress-card {
  background: #3a3a3a;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #444;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.percentage {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--main-color);
}

.card-description {
  font-size: 0.85rem;
  color: var(--gray-color);
  margin: 0 0 1rem 0;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.progress-bar-container .progress-bar {
  flex: 1;
  height: 12px;
}

.mode-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.mode-item {
  background: #444;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #aaa;
}

.grid-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--main-color);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--gray-color);
}

/* Recent Achievements */
.recent-achievements {
  background: #3a3a3a;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #444;
}

.recent-achievements h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #444;
  border-radius: 4px;
}

.achievement-icon {
  font-size: 1.5rem;
}

.achievement-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.achievement-title {
  font-weight: bold;
  font-size: 0.9rem;
}

.achievement-description {
  font-size: 0.8rem;
  color: var(--gray-color);
}

.achievement-time {
  font-size: 0.75rem;
  color: var(--gray-color);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.mode-select, .search-input {
  padding: 0.5rem;
  background: #444;
  border: 1px solid #555;
  border-radius: 4px;
  color: #fff;
}

.search-input {
  min-width: 200px;
}

.view-toggle {
  padding: 0.5rem 1rem;
  background: #444;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}

.view-toggle:hover {
  background: #555;
}

.view-toggle.active {
  background: var(--main-color);
  color: #000;
  border-color: var(--main-color);
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: #ccc;
  cursor: pointer;
}

/* Entity List */
.entity-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: calc(100vh - 350px);
  overflow-y: auto;
}

.entity-item {
  display: grid;
  grid-template-columns: 60px 1fr 50px 60px 80px;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #3a3a3a;
  border-radius: 4px;
  align-items: center;
  font-size: 0.9rem;
}

.entity-item.worked {
  background: rgba(76, 175, 80, 0.1);
  border-left: 3px solid #4caf50;
}

.entity-prefix {
  font-weight: bold;
  color: var(--main-color);
}

.entity-continent, .entity-zone {
  color: var(--gray-color);
  font-size: 0.8rem;
}

.entity-status {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-align: center;
}

.status-worked {
  background: #4caf50;
  color: #000;
}

.status-needed {
  background: #555;
  color: #aaa;
}

/* State Grid */
.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.state-item {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: #3a3a3a;
  border-radius: 4px;
  text-align: center;
}

.state-item.worked {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid #4caf50;
}

.state-code {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--main-color);
}

.state-name {
  font-size: 0.8rem;
  color: var(--gray-color);
}

/* Zone Grid */
.zone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.5rem;
}

.zone-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #3a3a3a;
  border-radius: 4px;
}

.zone-item.worked {
  background: #4caf50;
}

.zone-number {
  font-size: 1.2rem;
  font-weight: bold;
}

.zone-item.worked .zone-number {
  color: #000;
}

/* Grid List */
.grid-summary {
  margin-bottom: 1rem;
}

.grid-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.grid-badge {
  padding: 0.3rem 0.6rem;
  background: #4caf50;
  color: #000;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}

.list-summary {
  margin-top: 1rem;
  padding: 0.5rem;
  background: #3a3a3a;
  border-radius: 4px;
  font-size: 0.9rem;
  color: var(--gray-color);
  text-align: center;
}
</style>
