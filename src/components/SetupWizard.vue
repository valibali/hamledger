<script lang="ts">
import { CallsignHelper } from '../utils/callsign';
import { getSelectableBands, DEFAULT_HF_BAND_SHORT_NAMES, VHF_UHF_BAND_SHORT_NAMES, MICROWAVE_BAND_SHORT_NAMES } from '../utils/bands';
import { MaidenheadLocator } from '../utils/maidenhead';
import defaultSettings from '../settings.json';

interface WizardData {
  callsign: string;
  qth: string;
  locator: string;
  iaruRegion: 'IARU1' | 'IARU2' | 'IARU3';
  selectedBands: string[];
  importAdif: boolean;
  enableQrz: boolean;
  qrzUsername: string;
  qrzPassword: string;
  enableCat: boolean;
  rigctldPath: string;
}

export default {
  name: 'SetupWizard',
  emits: ['complete'],
  data() {
    return {
      currentStep: 1,
      totalSteps: 6,
      wizardData: {
        callsign: '',
        qth: '',
        locator: '',
        iaruRegion: 'IARU1',
        selectedBands: ['80', '40', '20', '15', '10'], // Default HF bands
        importAdif: false,
        enableQrz: false,
        qrzUsername: '',
        qrzPassword: '',
        enableCat: false,
        rigctldPath: 'rigctld',
      } as WizardData,
      isValidating: false,
      validationErrors: {} as Record<string, string>,
      importStatus: {
        isImporting: false,
        importedCount: 0,
        totalCount: 0,
        error: null as string | null,
        success: false,
      },
      hamlibStatus: {
        isInstalling: false,
        downloadProgress: 0,
        error: null as string | null,
        success: false,
        isChecking: false,
        inPath: false,
        installedPath: null as string | null,
        pathUpdated: false,
      },
      dialoutStatus: {
        isChecking: false,
        inGroup: false,
        error: null as string | null,
      },
      rigctldStatus: {
        isChecking: false,
        found: false,
        error: null as string | null,
      },
      firewallStatus: {
        isConfiguring: false,
        success: false,
        error: null as string | null,
        userCancelled: false,
      },
      availableBands: getSelectableBands(),
      isWindows: navigator.platform.toLowerCase().includes('win'),
      isLinux: navigator.platform.toLowerCase().includes('linux'),
    };
  },
  computed: {
    canProceed() {
      switch (this.currentStep) {
        case 1:
          return (
            this.wizardData.callsign.trim() !== '' &&
            this.wizardData.qth.trim() !== '' &&
            !this.validationErrors.callsign
          );
        case 2:
          return !this.validationErrors.locator;
        case 3:
          return this.wizardData.selectedBands.length > 0;
        case 4:
          return !this.importStatus.isImporting; // Disable if import is running
        case 5:
          return (
            !this.wizardData.enableQrz ||
            (this.wizardData.qrzUsername.trim() !== '' && this.wizardData.qrzPassword.trim() !== '')
          );
        case 6:
          return (
            !this.wizardData.enableCat ||
            (this.wizardData.rigctldPath.trim() !== '' && !this.validationErrors.rigctldPath)
          );
        default:
          return false;
      }
    },
    isLastStep() {
      return this.currentStep === this.totalSteps;
    },
    locatorValidationClass() {
      const locator = this.wizardData.locator.trim();

      // If empty, no special styling (neutral)
      if (!locator) {
        return '';
      }

      // If valid, green background
      if (MaidenheadLocator.isValidLocatorFormat(locator)) {
        return 'valid';
      }

      // If invalid, red background
      return 'invalid';
    },
  },
  methods: {
    nextStep() {
      if (this.canProceed) {
        if (this.isLastStep) {
          this.completeSetup();
        } else {
          this.currentStep++;
        }
      }
    },
    handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.nextStep();
      }
    },
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
      }
    },
    validateCallsign() {
      const callsign = this.wizardData.callsign.trim().toUpperCase();
      if (!callsign) {
        this.validationErrors.callsign = 'Callsign is required';
        return false;
      }

      if (!CallsignHelper.isValidCallsign(callsign)) {
        this.validationErrors.callsign = 'Invalid callsign format';
        return false;
      }

      delete this.validationErrors.callsign;
      this.wizardData.callsign = callsign;
      return true;
    },
    validateLocator() {
      const locator = this.wizardData.locator.trim();

      // Empty locator is allowed (optional field)
      if (!locator) {
        delete this.validationErrors.locator;
        this.wizardData.locator = '';
        return true;
      }

      // Validate format using maidenhead utility
      if (!MaidenheadLocator.isValidLocatorFormat(locator)) {
        this.validationErrors.locator = 'Invalid locator format (e.g. JN97)';
        return false;
      }

      delete this.validationErrors.locator;
      this.wizardData.locator = MaidenheadLocator.normalizeLocator(locator);
      return true;
    },
    validateQrzCredentials() {
      if (!this.wizardData.enableQrz) {
        delete this.validationErrors.qrzUsername;
        delete this.validationErrors.qrzPassword;
        return true;
      }

      let isValid = true;

      if (!this.wizardData.qrzUsername.trim()) {
        this.validationErrors.qrzUsername = 'QRZ username is required';
        isValid = false;
      } else {
        delete this.validationErrors.qrzUsername;
      }

      if (!this.wizardData.qrzPassword.trim()) {
        this.validationErrors.qrzPassword = 'QRZ password is required';
        isValid = false;
      } else {
        delete this.validationErrors.qrzPassword;
      }

      return isValid;
    },
    async testRigctldPath() {
      if (!this.wizardData.enableCat) {
        delete this.validationErrors.rigctldPath;
        return true;
      }

      this.isValidating = true;
      try {
        const rigctldPath = this.wizardData.rigctldPath.trim();

        if (!rigctldPath) {
          this.validationErrors.rigctldPath = 'rigctld path is required';
          return false;
        }

        let result;

        if (this.isWindows) {
          // Check if it's an absolute path (contains : or starts with \ or /)
          if (
            rigctldPath.includes(':') ||
            rigctldPath.startsWith('\\') ||
            rigctldPath.startsWith('/')
          ) {
            // For absolute paths, check if the file exists directly
            result = await window.electronAPI.executeCommand(
              `if exist "${rigctldPath}" echo "exists"`
            );
          } else {
            // For relative paths or commands in PATH, use where
            result = await window.electronAPI.executeCommand(`where ${rigctldPath}`);
          }
        } else {
          // On Linux, use which for both cases
          result = await window.electronAPI.executeCommand(`which ${rigctldPath}`);
        }

        if (result.success && result.data && result.data.trim()) {
          delete this.validationErrors.rigctldPath;
          return true;
        } else {
          this.validationErrors.rigctldPath = 'rigctld not found in the specified path';
          return false;
        }
      } catch (error) {
        console.error('Error checking rigctld path:', error);
        this.validationErrors.rigctldPath = 'Error checking rigctld path';
        return false;
      } finally {
        this.isValidating = false;
      }
    },
    async checkRigctldInPath() {
      if (!this.isWindows) return;

      this.hamlibStatus.isChecking = true;
      try {
        const result = await window.electronAPI.checkRigctldInPath();
        this.hamlibStatus.inPath = result.inPath;
        if (result.inPath) {
          delete this.validationErrors.rigctldPath;
        } else {
          this.validationErrors.rigctldPath = 'rigctld not found in PATH';
        }
      } catch (error) {
        console.error('Error checking rigctld in PATH:', error);
        this.validationErrors.rigctldPath = 'Error checking rigctld availability';
      } finally {
        this.hamlibStatus.isChecking = false;
      }
    },
    async checkDialoutGroup() {
      if (!this.isLinux) return;

      this.dialoutStatus.isChecking = true;
      this.dialoutStatus.error = null;

      try {
        const result = await window.electronAPI.executeCommand('groups');
        if (result.success && result.data) {
          const groups = result.data.trim().split(/\s+/);
          this.dialoutStatus.inGroup = groups.includes('dialout');
        } else {
          this.dialoutStatus.error = 'Failed to check user groups';
        }
      } catch (error) {
        console.error('Error checking dialout group:', error);
        this.dialoutStatus.error = 'Error checking dialout group membership';
      } finally {
        this.dialoutStatus.isChecking = false;
      }
    },
    async checkRigctldAvailability() {
      if (!this.isLinux) return;

      this.rigctldStatus.isChecking = true;
      this.rigctldStatus.error = null;

      try {
        const result = await window.electronAPI.executeCommand('which rigctld');
        if (result.success && result.data && result.data.trim()) {
          this.rigctldStatus.found = true;
        } else {
          this.rigctldStatus.found = false;
        }
      } catch (error) {
        console.error('Error checking rigctld availability:', error);
        this.rigctldStatus.error = 'Error checking rigctld availability';
        this.rigctldStatus.found = false;
      } finally {
        this.rigctldStatus.isChecking = false;
      }
    },
    async downloadAndInstallHamlib() {
      this.hamlibStatus.isInstalling = true;
      this.hamlibStatus.error = null;
      this.hamlibStatus.downloadProgress = 0;

      try {
        // Listen for download progress
        window.electronAPI.onHamlibDownloadProgress?.(progress => {
          this.hamlibStatus.downloadProgress = progress.progress;
        });

        const result = await window.electronAPI.downloadAndInstallHamlib();

        if (result.success) {
          this.hamlibStatus.success = true;
          this.hamlibStatus.installedPath = result.path;
          this.hamlibStatus.pathUpdated = Boolean(result.pathUpdated);
          // Set rigctld path to the installed location
          this.wizardData.rigctldPath = `${result.path}/rigctld.exe`;
          delete this.validationErrors.rigctldPath;
          console.log('Hamlib installed successfully:', result.message);

          // Add firewall exceptions after successful installation
          try {
            const firewallResult = await window.electronAPI.addFirewallExceptions();
            if (firewallResult.success) {
              console.log('Firewall exceptions added successfully');
            } else if (firewallResult.userCancelled) {
              console.warn('User cancelled firewall configuration');
              // Could show a non-blocking notification here
            } else {
              console.warn('Failed to add firewall exceptions:', firewallResult.error);
            }
          } catch (firewallError) {
            console.warn('Failed to add firewall exceptions:', firewallError);
            // Don't fail the installation if firewall configuration fails
          }
        } else {
          this.hamlibStatus.error = result.error || 'Installation failed';
        }
      } catch (error) {
        console.error('Error installing Hamlib:', error);
        this.hamlibStatus.error = 'An unexpected error occurred during installation';
      } finally {
        this.hamlibStatus.isInstalling = false;
      }
    },
    toggleBand(bandShortName: string) {
      const index = this.wizardData.selectedBands.indexOf(bandShortName);
      if (index > -1) {
        this.wizardData.selectedBands.splice(index, 1);
      } else {
        this.wizardData.selectedBands.push(bandShortName);
      }
    },
    selectAllHFBands() {
      this.wizardData.selectedBands = [...DEFAULT_HF_BAND_SHORT_NAMES];
    },
    selectAllVHFUHFBands() {
      this.wizardData.selectedBands = [
        ...this.wizardData.selectedBands,
        ...VHF_UHF_BAND_SHORT_NAMES.filter(band => !this.wizardData.selectedBands.includes(band)),
      ];
    },
    selectAllMicrowaveBands() {
      this.wizardData.selectedBands = [
        ...this.wizardData.selectedBands,
        ...MICROWAVE_BAND_SHORT_NAMES.filter(band => !this.wizardData.selectedBands.includes(band)),
      ];
    },
    clearAllBands() {
      this.wizardData.selectedBands = [];
    },
    forceUppercaseCallsign(event: Event) {
      const target = event.target as HTMLInputElement;
      const cursorPosition = target.selectionStart;
      this.wizardData.callsign = target.value.toUpperCase();
      // Restore cursor position after Vue updates the input
      this.$nextTick(() => {
        target.setSelectionRange(cursorPosition, cursorPosition);
      });
    },
    async selectAndImportAdifFile() {
      this.importStatus.isImporting = true;
      this.importStatus.error = null;
      this.importStatus.success = false;
      this.importStatus.importedCount = 0;
      this.importStatus.totalCount = 0;

      try {
        // First, let user select the file
        const fileResult = await window.electronAPI.selectAdifFile();
        if (!fileResult.success || !fileResult.filePath) {
          this.importStatus.isImporting = false;
          return;
        }

        // Parse the file to get total count
        const parseResult = await window.electronAPI.parseAdifFile(fileResult.filePath);
        if (!parseResult.success) {
          this.importStatus.error = parseResult.error || 'Failed to parse ADIF file';
          this.importStatus.isImporting = false;
          return;
        }

        this.importStatus.totalCount = parseResult.totalCount || 0;

        // Listen for progress updates BEFORE starting import
        window.electronAPI.onAdifImportProgress(progress => {
          this.importStatus.importedCount = progress.imported;
        });

        // Import with progress updates
        const importResult = await window.electronAPI.importAdifWithProgress(fileResult.filePath);

        if (importResult.success) {
          this.importStatus.success = true;
          this.importStatus.importedCount = importResult.count || 0;
          console.log(`Successfully imported ${importResult.count} QSOs from ADIF file`);
        } else {
          this.importStatus.error = importResult.error || 'Import failed';
        }
      } catch (error) {
        console.error('Error importing ADIF:', error);
        this.importStatus.error = 'An unexpected error occurred during import';
      } finally {
        this.importStatus.isImporting = false;
      }
    },
    async importAdifFile() {
      try {
        const result = await window.electronAPI.importAdif();
        if (result.imported) {
          console.log(`Successfully imported ${result.count} QSOs from ADIF file`);
          return true;
        } else {
          console.error('ADIF import failed:', result.error);
          return false;
        }
      } catch (error) {
        console.error('Error importing ADIF:', error);
        return false;
      }
    },
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        // Optional: Show a brief success indication
        console.log('Command copied to clipboard:', text);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // Fallback: select the text for manual copying
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    },
    async addFirewallExceptions() {
      this.firewallStatus.isConfiguring = true;
      this.firewallStatus.error = null;
      this.firewallStatus.success = false;
      this.firewallStatus.userCancelled = false;

      try {
        const result = await window.electronAPI.addFirewallExceptions();
        
        if (result.success) {
          this.firewallStatus.success = true;
          console.log('Firewall exceptions added successfully');
        } else if (result.userCancelled) {
          this.firewallStatus.userCancelled = true;
          console.warn('User cancelled firewall configuration');
        } else {
          this.firewallStatus.error = result.error || 'Unknown error occurred';
          console.error('Failed to add firewall exceptions:', result.error);
        }
      } catch (error) {
        console.error('Error adding firewall exceptions:', error);
        this.firewallStatus.error = 'An unexpected error occurred';
      } finally {
        this.firewallStatus.isConfiguring = false;
      }
    },
    async onCatToggle() {
      if (this.wizardData.enableCat && this.isWindows) {
        // Automatically check rigctld when CAT is enabled on Windows
        await this.checkRigctldInPath();
      } else if (this.wizardData.enableCat && this.isLinux) {
        // Check dialout group membership on Linux
        await this.checkDialoutGroup();
        // Check rigctld availability on Linux
        await this.checkRigctldAvailability();
        // Also test rigctld path on Linux
        await this.testRigctldPath();
      } else if (!this.wizardData.enableCat) {
        // Clear validation errors when CAT is disabled
        delete this.validationErrors.rigctldPath;
        this.hamlibStatus.inPath = false;
        this.hamlibStatus.success = false;
        this.hamlibStatus.pathUpdated = false;
        this.dialoutStatus.inGroup = false;
        this.dialoutStatus.error = null;
        this.rigctldStatus.found = false;
        this.rigctldStatus.error = null;
        this.firewallStatus.success = false;
        this.firewallStatus.error = null;
        this.firewallStatus.userCancelled = false;
      }
    },
    async completeSetup() {
      // Validate all fields
      const isCallsignValid = this.validateCallsign();
      const isLocatorValid = this.validateLocator();
      const isQrzValid = this.validateQrzCredentials();
      const isRigctldValid = await this.testRigctldPath();

      if (!isCallsignValid || !isLocatorValid || !isQrzValid || !isRigctldValid) {
        return;
      }

      // Create settings object by copying the structure from defaultSettings
      const settings = {
        ...defaultSettings,
        station: {
          ...defaultSettings.station,
          callsign: this.wizardData.callsign,
          qth: this.wizardData.qth,
          grid: this.wizardData.locator,
          iaruRegion: this.wizardData.iaruRegion,
          selectedBands: [...this.wizardData.selectedBands],
        },
        qrz: {
          ...defaultSettings.qrz,
          enabled: this.wizardData.enableQrz,
          username: this.wizardData.enableQrz ? this.wizardData.qrzUsername : '',
          password: this.wizardData.enableQrz ? this.wizardData.qrzPassword : '',
        },
        rig: {
          ...defaultSettings.rig,
          enabled: this.wizardData.enableCat,
          rigctldPath: this.wizardData.enableCat
            ? this.wizardData.rigctldPath
            : defaultSettings.rig.rigctldPath || 'rigctld',
        },
      };

      try {
        // Save settings first
        await window.electronAPI.saveSettings(settings);

        // Import ADIF if requested and not already imported
        if (this.wizardData.importAdif && !this.importStatus.success) {
          await this.importAdifFile();
        }

        // If CAT control is enabled and Hamlib was installed, restart rigctld
        if (this.wizardData.enableCat && (this.hamlibStatus.success || this.hamlibStatus.inPath)) {
          console.log('Restarting rigctld after setup completion...');
          try {
            await window.electronAPI.rigctldRestart();
            console.log('Rigctld restarted successfully');

            // Add firewall exceptions when enabling CAT control
            if (this.isWindows) {
              try {
                const firewallResult = await window.electronAPI.addFirewallExceptions();
                if (firewallResult.success) {
                  console.log('Firewall exceptions added for CAT control');
                } else if (firewallResult.userCancelled) {
                  console.warn('User cancelled firewall configuration for CAT control');
                } else {
                  console.warn('Failed to add firewall exceptions:', firewallResult.error);
                }
              } catch (firewallError) {
                console.warn('Failed to add firewall exceptions:', firewallError);
              }
            }
          } catch (error) {
            console.error('Error restarting rigctld:', error);
          }
        }

        this.$emit('complete');
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    },
  },
};
</script>

<template>
  <div class="wizard-overlay" @keydown="handleKeydown">
    <div class="wizard-container">
      <div class="wizard-header">
        <h1>HamLedger Initial Setup</h1>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
          ></div>
        </div>
        <p class="step-indicator">Step {{ currentStep }} of {{ totalSteps }}</p>
        <div class="hint-box">
          <p class="hint-text">
            💡 <strong>Tip:</strong> All settings can be changed later in the Configuration menu.
          </p>
        </div>
      </div>

      <div class="wizard-content">
        <!-- Step 1: Basic Station Info -->
        <div v-if="currentStep === 1" class="wizard-step">
          <h2>Station Information</h2>
          <p class="step-description">Please enter your basic station information.</p>

          <div class="form-group">
            <label for="callsign">Callsign *</label>
            <input
              id="callsign"
              v-model="wizardData.callsign"
              type="text"
              placeholder="e.g. HA5XB"
              @input="forceUppercaseCallsign"
              @blur="validateCallsign"
              :class="{ error: validationErrors.callsign }"
            />
            <span v-if="validationErrors.callsign" class="error-message">
              {{ validationErrors.callsign }}
            </span>
          </div>

          <div class="form-group">
            <label for="qth">QTH (Location) *</label>
            <input
              id="qth"
              v-model="wizardData.qth"
              type="text"
              placeholder="e.g. Budapest, Hungary"
            />
          </div>
        </div>

        <!-- Step 2: Optional Info -->
        <div v-if="currentStep === 2" class="wizard-step">
          <h2>Additional Information</h2>
          <p class="step-description">
            These fields are optional but help improve the program's functionality.
          </p>

          <div class="form-group">
            <label for="locator">Maidenhead Locator</label>
            <input
              id="locator"
              v-model="wizardData.locator"
              type="text"
              placeholder="e.g. JN97"
              @blur="validateLocator"
              :class="{
                error: validationErrors.locator,
                valid: locatorValidationClass === 'valid',
                invalid: locatorValidationClass === 'invalid',
              }"
            />
            <span v-if="validationErrors.locator" class="error-message">
              {{ validationErrors.locator }}
            </span>
          </div>

          <div class="form-group">
            <label for="iaruRegion">IARU Region</label>
            <select id="iaruRegion" v-model="wizardData.iaruRegion">
              <option value="IARU1">
                IARU Region 1 (Europe, Africa, Middle East, Northern Asia)
              </option>
              <option value="IARU2">IARU Region 2 (Americas)</option>
              <option value="IARU3">IARU Region 3 (Asia-Pacific)</option>
            </select>
          </div>
        </div>

        <!-- Step 3: Band Selection -->
        <div v-if="currentStep === 3" class="wizard-step">
          <h2>Band Selection</h2>
          <p class="step-description">
            Select the amateur radio bands you plan to operate on. This helps optimize the interface
            for your needs.
          </p>

          <div class="band-selection-controls">
            <button type="button" @click="selectAllHFBands" class="btn btn-small">All HF</button>
            <button type="button" @click="selectAllVHFUHFBands" class="btn btn-small">
              VHF/UHF
            </button>
            <button type="button" @click="selectAllMicrowaveBands" class="btn btn-small">
              Microwave
            </button>
            <button type="button" @click="clearAllBands" class="btn btn-small">Clear All</button>
          </div>

          <div class="band-grid">
            <label v-for="band in availableBands" :key="band.shortName" class="band-checkbox">
              <input
                type="checkbox"
                :value="band.shortName"
                :checked="wizardData.selectedBands.includes(band.shortName)"
                @change="toggleBand(band.shortName)"
              />
              <span class="band-label">{{ band.name }}</span>
            </label>
          </div>

          <div v-if="wizardData.selectedBands.length === 0" class="warning-message">
            Please select at least one band to continue.
          </div>
        </div>

        <!-- Step 4: ADIF Import -->
        <div v-if="currentStep === 4" class="wizard-step">
          <h2>Import Existing Log</h2>
          <p class="step-description">
            Do you have an existing ADIF log file you'd like to import?
          </p>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="wizardData.importAdif" />
              Import ADIF file
            </label>
          </div>

          <div v-if="wizardData.importAdif" class="import-section">
            <div class="info-box">
              <p class="info-text">
                Select your ADIF file (.adi or .adif) to import your existing QSO records.
              </p>
            </div>

            <div class="import-controls">
              <button
                type="button"
                @click="selectAndImportAdifFile"
                :disabled="importStatus.isImporting"
                class="btn btn-primary import-btn"
              >
                <span v-if="!importStatus.isImporting">Select & Import ADIF File</span>
                <span v-else class="loading-text">
                  <span class="spinner"></span>
                  Importing...
                </span>
              </button>
            </div>

            <!-- Import Progress -->
            <div v-if="importStatus.isImporting" class="import-progress">
              <div class="progress-info">
                <span class="progress-text">
                  Imported {{ importStatus.importedCount }}
                  <span v-if="importStatus.totalCount > 0">of {{ importStatus.totalCount }}</span>
                  QSOs
                </span>
              </div>
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  :style="{
                    width:
                      importStatus.totalCount > 0
                        ? `${(importStatus.importedCount / importStatus.totalCount) * 100}%`
                        : '0%',
                  }"
                ></div>
              </div>
            </div>

            <!-- Import Success -->
            <div v-if="importStatus.success && !importStatus.isImporting" class="success-message">
              ✅ Successfully imported {{ importStatus.importedCount }} QSOs!
            </div>

            <!-- Import Error -->
            <div v-if="importStatus.error && !importStatus.isImporting" class="error-message">
              ❌ Import failed: {{ importStatus.error }}
            </div>
          </div>
        </div>

        <!-- Step 5: QRZ.com Configuration -->
        <div v-if="currentStep === 5" class="wizard-step">
          <h2>QRZ.com Configuration</h2>
          <p class="step-description">
            Configure QRZ.com API access for enhanced callsign lookups and station information. This
            is optional and can be configured later.
          </p>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="wizardData.enableQrz" />
              Enable QRZ.com API
            </label>
          </div>

          <div v-if="wizardData.enableQrz" class="qrz-section">
            <div class="info-box">
              <p class="info-text">
                QRZ.com API provides detailed station information, QSL information, and enhanced
                callsign lookups. You need a QRZ.com account to use this feature.
              </p>
              <p class="info-text">
                <strong>Note:</strong> Your credentials are stored locally and only used for API
                authentication.
              </p>
            </div>

            <div class="form-group">
              <label for="qrzUsername">QRZ.com Username *</label>
              <input
                id="qrzUsername"
                v-model="wizardData.qrzUsername"
                type="text"
                placeholder="Your QRZ.com username"
                @blur="validateQrzCredentials"
                :class="{ error: validationErrors.qrzUsername }"
              />
              <span v-if="validationErrors.qrzUsername" class="error-message">
                {{ validationErrors.qrzUsername }}
              </span>
            </div>

            <div class="form-group">
              <label for="qrzPassword">QRZ.com Password *</label>
              <input
                id="qrzPassword"
                v-model="wizardData.qrzPassword"
                type="password"
                placeholder="Your QRZ.com password"
                @blur="validateQrzCredentials"
                :class="{ error: validationErrors.qrzPassword }"
              />
              <span v-if="validationErrors.qrzPassword" class="error-message">
                {{ validationErrors.qrzPassword }}
              </span>
            </div>

            <div class="info-box">
              <p class="info-text">
                Don't have a QRZ.com account? You can create one at:
                <a href="https://www.qrz.com/signup" target="_blank" class="warning-link">
                  www.qrz.com/signup
                </a>
              </p>
            </div>
          </div>
        </div>

        <!-- Step 6: CAT Control -->
        <div v-if="currentStep === 6" class="wizard-step">
          <h2>CAT Control Setup</h2>
          <p class="step-description">
            Configure computer-aided transceiver control if you have a compatible radio.
          </p>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="wizardData.enableCat" @change="onCatToggle" />
              Enable CAT Control
            </label>
          </div>

          <!-- Windows Hamlib Auto-Install -->
          <div v-if="wizardData.enableCat && isWindows" class="hamlib-section">
            <div class="info-box">
              <p class="info-text">
                HamLedger can automatically download and install Hamlib for Windows.
              </p>
            </div>

            <!-- Check rigctld status -->
            <div class="hamlib-controls">
              <button
                type="button"
                @click="checkRigctldInPath"
                :disabled="hamlibStatus.isChecking || hamlibStatus.isInstalling"
                class="btn btn-small"
              >
                <span v-if="!hamlibStatus.isChecking">Check rigctld</span>
                <span v-else class="loading-text">
                  <span class="spinner"></span>
                  Checking...
                </span>
              </button>

              <button
                v-if="!hamlibStatus.inPath && !hamlibStatus.success"
                type="button"
                @click="downloadAndInstallHamlib"
                :disabled="hamlibStatus.isInstalling"
                class="btn btn-primary"
              >
                <span v-if="!hamlibStatus.isInstalling">Install Hamlib</span>
                <span v-else class="loading-text">
                  <span class="spinner"></span>
                  Installing...
                </span>
              </button>
            </div>

            <!-- Installation Progress -->
            <div v-if="hamlibStatus.isInstalling" class="install-progress">
              <div class="progress-info">
                <span class="progress-text">
                  Installing Hamlib... {{ hamlibStatus.downloadProgress }}%
                </span>
              </div>
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  :style="{ width: `${hamlibStatus.downloadProgress}%` }"
                ></div>
              </div>
            </div>

            <!-- Installation Success -->
            <div v-if="hamlibStatus.success || hamlibStatus.inPath" class="success-message">
              ✅ Hamlib is available and ready to use!
              <div v-if="hamlibStatus.success && hamlibStatus.installedPath" class="info-text">
                Installed at: {{ hamlibStatus.installedPath }}
              </div>
              <div v-if="hamlibStatus.pathUpdated" class="info-text">
                PATH updated. Restart HamLedger to refresh environment.
              </div>
            </div>

            <!-- Installation Error -->
            <div v-if="hamlibStatus.error" class="error-message">
              ❌ Installation failed: {{ hamlibStatus.error }}
              <p class="error-help">
                You can manually download Hamlib from:
                <a
                  href="https://hamlib.sourceforge.net/snapshots/"
                  target="_blank"
                  class="warning-link"
                >
                  hamlib.sourceforge.net/snapshots/
                </a>
              </p>
            </div>

            <!-- Firewall Configuration -->
            <div class="firewall-section">
              <div class="info-box">
                <p class="info-text">
                  <strong>Firewall Configuration:</strong> HamLedger and rigctld need firewall exceptions to communicate properly.
                </p>
              </div>
              
              <div class="firewall-controls">
                <button
                  type="button"
                  @click="addFirewallExceptions"
                  :disabled="firewallStatus.isConfiguring"
                  class="btn btn-small"
                >
                  <span v-if="!firewallStatus.isConfiguring">Add Firewall Exceptions</span>
                  <span v-else class="loading-text">
                    <span class="spinner"></span>
                    Configuring...
                  </span>
                </button>
              </div>

              <!-- Firewall Success -->
              <div v-if="firewallStatus.success" class="success-message">
                ✅ Firewall exceptions added successfully!
              </div>

              <!-- Firewall Error -->
              <div v-if="firewallStatus.error" class="error-message">
                ❌ Firewall configuration failed: {{ firewallStatus.error }}
                <p class="error-help">
                  You may need to manually add HamLedger and rigctld to your firewall exceptions.
                </p>
              </div>

              <!-- User Cancelled -->
              <div v-if="firewallStatus.userCancelled" class="warning-message">
                ⚠️ Firewall configuration was cancelled. You may need to manually configure firewall exceptions for proper CAT control operation.
              </div>
            </div>

            <!-- Windows Core Isolation Warning -->
            <div class="info-box core-isolation-warning">
              <div class="warning-icon">⚠️</div>
              <div class="warning-content">
                <p class="warning-title">Windows Security Notice</p>
                <p class="info-text">
                  <strong>Core Isolation (Memory Integrity)</strong> is a Windows security feature
                  that may interfere with Hamlib's operation. If you experience strange CAT behavior
                  or complete non-functionality, you may need to disable this feature.
                </p>
                <p class="info-text">
                  To check/disable: Windows Security → Device Security → Core Isolation Details →
                  Memory Integrity (turn off)
                </p>
                <p class="info-text">
                  <em
                    >Note: Disabling this feature may reduce system security. Only disable if
                    necessary for CAT control.</em
                  >
                </p>
              </div>
            </div>
          </div>

          <!-- Linux Hamlib Warning -->
          <div
            v-if="
              wizardData.enableCat &&
              isLinux &&
              !rigctldStatus.found &&
              !rigctldStatus.isChecking &&
              rigctldStatus.error === null
            "
            class="warning-box"
          >
            <div class="warning-icon">⚠️</div>
            <div class="warning-content">
              <p class="warning-title">Linux Users</p>
              <p class="warning-text">
                On Linux, you must install Hamlib first before enabling CAT control. (You may need
                sudo rights)
              </p>
              <div class="command-section">
                <p class="command-label">For Ubuntu/Debian:</p>
                <div class="command-box">
                  <code class="command-text">sudo apt install libhamlib-utils</code>
                  <button
                    type="button"
                    class="copy-btn"
                    @click="copyToClipboard('sudo apt install libhamlib-utils')"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div class="command-section">
                <p class="command-label">For RPM based distributions:</p>
                <div class="command-box">
                  <code class="command-text">sudo dnf install hamlib</code>
                  <button
                    type="button"
                    class="copy-btn"
                    @click="copyToClipboard('sudo dnf install hamlib')"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Linux Dialout Group Check -->
          <div v-if="wizardData.enableCat && isLinux" class="dialout-section">
            <div
              v-if="!dialoutStatus.inGroup && !dialoutStatus.isChecking"
              class="dialout-controls"
            >
              <button
                type="button"
                @click="checkDialoutGroup"
                :disabled="dialoutStatus.isChecking"
                class="btn btn-small"
              >
                <span v-if="!dialoutStatus.isChecking">Check dialout group</span>
                <span v-else class="loading-text">
                  <span class="spinner"></span>
                  Checking...
                </span>
              </button>
            </div>

            <!-- Dialout Group Success -->
            <div v-if="dialoutStatus.inGroup" class="success-message">
              ✅ User is in dialout group - serial port access available!
            </div>

            <!-- Dialout Group Warning -->
            <div
              v-if="
                dialoutStatus.isChecking === false && !dialoutStatus.inGroup && !dialoutStatus.error
              "
              class="warning-box"
            >
              <div class="warning-icon">⚠️</div>
              <div class="warning-content">
                <p class="warning-title">Serial Port Access Required</p>
                <p class="warning-text">
                  Your user needs to be in the 'dialout' group to access serial ports for CAT
                  control.
                </p>
                <div class="command-section">
                  <p class="command-label">Add user to dialout group:</p>
                  <div class="command-box">
                    <code class="command-text">sudo usermod -a -G dialout $USER</code>
                    <button
                      type="button"
                      class="copy-btn"
                      @click="copyToClipboard('sudo usermod -a -G dialout $USER')"
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div class="command-section">
                  <p class="command-label">Then reload groups (or logout/login):</p>
                  <div class="command-box">
                    <code class="command-text">newgrp dialout</code>
                    <button
                      type="button"
                      class="copy-btn"
                      @click="copyToClipboard('newgrp dialout')"
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <p class="warning-text">
                  <strong>Note:</strong> After running these commands, you may need to restart
                  HamLedger.
                </p>
              </div>
            </div>

            <!-- Dialout Group Error -->
            <div v-if="dialoutStatus.error" class="error-message">
              ❌ Error checking dialout group: {{ dialoutStatus.error }}
            </div>
          </div>

          <div v-if="wizardData.enableCat" class="form-group">
            <label for="rigctldPath">rigctld Path</label>
            <input
              id="rigctldPath"
              v-model="wizardData.rigctldPath"
              type="text"
              placeholder="rigctld"
              @blur="testRigctldPath"
              :class="{ error: validationErrors.rigctldPath }"
            />
            <span v-if="validationErrors.rigctldPath" class="error-message">
              {{ validationErrors.rigctldPath }}
            </span>
            <span v-if="isValidating" class="info-message"> Checking rigctld availability... </span>
            <p class="help-text">
              Enter the path to rigctld executable. If rigctld is in your PATH, just enter
              "rigctld".
            </p>
          </div>
        </div>
      </div>

      <div class="wizard-footer">
        <button v-if="currentStep > 1" @click="prevStep" class="btn btn-secondary">Previous</button>
        <button @click="nextStep" :disabled="!canProceed || isValidating" class="btn btn-primary">
          {{ isLastStep ? 'Complete Setup' : 'Next' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wizard-container {
  background: #333;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.wizard-header {
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid #444;
  text-align: center;
}

.wizard-header h1 {
  color: var(--main-color);
  margin: 0 0 1rem;
  font-size: 1.8rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: var(--main-color);
  transition: width 0.3s ease;
}

.step-indicator {
  color: var(--gray-color);
  margin: 0;
  font-size: 0.9rem;
}

.hint-box {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
}

.hint-text {
  color: var(--gray-color);
  margin: 0;
  font-size: 0.85rem;
  text-align: center;
  line-height: 1.4;
}

.wizard-content {
  padding: 2rem;
  min-height: 300px;
}

.wizard-step h2 {
  color: #fff;
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
}

.step-description {
  color: var(--gray-color);
  margin: 0 0 2rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: var(--gray-color);
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  margin-right: 0.5rem;
  width: auto;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: #444;
  border: 1px solid #555;
  color: #fff;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--main-color);
}

.form-group input.error {
  border-color: #e74c3c;
}

.form-group input.valid {
  background-color: rgba(39, 174, 96, 0.2);
  border-color: #27ae60;
}

.form-group input.invalid {
  background-color: rgba(231, 76, 60, 0.2);
  border-color: #e74c3c;
}

.error-message {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.info-message {
  color: var(--main-color);
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.help-text {
  color: #666;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  line-height: 1.4;
}

.wizard-footer {
  padding: 1rem 2rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--main-color);
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  background: #e6d700;
}

.btn-secondary {
  background: #555;
  color: #fff;
}

.btn-secondary:hover {
  background: #666;
}

.info-box {
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
  margin-top: 1rem;
}

.info-text {
  color: var(--gray-color);
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.band-selection-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.band-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.band-checkbox {
  display: flex !important;
  align-items: center;
  padding: 0.5rem;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.band-checkbox:hover {
  background: #3b3b3b;
}

.band-checkbox input[type='checkbox'] {
  margin-right: 0.5rem;
  width: auto;
}

.band-label {
  font-size: 0.9rem;
  color: var(--gray-color);
}

.warning-message {
  color: #e74c3c;
  font-size: 0.9rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 4px;
}

.import-section {
  margin-top: 1rem;
}

.import-controls {
  margin: 1rem 0;
}

.import-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 200px;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.import-progress {
  margin: 1rem 0;
  padding: 1rem;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-text {
  color: var(--main-color);
  font-weight: bold;
  font-size: 0.9rem;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--main-color);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.success-message {
  color: #27ae60;
  font-size: 0.9rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(39, 174, 96, 0.1);
  border: 1px solid rgba(39, 174, 96, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-message {
  color: #e74c3c;
  font-size: 0.9rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.warning-box {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.warning-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.warning-content {
  flex: 1;
}

.warning-title {
  color: #ffc107;
  font-weight: bold;
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.warning-text {
  color: var(--gray-color);
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.warning-link {
  color: var(--main-color);
  text-decoration: none;
}

.warning-link:hover {
  text-decoration: underline;
}

.command-section {
  margin-top: 1rem;
}

.command-label {
  color: var(--gray-color);
  font-size: 0.85rem;
  margin: 0 0 0.25rem;
  font-weight: bold;
}

.command-box {
  display: flex;
  align-items: center;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.command-text {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: #fff;
  background: transparent;
  border: none;
  user-select: all;
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--main-color);
  cursor: pointer;
  padding: 0.25rem;
  margin-left: 0.5rem;
  border-radius: 2px;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: rgba(255, 215, 0, 0.1);
}

.hamlib-section {
  margin: 1rem 0;
}

.hamlib-controls {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  align-items: center;
}

.install-progress {
  margin: 1rem 0;
  padding: 1rem;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
}

.error-help {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--gray-color);
}

.dialout-section {
  margin: 1rem 0;
}

.dialout-controls {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  align-items: center;
}

.dialout-section {
  margin: 1rem 0;
}

.firewall-section {
  margin: 1rem 0;
}

.firewall-controls {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  align-items: center;
}

.qrz-section {
  margin-top: 1rem;
}

.core-isolation-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  margin-top: 1rem;
}

.core-isolation-warning .warning-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.core-isolation-warning .warning-content {
  flex: 1;
}

.core-isolation-warning .warning-title {
  color: #ffc107;
  font-weight: bold;
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}
</style>
