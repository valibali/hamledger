<script lang="ts">
import { ConfigField } from '../types/config';
import { configHelper } from '../utils/configHelper';
import { BAND_RANGES } from '../utils/bands';

export default {
  name: 'ConfigView',
  data() {
    return {
      selectedCategory: 'Station',
      searchQuery: '',
      configFields: [] as ConfigField[],
      passwordVisibility: {} as { [key: string]: boolean },
      hamlibStatus: {
        isInstalling: false,
        downloadProgress: 0,
        error: null as string | null,
        success: false,
        isChecking: false,
        inPath: false,
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
      isValidating: false,
      validationErrors: {} as { [key: string]: string },
      isWindows: navigator.platform.toLowerCase().includes('win'),
      isLinux: navigator.platform.toLowerCase().includes('linux'),
    };
  },
  computed: {
    categories() {
      const cats = configHelper.getCategorizedFields(this.configFields);
      return cats.map(category => ({
        ...category,
        name: this.getCategoryDisplayName(category.name),
      }));
    },
    filteredFields() {
      if (!this.searchQuery) {
        const category = this.categories.find(cat => cat.name === this.selectedCategory);
        return category?.fields || [];
      }
      return this.configFields.filter(field => {
        const searchStr = this.searchQuery.toLowerCase();
        const fieldPath = [...field.path, field.key].join(' ').toLowerCase();
        return fieldPath.includes(searchStr);
      });
    },
    currentCategoryEnabled() {
      const categoryKey = this.selectedCategory.toLowerCase().replace(' ', '');
      const categoryMap = {
        station: 'station',
        catcontrol: 'rig',
        onlineservices: 'qrz',
        apis: 'apis',
        database: 'database',
        ui: 'ui',
        logging: 'logging',
        'wsjt-x': 'wsjtx',
      };

      const actualKey = categoryMap[categoryKey] || categoryKey;
      const enabledField = this.configFields.find(
        f => f.path[0] === actualKey && f.key === 'enabled'
      );

      return enabledField ? enabledField.value : true;
    },
    hasCategoryEnabler() {
      const categoryKey = this.selectedCategory.toLowerCase().replace(' ', '');
      const categoriesWithEnabler = ['catcontrol', 'onlineservices', 'database', 'wsjt-x'];
      return categoriesWithEnabler.includes(categoryKey);
    },
    isRigModelDummy() {
      const rigModelField = this.configFields.find(
        f => f.path[0] === 'rig' && f.key === 'rigModel'
      );
      return rigModelField ? rigModelField.value === 1 : false;
    },
  },
  async mounted() {
    await configHelper.initSettings();
    this.configFields = configHelper.flattenConfig();

    // Automatically check system requirements when component mounts
    if (this.isLinux) {
      await this.checkDialoutGroup();
      await this.checkRigctldAvailability();
    } else if (this.isWindows) {
      await this.checkRigctldInPath();
    }
  },
  methods: {
    getCategoryDisplayName(categoryName: string): string {
      const displayNames: { [key: string]: string } = {
        rig: 'CAT Control',
        qrz: 'Online Services',
        apis: 'APIs',
        station: 'Station',
        database: 'Database',
        ui: 'UI',
        logging: 'Logging',
        wsjtx: 'WSJT-X',
      };
      return (
        displayNames[categoryName] || categoryName.charAt(0).toUpperCase() + categoryName.slice(1)
      );
    },
    getFieldId(field: ConfigField): string {
      return configHelper.getFieldId(field);
    },
    getFieldLabel(field: ConfigField): string {
      return configHelper.getFieldLabel(field);
    },
    async handleChange(field: ConfigField, event: Event) {
      const target = event.target as HTMLInputElement;
      let value: string | number | boolean;

      if (target.type === 'checkbox') {
        value = target.checked;
      } else if (target.type === 'number') {
        value = Number(target.value);
      } else {
        value = target.value;
      }

      try {
        await configHelper.updateSetting(field.path, field.key, value);

        // Find and update the field in configFields array to trigger reactivity
        const fieldIndex = this.configFields.findIndex(
          f => f.key === field.key && f.path.join('.') === field.path.join('.')
        );

        if (fieldIndex !== -1) {
          this.configFields[fieldIndex] = {
            ...this.configFields[fieldIndex],
            value: value,
          };
        }

        // Check system requirements when enabling CAT control
        if (field.path[0] === 'rig' && field.key === 'enabled' && value) {
          if (this.isWindows) {
            await this.checkRigctldInPath();
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
          } else if (this.isLinux) {
            await this.checkDialoutGroup();
            await this.checkRigctldAvailability();
          }
        }
      } catch (error) {
        console.error('Error updating setting:', error);
      }
    },
    getAvailableBands() {
      return BAND_RANGES.filter(band =>
        ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'].includes(
          band.name
        )
      );
    },
    async toggleBandInConfig(field: ConfigField, bandName: string, event: Event) {
      const target = event.target as HTMLInputElement;
      const currentBands = [...field.value];

      if (target.checked) {
        if (!currentBands.includes(bandName)) {
          currentBands.push(bandName);
        }
      } else {
        const index = currentBands.indexOf(bandName);
        if (index > -1) {
          currentBands.splice(index, 1);
        }
      }

      await configHelper.updateSetting(field.path, field.key, currentBands);

      // Update the field in the reactive array
      const fieldIndex = this.configFields.findIndex(
        f => f.key === field.key && f.path.join('.') === field.path.join('.')
      );

      if (fieldIndex !== -1) {
        this.configFields[fieldIndex] = {
          ...this.configFields[fieldIndex],
          value: currentBands,
        };
      }
    },
    async selectAllHFBands(field: ConfigField) {
      const hfBands = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'];
      await configHelper.updateSetting(field.path, field.key, hfBands);

      const fieldIndex = this.configFields.findIndex(
        f => f.key === field.key && f.path.join('.') === field.path.join('.')
      );

      if (fieldIndex !== -1) {
        this.configFields[fieldIndex] = {
          ...this.configFields[fieldIndex],
          value: hfBands,
        };
      }
    },
    async selectAllVHFUHFBands(field: ConfigField) {
      const vhfUhfBands = ['6m', '2m', '70cm'];
      const currentBands = [...field.value];
      const newBands = [
        ...currentBands,
        ...vhfUhfBands.filter(band => !currentBands.includes(band)),
      ];
      await configHelper.updateSetting(field.path, field.key, newBands);

      const fieldIndex = this.configFields.findIndex(
        f => f.key === field.key && f.path.join('.') === field.path.join('.')
      );

      if (fieldIndex !== -1) {
        this.configFields[fieldIndex] = {
          ...this.configFields[fieldIndex],
          value: newBands,
        };
      }
    },
    async clearAllBands(field: ConfigField) {
      await configHelper.updateSetting(field.path, field.key, []);

      const fieldIndex = this.configFields.findIndex(
        f => f.key === field.key && f.path.join('.') === field.path.join('.')
      );

      if (fieldIndex !== -1) {
        this.configFields[fieldIndex] = {
          ...this.configFields[fieldIndex],
          value: [],
        };
      }
    },
    togglePasswordVisibility(fieldId: string) {
      this.passwordVisibility[fieldId] = !this.passwordVisibility[fieldId];
    },
    isPasswordField(field: ConfigField): boolean {
      return field.key === 'password' && field.path.includes('qrz');
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
          this.hamlibStatus.inPath = true;
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
    async testRigctldPath(field: ConfigField) {
      this.isValidating = true;
      try {
        let result;
        const rigctldPath = (field.value as string).trim();

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

        const fieldId = this.getFieldId(field);
        if (result.success && result.data.trim()) {
          delete this.validationErrors[fieldId];
          return true;
        } else {
          this.validationErrors[fieldId] = 'rigctld not found in the specified path';
          return false;
        }
      } catch {
        const fieldId = this.getFieldId(field);
        this.validationErrors[fieldId] = 'Error checking rigctld path';
        return false;
      } finally {
        this.isValidating = false;
      }
    },
    async restartRigctld() {
      try {
        await window.electronAPI.rigctldRestart();
        console.log('Rigctld restarted successfully');

        // Add firewall exceptions when restarting rigctld on Windows
        if (this.isWindows) {
          try {
            const firewallResult = await window.electronAPI.addFirewallExceptions();
            if (firewallResult.success) {
              console.log('Firewall exceptions added');
            } else if (firewallResult.userCancelled) {
              console.warn('User cancelled firewall configuration');
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
    },
    async copyToClipboard(text: string) {
      try {
        await navigator.clipboard.writeText(text);
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
    isRigctldPathField(field: ConfigField): boolean {
      return field.key === 'rigctldPath' && field.path.includes('rig');
    },
    async toggleCategoryEnabled(enabled: boolean) {
      const categoryKey = this.selectedCategory.toLowerCase().replace(' ', '');
      const categoryMap = {
        catcontrol: 'rig',
        onlineservices: 'qrz',
        database: 'database',
        'wsjt-x': 'wsjtx',
      };

      const actualKey = categoryMap[categoryKey];
      if (actualKey) {
        await configHelper.updateSetting([actualKey], 'enabled', enabled);

        const fieldIndex = this.configFields.findIndex(
          f => f.path[0] === actualKey && f.key === 'enabled'
        );

        if (fieldIndex !== -1) {
          this.configFields[fieldIndex] = {
            ...this.configFields[fieldIndex],
            value: enabled,
          };
        }

        // Check system requirements when enabling CAT control
        if (actualKey === 'rig' && enabled) {
          if (this.isWindows) {
            await this.checkRigctldInPath();
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
          } else if (this.isLinux) {
            await this.checkDialoutGroup();
            await this.checkRigctldAvailability();
          }
        }
      }
    },
  },
};
</script>

<template>
  <main class="config-panel">
    <div class="config-container">
      <div class="config-header">
        <h2 class="section-title">Configuration</h2>
        <div class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search settings..."
            class="search-input"
          />
        </div>
      </div>

      <div class="config-layout">
        <!-- Categories sidebar -->
        <nav class="config-sidebar">
          <ul class="category-list">
            <li
              v-for="category in categories"
              :key="category.name"
              :class="['category-item', { active: category.name === selectedCategory }]"
              @click="selectedCategory = category.name"
            >
              {{ category.name.charAt(0).toUpperCase() + category.name.slice(1) }}
            </li>
          </ul>
        </nav>

        <!-- Main config area -->
        <div class="config-main">
          <!-- Category enabler -->
          <div v-if="hasCategoryEnabler" class="category-enabler">
            <div class="enabler-header">
              <h3>{{ selectedCategory }}</h3>
              <div class="boolean-field">
                <div class="toggle-switch">
                  <input
                    type="checkbox"
                    :id="`category-${selectedCategory}-enabled`"
                    :checked="currentCategoryEnabled"
                    @change="toggleCategoryEnabled(($event.target as HTMLInputElement).checked)"
                  />
                  <span class="slider"></span>
                </div>
                <span class="toggle-label">{{
                  currentCategoryEnabled ? 'Enabled' : 'Disabled'
                }}</span>
              </div>
            </div>
          </div>

          <div
            class="config-fields"
            :class="{ disabled: hasCategoryEnabler && !currentCategoryEnabled }"
          >
            <div v-for="field in filteredFields" :key="getFieldId(field)" class="config-field">
              <div class="field-header">
                <label :for="getFieldId(field)">{{ getFieldLabel(field) }}</label>
                <span v-if="field.description" class="field-description">{{
                  field.description
                }}</span>
                <span v-if="field.key === 'comPort' && isRigModelDummy" class="field-note">
                  (Disabled for Dummy/None rig model)
                </span>
              </div>

              <!-- Boolean (skip enabled field if it's the category enabler) -->
              <div
                v-if="field.type === 'boolean' && !(hasCategoryEnabler && field.key === 'enabled')"
                class="boolean-field"
              >
                <div class="toggle-switch">
                  <input
                    type="checkbox"
                    :id="getFieldId(field)"
                    :checked="!!field.value"
                    @change="handleChange(field, $event)"
                  />
                  <span class="slider"></span>
                </div>
                <span class="toggle-label">{{ field.value ? 'Enabled' : 'Disabled' }}</span>
              </div>

              <!-- Number -->
              <input
                v-else-if="field.type === 'number'"
                type="number"
                :id="getFieldId(field)"
                :value="field.value"
                @input="handleChange(field, $event)"
              />

              <!-- Band selection (special case for selectedBands) -->
              <div v-else-if="field.key === 'selectedBands'" class="band-selection">
                <div class="band-selection-controls">
                  <button type="button" @click="selectAllHFBands(field)" class="btn btn-small">
                    All HF
                  </button>
                  <button type="button" @click="selectAllVHFUHFBands(field)" class="btn btn-small">
                    VHF/UHF
                  </button>
                  <button type="button" @click="clearAllBands(field)" class="btn btn-small">
                    Clear All
                  </button>
                </div>
                <div class="band-grid">
                  <label
                    v-for="band in getAvailableBands()"
                    :key="band.name"
                    class="band-checkbox"
                  >
                    <input
                      type="checkbox"
                      :value="band.name"
                      :checked="field.value.includes(band.name)"
                      @change="toggleBandInConfig(field, band.name, $event)"
                    />
                    <span class="band-label">{{ band.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Array (as select) -->
              <select
                v-else-if="
                  field.type === 'array' &&
                  field.value.every((v: any) => typeof v !== 'object') &&
                  field.key !== 'selectedBands'
                "
                :id="getFieldId(field)"
                @change="handleChange(field, $event)"
              >
                <option v-for="option in field.value" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>

              <!-- Password field with reveal button -->
              <div v-else-if="isPasswordField(field)" class="password-field">
                <input
                  :type="passwordVisibility[getFieldId(field)] ? 'text' : 'password'"
                  :id="getFieldId(field)"
                  :value="field.value"
                  @input="handleChange(field, $event)"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="togglePasswordVisibility(getFieldId(field))"
                >
                  {{ passwordVisibility[getFieldId(field)] ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>

              <!-- rigctld Path field with special controls -->
              <div v-else-if="isRigctldPathField(field)" class="rigctld-field">
                <input
                  type="text"
                  :id="getFieldId(field)"
                  :value="field.value"
                  @input="handleChange(field, $event)"
                  @blur="testRigctldPath(field)"
                  :class="{ error: validationErrors[getFieldId(field)] }"
                />

                <!-- Windows Hamlib Controls -->
                <div v-if="isWindows" class="hamlib-controls">
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
                    class="btn btn-small btn-primary"
                  >
                    <span v-if="!hamlibStatus.isInstalling">Install Hamlib</span>
                    <span v-else class="loading-text">
                      <span class="spinner"></span>
                      Installing...
                    </span>
                  </button>

                  <button type="button" @click="restartRigctld" class="btn btn-small">
                    Restart rigctld
                  </button>
                </div>

                <!-- Linux Hamlib Warning -->
                <div
                  v-if="
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
                      On Linux, you must install Hamlib first before enabling CAT control. (You may
                      need sudo rights)
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
                <div v-if="isLinux" class="dialout-section">
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

                    <button
                      type="button"
                      @click="checkRigctldAvailability"
                      :disabled="rigctldStatus.isChecking"
                      class="btn btn-small"
                    >
                      <span v-if="!rigctldStatus.isChecking">Check rigctld</span>
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

                  <!-- rigctld Found Success -->
                  <div v-if="rigctldStatus.found" class="success-message">
                    ✅ rigctld is available and ready to use!
                  </div>

                  <!-- Dialout Group Warning -->
                  <div
                    v-if="
                      dialoutStatus.isChecking === false &&
                      !dialoutStatus.inGroup &&
                      !dialoutStatus.error
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

                  <!-- rigctld Error -->
                  <div v-if="rigctldStatus.error" class="error-message">
                    ❌ Error checking rigctld: {{ rigctldStatus.error }}
                  </div>
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

                <!-- Validation Error -->
                <span v-if="validationErrors[getFieldId(field)]" class="error-message">
                  {{ validationErrors[getFieldId(field)] }}
                </span>
                <span v-if="isValidating" class="info-message">
                  Checking rigctld availability...
                </span>
              </div>

              <!-- String with conditional disable for comPort -->
              <input
                v-else
                type="text"
                :id="getFieldId(field)"
                :value="field.value"
                :disabled="field.key === 'comPort' && isRigModelDummy"
                @input="handleChange(field, $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.config-panel {
  display: flex;
  width: 100%;
  height: calc(100vh - 2rem);
}

.config-container {
  background: #333;
  border-radius: 5px;
  padding: 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0;
  min-height: 0;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.search-box {
  flex: 0 1 300px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  background: #444;
  border: 1px solid #555;
  color: #fff;
  border-radius: 3px;
}

.config-layout {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.config-sidebar {
  flex: 0 0 200px;
  min-width: 200px;
  background: #2b2b2b;
  border-radius: 4px;
  overflow-y: auto;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-item {
  padding: 0.75rem 1rem;
  color: var(--gray-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.category-item:hover {
  background: #3b3b3b;
}

.category-item.active {
  background: var(--main-color);
  color: #000;
}

.config-main {
  flex: 1;
  overflow-y: auto;
  background: #2b2b2b;
  border-radius: 4px;
  padding: 1rem;
  min-width: 0;
  min-height: 0;
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #333;
  border-radius: 4px;
  border: 1px solid #444;
  width: 100%;
}

.field-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.config-field label {
  color: var(--gray-color);
  font-size: 0.9rem;
  font-weight: bold;
}

.field-description {
  font-size: 0.8rem;
  color: #666;
}

.field-note {
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
}

.config-field input[type='text'],
.config-field input[type='number'],
.config-field select {
  background: #444;
  border: 1px solid #555;
  padding: 0.5rem;
  color: #fff;
  border-radius: 3px;
  width: 100%;
}

.config-field input:disabled {
  background: #2a2a2a;
  color: #666;
  cursor: not-allowed;
}

.boolean-field {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Toggle switch styling */
.toggle-switch {
  position: relative;
  width: 60px;
  height: 34px;
  flex-shrink: 0;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #444;
  transition: 0.4s;
  border-radius: 34px;
  pointer-events: none;
}

.slider:before {
  position: absolute;
  content: '';
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--main-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.toggle-label {
  color: var(--gray-color);
  font-size: 0.9rem;
  font-weight: normal;
}

.band-selection {
  width: 100%;
}

.band-selection-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  background: #555;
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;
}

.btn:hover {
  background: #666;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
}

.band-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.band-checkbox {
  display: flex !important;
  align-items: center;
  padding: 0.5rem;
  background: #444;
  border: 1px solid #555;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.band-checkbox:hover {
  background: #555;
}

.band-checkbox input[type='checkbox'] {
  margin-right: 0.5rem;
  width: auto;
}

.band-label {
  font-size: 0.85rem;
  color: var(--gray-color);
}

.category-enabler {
  background: #333;
  border: 2px solid var(--main-color);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.enabler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.enabler-header h3 {
  margin: 0;
  color: var(--gray-color);
  font-size: 1.2rem;
}

.config-fields.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.config-fields.disabled .config-field {
  background: #2a2a2a;
}

.password-field {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.password-field input {
  flex: 1;
  padding-right: 3rem;
  background: #444;
  border: 1px solid #555;
  padding: 0.5rem;
  padding-right: 3rem;
  color: #fff;
  border-radius: 3px;
  width: 100%;
}

.password-toggle {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--gray-color);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.password-toggle:hover {
  color: var(--main-color);
}

.rigctld-field {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.hamlib-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
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

.install-progress {
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

.error-help {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--gray-color);
}

.info-message {
  color: var(--main-color);
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.btn-primary {
  background: var(--main-color);
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  background: #e6d700;
}
</style>
