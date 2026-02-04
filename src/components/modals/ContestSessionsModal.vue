<script lang="ts">
import type { ContestSession } from '../../types/contest';
import BaseModal from './BaseModal.vue';

export default {
  name: 'ContestSessionsModal',
  components: { BaseModal },
  props: {
    open: { type: Boolean, required: true },
    sessions: { type: Array as () => ContestSession[], required: true },
    getSessionContestName: { type: Function, required: true },
    formatSessionDate: { type: Function, required: true },
    getSessionQsoCount: { type: Function, required: true },
    getSessionScore: { type: Function, required: true },
    getSessionAvgRate: { type: Function, required: true },
    isSessionActive: { type: Function, required: true },
    isSessionCompleted: { type: Function, required: true },
    onClose: { type: Function, required: true },
    onExportAdif: { type: Function, required: true },
    onOpenStats: { type: Function, required: true },
    onDelete: { type: Function, required: true },
  },
};
</script>

<template>
  <BaseModal
    :open="open"
    title="Contest Sessions"
    width="min(920px, 94vw)"
    height="min(60vh, 640px)"
    :on-close="onClose"
  >
    <div class="sessions-body">
      <div class="sessions-table">
        <div class="sessions-scroll">
          <table class="sessions-table-grid">
            <colgroup>
              <col class="col-contest" />
              <col class="col-type" />
              <col class="col-start" />
              <col class="col-end" />
              <col class="col-qsos" />
              <col class="col-score" />
              <col class="col-rate" />
              <col class="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th class="sessions-cell sessions-cell-contest">Contest</th>
                <th class="sessions-cell">Contest type</th>
                <th class="sessions-cell">Start</th>
                <th class="sessions-cell">End</th>
                <th class="sessions-cell">QSOs</th>
                <th class="sessions-cell">Score</th>
                <th class="sessions-cell">Avg rate</th>
                <th class="sessions-cell sessions-actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!sessions.length">
                <td class="sessions-empty" colspan="8">No archived sessions yet.</td>
              </tr>
              <tr
                v-for="session in sessions"
                :key="session.id"
                class="session-row"
                @click="onOpenStats(session.id)"
              >
                <td class="sessions-cell sessions-cell-contest session-name">
                  {{ getSessionContestName(session) }}
                  <span v-if="isSessionActive(session)" class="session-badge active">Active</span>
                  <span v-else-if="isSessionCompleted(session)" class="session-badge done"
                    >Completed</span
                  >
                </td>
                <td class="sessions-cell session-subline">
                  {{ session.setup.contestType || session.setup.logType }}
                </td>
                <td class="sessions-cell session-subline">
                  {{ formatSessionDate(session.startedAt || 'n/a') }}
                </td>
                <td class="sessions-cell session-subline">
                  {{ formatSessionDate(session.endedAt || 'n/a') }}
                </td>
                <td class="sessions-cell session-subline">{{ getSessionQsoCount(session.id) }}</td>
                <td class="sessions-cell session-subline">{{ getSessionScore(session.id) }}</td>
                <td class="sessions-cell session-subline">{{ getSessionAvgRate(session.id) }}</td>
                <td class="sessions-cell session-actions" @click.stop>
                  <div class="session-actions-inner">
                    <button
                      class="panel-action icon"
                      type="button"
                      title="Export ADIF"
                      aria-label="Export ADIF"
                      @click="onExportAdif(session.id)"
                    >
                      ⤓
                    </button>
                    <button
                      class="panel-action icon danger"
                      type="button"
                      title="Delete session"
                      aria-label="Delete session"
                      @click="onDelete(session.id)"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.sessions-body {
  display: flex;
  min-height: 0;
  max-height: 100%;
  flex: 1;
  flex-direction: column;
  width: 100%;
}

.sessions-table {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  width: 100%;
}

.sessions-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0;
  scrollbar-gutter: stable;
}

.sessions-table-grid {
  width: 100%;
  min-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.sessions-table-grid thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #1c1c1c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.65rem;
  text-align: left;
  padding: 0.45rem 0.3rem;
}

.col-contest {
  width: 25ch;
}

.col-type {
  width: auto;
}

.col-start {
  width: auto;
}

.col-end {
  width: auto;
}

.col-qsos {
  width: 6%;
}

.col-score {
  width: 7%;
}

.col-rate {
  width: auto;
}

.col-actions {
  width: 110px;
}

.sessions-cell {
  padding: 0.4rem 0.3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  white-space: normal;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  vertical-align: top;
}

.sessions-cell:last-child {
  border-right: none;
}

.sessions-cell-contest {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sessions-actions-header {
  text-align: center;
}

.session-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.45rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.session-badge.active {
  background: rgba(34, 197, 94, 0.18);
  border: 1px solid rgba(34, 197, 94, 0.5);
  color: #86efac;
}

.session-badge.done {
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #cbd5f5;
}

.sessions-table-grid tbody tr:last-child .sessions-cell {
  border-bottom: none;
}

.sessions-cell.session-actions {
  white-space: nowrap;
  text-align: center;
  overflow: visible;
}

.session-row {
  cursor: pointer;
}

.session-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.session-actions-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  flex-wrap: nowrap;
  min-width: 96px;
}

.sessions-cell.session-actions .panel-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  vertical-align: middle;
  min-width: 28px;
  padding: 0.2rem 0.35rem;
}

.sessions-empty {
  text-align: center;
  font-size: 0.85rem;
  color: #b0b0b0;
  padding: 1rem 0.1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}

</style>
