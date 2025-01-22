import { defineStore } from 'pinia'

interface Mode {
  value: string
  label: string
}

export const useRigStore = defineStore('rig', {
  state: () => ({
    modes: [
      { value: 'CW', label: 'CW' },
      { value: 'LSB', label: 'LSB' },
      { value: 'USB', label: 'USB' },
      { value: 'AM', label: 'AM' },
      { value: 'FM', label: 'FM' },
      { value: 'DATA', label: 'DATA' }
    ] as Mode[],
    selectedMode: 'CW',
    frequency: '7.093 kHz',
    rigModel: 'YAESU FT-450A'
  }),
  actions: {
    handleReconnect() {
      console.log('Reconnecting...')
      // TODO: Implement actual reconnection logic
    },
    handleDisconnect() {
      console.log('Disconnecting...')
      // TODO: Implement actual disconnection logic
    },
    setMode(mode: string) {
      this.selectedMode = mode
      // TODO: Send mode change command to rig
    },
    setFrequency(freq: string) {
      this.frequency = freq
      // TODO: Send frequency change command to rig
    }
  }
})
