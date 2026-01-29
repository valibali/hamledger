// src/electron/main/main.ts
import { join } from 'path';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Socket } from 'net';
import { exec, spawn, ChildProcess } from 'child_process';
import { parseAdif } from '../../utils/adif';
import { QsoEntry } from '../../types/qso';
import { WSJTXLoggedQSO } from '../../types/wsjtx';
import { databaseService } from '../../services/DatabaseService';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Extract } from 'unzipper';
import { wsjtxService } from '../../services/WSJTXService';
import { getBandFromFrequency } from '../../utils/bands';

interface FetchOptions {
  headers: {
    'User-Agent': string;
    Accept: string;
  };
  timeout: number;
  agent?: HttpsProxyAgent<string>;
}

const isDev = process.env.npm_lifecycle_event === 'app:dev' ? true : false;

// Get the HamLedger data directory path
// On Windows: ~/.hamledger (in user's home folder)
// On other platforms: also ~/.hamledger for consistency
function getHamLedgerDataPath(): string {
  const homedir = app.getPath('home');
  const hamledgerDir = join(homedir, '.hamledger');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(hamledgerDir)) {
    fs.mkdirSync(hamledgerDir, { recursive: true });
  }
  
  return hamledgerDir;
}

// Rigctld process management
let rigctldProcess: ChildProcess | null = null;

// WSJT-X service management
let wsjtxEnabled = false;

// Check if a port is in use
function isPortInUse(port: number, host: string = 'localhost'): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new Socket();

    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

// Start rigctld as background process
async function startRigctld(): Promise<void> {
  try {
    // Load settings to get default rig configuration
    let settings;
    try {
      if (fs.existsSync(userSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      } else if (fs.existsSync(defaultSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load settings for rigctld startup:', error);
    }

    // Get rig configuration from settings
    const rigConfig = settings?.rig || {};
    const rigModel = rigConfig.rigModel || 1025; // Default to Yaesu FT-1000MP
    const rigDevice = rigConfig.device || ''; // Default device
    const rigPort = rigConfig.port || 4532; // Default port

    // Check if rigctld is already running on configured port
    const isRunning = await isPortInUse(rigPort);

    if (isRunning) {
      console.log(`Rigctld already running on port ${rigPort}`);
      return;
    }

    console.log(`Starting rigctld as background process with model ${rigModel}...`);

    // Build arguments based on configuration
    const args = ['-m', rigModel.toString()];

    // Add device parameter only if model is not 1 (dummy) and device is specified
    if (rigModel !== 1 && rigDevice) {
      args.push('-r', rigDevice);
    }

    // Add port if different from default
    if (rigPort !== 4532) {
      args.push('-t', rigPort.toString());
    }

    console.log('Rigctld command:', 'rigctld', args.join(' '));

    rigctldProcess = spawn('rigctld', args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (rigctldProcess.stdout) {
      rigctldProcess.stdout.on('data', data => {
        console.log('rigctld stdout:', data.toString());
      });
    }

    if (rigctldProcess.stderr) {
      rigctldProcess.stderr.on('data', data => {
        console.log('rigctld stderr:', data.toString());
      });
    }

    rigctldProcess.on('error', error => {
      console.error('Failed to start rigctld:', error);
      rigctldProcess = null;
    });

    rigctldProcess.on('exit', (code, signal) => {
      console.log(`rigctld process exited with code ${code} and signal ${signal}`);
      rigctldProcess = null;
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify it's running on the configured port
    const isNowRunning = await isPortInUse(rigPort);
    if (isNowRunning) {
      console.log(`Rigctld started successfully on port ${rigPort}`);
    } else {
      console.log('Rigctld may not have started properly');
    }
  } catch (error) {
    console.error('Error starting rigctld:', error);
  }
}

// Stop rigctld process
function stopRigctld(): void {
  if (rigctldProcess) {
    console.log('Stopping rigctld process...');
    rigctldProcess.kill('SIGTERM');
    rigctldProcess = null;
  }
}

// Start rigctld with elevated (admin) privileges - one-time use
async function startRigctldElevated(): Promise<{
  success: boolean;
  error?: string;
  userCancelled?: boolean;
}> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Elevated start only supported on Windows' };
  }

  try {
    // Load settings to get rig configuration
    let settings;
    try {
      if (fs.existsSync(userSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      } else if (fs.existsSync(defaultSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load settings for elevated rigctld startup:', error);
    }

    // Get rig configuration from settings
    const rigConfig = settings?.rig || {};
    const rigModel = rigConfig.rigModel || 1025; // Default to Yaesu FT-1000MP
    const rigDevice = rigConfig.device || ''; // Default device
    const rigPort = rigConfig.port || 4532; // Default port

    // Get rigctld path
    const rigctldPath = getRigctldPath() || 'rigctld.exe';

    // Build arguments
    const args = [`-m ${rigModel}`];

    // Add device parameter only if model is not 1 (dummy) and device is specified
    if (rigModel !== 1 && rigDevice) {
      args.push(`-r ${rigDevice}`);
    }

    // Add port if different from default
    if (rigPort !== 4532) {
      args.push(`-t ${rigPort}`);
    }

    const argsString = args.join(' ');

    console.log('Starting rigctld with elevated privileges:', rigctldPath, argsString);

    // PowerShell command to start rigctld as admin
    const psCommand = `
      try {
        $rigctldPath = '${rigctldPath.replace(/\\/g, '\\\\')}'
        $arguments = '${argsString}'

        # Start rigctld as admin
        Start-Process -FilePath $rigctldPath -ArgumentList $arguments -Verb RunAs

        Write-Output "Started rigctld with elevated privileges"
      } catch {
        Write-Error "Failed to start rigctld: $($_.Exception.Message)"
        exit 1
      }
    `;

    return new Promise(resolve => {
      const command = `powershell -Command "& {${psCommand.replace(/"/g, '\\"')}}"`;

      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Error starting elevated rigctld:', error);

          // Check if user cancelled UAC prompt
          if (error.message.includes('cancelled') || error.message.includes('1223')) {
            console.warn('User cancelled elevated rigctld start');
            resolve({ success: false, userCancelled: true });
            return;
          }

          resolve({ success: false, error: error.message });
          return;
        }

        if (stderr) {
          console.warn('Elevated rigctld stderr:', stderr);
        }

        console.log('Elevated rigctld started:', stdout);

        // Note: The elevated rigctld process runs independently
        // We can't track it in rigctldProcess since it's not a child process
        resolve({ success: true });
      });
    });
  } catch (error) {
    console.error('Error starting elevated rigctld:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // Open the DevTools.
  } else {
    mainWindow.loadFile(join(__dirname, '../../../index.html'));
  }

  mainWindow.maximize();
  // mainWindow.loadURL( //this doesn't work on macOS in build and preview mode
  //     isDev ?
  //     'http://localhost:3000' :
  //     join(__dirname, '../../index.html')
  // );
}

// Set up IPC handlers for database operations
ipcMain.handle('qso:add', async (_, qso) => {
  return await databaseService.saveQso(qso);
});

ipcMain.handle('qso:getAllDocs', async () => {
  try {
    const qsos = await databaseService.getAllQsos();
    return {
      rows: qsos.map(doc => ({
        doc,
        id: doc._id,
        value: { rev: doc._rev },
      })),
    };
  } catch (error) {
    console.error('Failed to get all docs:', error);
    return { rows: [] };
  }
});

// Add QSO update handler
ipcMain.handle('qso:update', async (_, qso) => {
  try {
    return await databaseService.updateQso(qso);
  } catch (error) {
    console.error('Failed to update QSO:', error);
    throw error;
  }
});

// Add QSO delete handler
ipcMain.handle('qso:delete', async (_, qsoId: string) => {
  try {
    return await databaseService.deleteQso(qsoId);
  } catch (error) {
    console.error('Failed to delete QSO:', error);
    throw error;
  }
});

// ADIF Import handler
ipcMain.handle('adif:import', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'ADIF Files', extensions: ['adi', 'adif'] }],
    });

    if (filePaths.length === 0) return { imported: false };

    const content = fs.readFileSync(filePaths[0], 'utf8');
    const records = parseAdif(content);

    // Convert ADIF records to QSO format and save to DB
    for (const record of records) {
      const qso: QsoEntry = {
        callsign: record.call,
        datetime: new Date(
          `${record.qso_date.replace(
            /(\d{4})(\d{2})(\d{2})/,
            '$1-$2-$3'
          )}T${record.time_on.replace(/(\d{2})(\d{2})(\d{2})?/, '$1:$2')}Z`
        ).toISOString(),
        band: record.band,
        freqRx: parseFloat(record.freq) || 0,
        mode: record.mode,
        rstr: record.rst_rcvd || '59',
        rstt: record.rst_sent || '59',
        remark: record.comment || '--',
        notes: record.notes || '--',
        // Award-related fields from ADIF
        state: record.state || undefined,
        grid: record.gridsquare || undefined,
        country: record.country || undefined,
        cqZone: record.cqz ? parseInt(record.cqz) : undefined,
        ituZone: record.ituz ? parseInt(record.ituz) : undefined,
        iota: record.iota || undefined,
        dxccEntity: record.dxcc ? parseInt(record.dxcc) : undefined,
      };

      await databaseService.saveQso(qso);
    }

    return { imported: true, count: records.length };
  } catch (error) {
    console.error('ADIF import error:', error);
    return { imported: false, error };
  }
});

// ADIF file selection handler
ipcMain.handle('adif:selectFile', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'ADIF Files', extensions: ['adi', 'adif'] }],
    });

    if (filePaths.length === 0) {
      return { success: false };
    }

    return { success: true, filePath: filePaths[0] };
  } catch (error) {
    console.error('ADIF file selection error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// ADIF file parsing handler
ipcMain.handle('adif:parseFile', async (_, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parseAdif(content);

    return { success: true, totalCount: records.length };
  } catch (error) {
    console.error('ADIF file parsing error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// ADIF import with progress handler
ipcMain.handle('adif:importWithProgress', async (event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parseAdif(content);
    let importedCount = 0;

    // Convert ADIF records to QSO format and save to DB with progress updates
    for (const record of records) {
      const qso: QsoEntry = {
        callsign: record.call,
        datetime: new Date(
          `${record.qso_date.replace(
            /(\d{4})(\d{2})(\d{2})/,
            '$1-$2-$3'
          )}T${record.time_on.replace(/(\d{2})(\d{2})(\d{2})?/, '$1:$2')}Z`
        ).toISOString(),
        band: record.band,
        freqRx: parseFloat(record.freq) || 0,
        mode: record.mode,
        rstr: record.rst_rcvd || '59',
        rstt: record.rst_sent || '59',
        remark: record.comment || '--',
        notes: record.notes || '--',
        // Award-related fields from ADIF
        state: record.state || undefined,
        grid: record.gridsquare || undefined,
        country: record.country || undefined,
        cqZone: record.cqz ? parseInt(record.cqz) : undefined,
        ituZone: record.ituz ? parseInt(record.ituz) : undefined,
        iota: record.iota || undefined,
        dxccEntity: record.dxcc ? parseInt(record.dxcc) : undefined,
      };

      await databaseService.saveQso(qso);
      importedCount++;

      // Send progress update every 10 records or on the last record
      if (importedCount % 10 === 0 || importedCount === records.length) {
        event.sender.send('adif:importProgress', { imported: importedCount });
      }
    }

    return { success: true, count: importedCount };
  } catch (error) {
    console.error('ADIF import with progress error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// ADIF save file handler
ipcMain.handle('adif:saveFile', async (_, content: string) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `hamledger-export-${new Date().toISOString().split('T')[0]}.adi`,
      filters: [{ name: 'ADIF Files', extensions: ['adi', 'adif'] }],
    });

    if (!filePath) {
      return { success: false, error: 'No file selected' };
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, filePath };
  } catch (error) {
    console.error('ADIF save file error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Propagation Data API handler
ipcMain.handle('fetchPropagationData', async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const baseUrl = settings?.apis?.wwv?.baseUrl || 'https://dxheat.com/wwv';
    const url = `${baseUrl}/source/`;

    // Check for proxy environment variables
    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;

    const fetchOptions: FetchOptions = {
      headers: {
        'User-Agent': 'HamLedger/1.0',
        Accept: 'application/json',
      },
      timeout: 30000, // 30 second timeout
    };

    // Use proxy agent if proxy is configured
    if (proxyUrl) {
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      console.log(`Using proxy: ${proxyUrl}`);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Propagation Data API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Weather API handler
ipcMain.handle('fetchWeather', async (event, lat: number, lon: number) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const baseUrl = settings?.apis?.openMeteo?.baseUrl || 'https://api.open-meteo.com/v1';
    const url = `${baseUrl}/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    // Check for proxy environment variables
    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;

    const fetchOptions: FetchOptions = {
      headers: {
        'User-Agent': 'HamLedger/1.0',
        Accept: 'application/json',
      },
      timeout: 30000, // 30 second timeout
    };

    // Use proxy agent if proxy is configured
    if (proxyUrl) {
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      console.log(`Using proxy: ${proxyUrl}`);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Weather API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// DX Spots API handler
ipcMain.handle('fetchDxSpots', async (event, params: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const baseUrl = settings?.apis?.dxheat?.baseUrl || 'https://dxheat.com';
    const url = `${baseUrl}/source/spots/?${params}`;

    // Check for proxy environment variables
    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;

    const fetchOptions: FetchOptions = {
      headers: {
        'User-Agent': 'HamLedger/1.0',
        Accept: 'application/json',
      },
      timeout: 30000, // 30 second timeout
    };

    // Use proxy agent if proxy is configured
    if (proxyUrl) {
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      console.log(`Using proxy: ${proxyUrl}`);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('DX Spots API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // On Windows, silently check and add firewall exceptions if needed
  if (process.platform === 'win32') {
    try {
      console.log('Checking Windows Firewall rules on startup...');
      const firewallResult = await addFirewallExceptions(true); // checkOnly mode
      if (!firewallResult.rulesExist) {
        console.log('Firewall rules do not exist, will prompt when needed');
      }
    } catch (error) {
      console.warn('Startup firewall check failed:', error);
      // Continue anyway - will attempt configuration when needed
    }
  }

  // Try to start rigctld before creating the window
  await startRigctld();

  // Initialize WSJT-X service
  await initializeWSJTX();

  createWindow();
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Stop rigctld when app is closing
  stopRigctld();

  // Stop WSJT-X service
  wsjtxService.stop();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', () => {
  stopRigctld();
  wsjtxService.stop();
});

// Rigctld connection management
let rigctldSocket: Socket | null = null;

// Rigctld handlers
ipcMain.handle('rigctld:connect', async (_, host: string, port: number, attemptFirewallFix: boolean = true) => {
  try {
    // Close existing connection if any
    if (rigctldSocket) {
      rigctldSocket.destroy();
      rigctldSocket = null;
    }

    // First, check if rigctld is already running on the port
    const portInUse = await isPortInUse(port, host);
    const isOurProcess = rigctldProcess !== null && !rigctldProcess.killed;
    const isExternalRigctld = portInUse && !isOurProcess;

    if (isExternalRigctld) {
      console.log(`Detected external rigctld running on ${host}:${port}, will connect to it`);
    } else if (!portInUse) {
      // rigctld is not running - we could try to start it, but for now just report this
      console.log(`No rigctld detected on ${host}:${port}`);
    }

    return new Promise(resolve => {
      rigctldSocket = new Socket();

      rigctldSocket.setTimeout(5000);

      rigctldSocket.on('connect', () => {
        console.log(`Connected to rigctld at ${host}:${port}${isExternalRigctld ? ' (external)' : ''}`);
        resolve({ 
          success: true, 
          data: { 
            connected: true,
            isExternal: isExternalRigctld,
          } 
        });
      });

      rigctldSocket.on('error', error => {
        console.error('Rigctld connection error:', error);
        rigctldSocket = null;

        void (async () => {
          // Provide more detailed error information
          let detailedError = error.message;
          const suggestions: string[] = [];

          // Check if the port is listening at all
          const portCheck = await isPortInUse(port, host);
          if (!portCheck) {
            detailedError = 'rigctld is not running or not listening on the configured port';
            suggestions.push('Make sure rigctld is started');
            suggestions.push('Check that the port number is correct');
          }

          // On Windows, automatically attempt to add firewall exceptions on first connection failure
          if (process.platform === 'win32' && attemptFirewallFix) {
            console.log('Connection failed, attempting to configure Windows Firewall...');

            try {
              const firewallResult = await addFirewallExceptions();

              if (firewallResult.success) {
                // Firewall configured successfully, indicate to retry connection
                resolve({
                  success: false,
                  error: detailedError,
                  firewallConfigured: true,
                  shouldRetry: true,
                  suggestions,
                });
              } else if (firewallResult.userCancelled) {
                // User cancelled UAC prompt
                suggestions.push('Firewall configuration was cancelled');
                resolve({
                  success: false,
                  error: detailedError,
                  firewallConfigured: false,
                  userCancelled: true,
                  suggestions,
                });
              } else {
                // Firewall configuration failed for other reason
                suggestions.push('Try running HamLedger as Administrator');
                resolve({
                  success: false,
                  error: detailedError,
                  firewallConfigured: false,
                  firewallError: firewallResult.error,
                  suggestions,
                });
              }
            } catch (firewallError) {
              // Error during firewall configuration attempt
              console.error('Error during firewall configuration:', firewallError);
              suggestions.push('Firewall configuration failed');
              resolve({
                success: false,
                error: detailedError,
                firewallConfigured: false,
                firewallError: firewallError instanceof Error ? firewallError.message : 'Unknown error',
                suggestions,
              });
            }
          } else {
            // Not Windows or not attempting firewall fix
            resolve({
              success: false,
              error: detailedError,
              suggestions,
            });
          }
        })();
      });

      rigctldSocket.on('timeout', () => {
        console.error('Rigctld connection timeout');
        rigctldSocket?.destroy();
        rigctldSocket = null;
        resolve({ 
          success: false, 
          error: 'Connection timeout - rigctld may not be responding',
          suggestions: [
            'Check if rigctld is running',
            'Verify the host and port are correct',
            'Check firewall settings',
          ],
        });
      });

      rigctldSocket.connect(port, host);
    });
  } catch (error) {
    console.error('Rigctld connect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('rigctld:disconnect', async () => {
  try {
    if (rigctldSocket) {
      rigctldSocket.destroy();
      rigctldSocket = null;
      console.log('Disconnected from rigctld');
    }
    return { success: true, data: { connected: false } };
  } catch (error) {
    console.error('Rigctld disconnect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('rigctld:command', async (_, command: string) => {
  try {
    if (!rigctldSocket) {
      return { success: false, error: 'Not connected to rigctld' };
    }

    return new Promise(resolve => {
      let responseData = '';

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Command timeout' });
      }, 5000);

      const onData = (data: Buffer) => {
        responseData += data.toString();

        // Extended Response Protocol: look for RPRT at the end
        if (responseData.includes('RPRT ')) {
          clearTimeout(timeout);
          rigctldSocket?.off('data', onData);

          const lines = responseData.trim().split('\n');

          // Find the RPRT line (should be last)
          const rprtLine = lines.find(line => line.startsWith('RPRT '));
          if (!rprtLine) {
            resolve({ success: false, error: 'Invalid response format' });
            return;
          }

          const errorCode = parseInt(rprtLine.split(' ')[1]);
          if (errorCode !== 0) {
            resolve({ success: false, error: `Rigctld error code: ${errorCode}` });
            return;
          }

          // Parse Extended Response Protocol format
          const dataLines = lines.filter(
            line => !line.startsWith('RPRT ') && line.includes(':') && !line.endsWith(':')
          );

          if (dataLines.length > 0) {
            // Extract values from "Key: Value" format
            const values = dataLines.map(line => {
              const colonIndex = line.indexOf(': ');
              return colonIndex !== -1 ? line.substring(colonIndex + 2) : line;
            });
            resolve({ success: true, data: values });
          } else {
            // For set commands, no data is returned
            resolve({ success: true, data: null });
          }
        }
      };

      rigctldSocket?.on('data', onData);
      // Use Extended Response Protocol with '+' prefix for newline separation
      rigctldSocket?.write('+' + command + '\n');
    });
  } catch (error) {
    console.error('Rigctld command error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('rigctld:capabilities', async () => {
  try {
    if (!rigctldSocket) {
      return { success: false, error: 'Not connected to rigctld' };
    }

    return new Promise(resolve => {
      let responseData = '';

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Capabilities timeout' });
      }, 10000);

      const onData = (data: Buffer) => {
        responseData += data.toString();

        // Extended Response Protocol: look for RPRT at the end
        if (responseData.includes('RPRT ')) {
          clearTimeout(timeout);
          rigctldSocket?.off('data', onData);

          const lines = responseData.trim().split('\n');
          const rprtIndex = lines.findIndex(line => line.startsWith('RPRT '));

          if (rprtIndex > 0) {
            // Skip the command echo line and get capability data
            const capabilityLines = lines.slice(1, rprtIndex);
            resolve({ success: true, data: capabilityLines });
          } else {
            resolve({ success: false, error: 'Invalid capabilities response' });
          }
        }
      };

      rigctldSocket?.on('data', onData);
      // Use Extended Response Protocol with '+' prefix
      rigctldSocket?.write('+dump_caps\n');
    });
  } catch (error) {
    console.error('Rigctld capabilities error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Check if rigctld is running (quick check for startup detection)
ipcMain.handle('rigctld:checkRunning', async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const rigConfig = settings?.rig || {};
    const rigPort = rigConfig.port || 4532;

    // Check if port is in use (something is listening)
    const portInUse = await isPortInUse(rigPort);

    if (!portInUse) {
      return {
        success: true,
        data: {
          running: false,
          external: false,
          port: rigPort,
        },
      };
    }

    // Port is in use - check if it's our process or an external one
    const isOurProcess = rigctldProcess !== null && !rigctldProcess.killed;

    return {
      success: true,
      data: {
        running: true,
        external: !isOurProcess,
        pid: isOurProcess && rigctldProcess ? rigctldProcess.pid : undefined,
        port: rigPort,
      },
    };
  } catch (error) {
    console.error('Error checking rigctld running status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Run full rigctld diagnostics
ipcMain.handle('rigctld:diagnostics', async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const rigConfig = settings?.rig || {};
    const rigPort = rigConfig.port || 4532;
    const rigHost = rigConfig.host || 'localhost';

    const diagnostics = {
      processRunning: false,
      processPath: undefined as string | undefined,
      processPid: undefined as number | undefined,
      portListening: false,
      portInUseByOther: false,
      tcpConnectable: false,
      firewallOk: true,
      firewallError: undefined as string | undefined,
      isExternalRigctld: false,
      error: undefined as string | undefined,
      suggestions: [] as string[],
      timestamp: new Date(),
    };

    // 1. Check if rigctld process is running
    const processCheck = await checkRigctldProcess();
    diagnostics.processRunning = processCheck.running;
    diagnostics.processPath = processCheck.path;
    diagnostics.processPid = processCheck.pid;

    // 2. Check if port is listening
    diagnostics.portListening = await isPortInUse(rigPort, rigHost);

    // 3. Determine if it's our rigctld or external
    const isOurProcess = rigctldProcess !== null && !rigctldProcess.killed;
    if (diagnostics.portListening && !isOurProcess) {
      diagnostics.isExternalRigctld = true;
    }

    // 4. Check if port is in use by something other than rigctld
    if (diagnostics.portListening && !diagnostics.processRunning) {
      diagnostics.portInUseByOther = true;
    }

    // 5. Test TCP connection
    if (diagnostics.portListening) {
      diagnostics.tcpConnectable = await testTcpConnection(rigHost, rigPort);
    }

    // 6. Check firewall (Windows only)
    if (process.platform === 'win32') {
      const firewallCheck = await checkFirewallRules();
      diagnostics.firewallOk = firewallCheck.ok;
      diagnostics.firewallError = firewallCheck.error;
    }

    // 7. Generate suggestions based on findings
    if (!diagnostics.processRunning && !diagnostics.portListening) {
      diagnostics.suggestions.push('rigctld is not running. Click "Connect" to start it, or start it manually.');
      
      // Check if rigctld exists at expected path
      const rigctldPath = getRigctldPath();
      if (rigctldPath && process.platform === 'win32') {
        if (!fs.existsSync(rigctldPath)) {
          diagnostics.suggestions.push('rigctld.exe not found. You may need to install Hamlib or configure the path.');
        }
      }
    }

    if (diagnostics.portInUseByOther) {
      diagnostics.suggestions.push(`Port ${rigPort} is in use by another application. Check if another ham radio program is using rigctld.`);
    }

    if (diagnostics.isExternalRigctld) {
      diagnostics.suggestions.push('An external rigctld instance is running. HamLedger will connect to it instead of starting its own.');
    }

    if (diagnostics.portListening && !diagnostics.tcpConnectable) {
      diagnostics.suggestions.push('Port is listening but TCP connection failed. This may be a firewall issue.');
      
      if (process.platform === 'win32') {
        diagnostics.suggestions.push('Try running HamLedger as Administrator or check Windows Firewall settings.');
      }
    }

    if (!diagnostics.firewallOk && process.platform === 'win32') {
      diagnostics.suggestions.push('Windows Firewall may be blocking the connection. Click "Add Firewall Exception" in settings.');
      if (diagnostics.firewallError) {
        diagnostics.suggestions.push(`Firewall error: ${diagnostics.firewallError}`);
      }
    }

    if (diagnostics.processRunning && diagnostics.portListening && diagnostics.tcpConnectable) {
      diagnostics.suggestions.push('Everything looks good! rigctld is running and accessible.');
    }

    return {
      success: true,
      data: diagnostics,
    };
  } catch (error) {
    console.error('Error running rigctld diagnostics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Helper function to check if rigctld process is running
async function checkRigctldProcess(): Promise<{ running: boolean; path?: string; pid?: number }> {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      // Windows: use tasklist
      exec('tasklist /FI "IMAGENAME eq rigctld.exe" /FO CSV /NH', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve({ running: false });
          return;
        }
        
        // Parse CSV output
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.includes('rigctld.exe')) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const pid = parseInt(parts[1].replace(/"/g, ''));
              resolve({ running: true, path: 'rigctld.exe', pid });
              return;
            }
          }
        }
        resolve({ running: false });
      });
    } else {
      // Linux/Mac: use pgrep
      exec('pgrep -x rigctld', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve({ running: false });
          return;
        }
        
        const pid = parseInt(stdout.trim().split('\n')[0]);
        if (!isNaN(pid)) {
          resolve({ running: true, pid });
        } else {
          resolve({ running: false });
        }
      });
    }
  });
}

// Helper function to test TCP connection
async function testTcpConnection(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new Socket();
    let resolved = false;

    socket.setTimeout(3000);

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

// Helper function to check Windows firewall rules
async function checkFirewallRules(): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: true };
  }

  return new Promise(resolve => {
    const checkCommand = `powershell -Command "Get-NetFirewallRule -DisplayName '*HamLedger*' -ErrorAction SilentlyContinue | Select-Object -First 1"`;

    exec(checkCommand, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        // Can't check firewall rules - might be permission issue
        resolve({ ok: false, error: 'Unable to check firewall rules. May require administrator privileges.' });
        return;
      }

      const rulesExist = stdout && stdout.trim().length > 0;
      if (rulesExist) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: 'No firewall rules found for HamLedger or rigctld.' });
      }
    });
  });
}

// Execute command handler
ipcMain.handle('execute:command', async (_, command: string) => {
  try {
    return new Promise(resolve => {
      exec(command, { timeout: 10000 }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error('Command execution error:', error);
          resolve({ success: false, error: error.message });
          return;
        }

        if (stderr) {
          console.warn('Command stderr:', stderr);
        }

        resolve({ success: true, data: stdout });
      });
    });
  } catch (error) {
    console.error('Execute command error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Check if rigctld is in PATH
ipcMain.handle('hamlib:checkRigctldInPath', async () => {
  try {
    return new Promise(resolve => {
      const command = process.platform === 'win32' ? 'where rigctld' : 'which rigctld';
      exec(command, { timeout: 5000 }, (error: Error | null, stdout: string) => {
        if (error) {
          resolve({ success: false, inPath: false });
          return;
        }
        resolve({ success: true, inPath: true, path: stdout.trim() });
      });
    });
  } catch (error) {
    console.error('Error checking rigctld in PATH:', error);
    return { success: false, inPath: false };
  }
});

// Download and install Hamlib for Windows
ipcMain.handle('hamlib:downloadAndInstall', async event => {
  try {
    const hamlibUrl =
      'https://github.com/Hamlib/Hamlib/releases/download/4.6.5/hamlib-w64-4.6.5.zip';
    const userDataPath = getHamLedgerDataPath();
    const hamlibDir = join(userDataPath, 'hamlib');
    const zipPath = join(userDataPath, 'hamlib-w64-4.6.5.zip');
    const hamlibBinPath = join(hamlibDir, 'bin');

    // Create hamlib directory if it doesn't exist
    if (!fs.existsSync(hamlibDir)) {
      fs.mkdirSync(hamlibDir, { recursive: true });
    }

    // Check if already installed
    if (fs.existsSync(join(hamlibBinPath, 'rigctld.exe'))) {
      return { success: true, message: 'Hamlib already installed', path: hamlibBinPath };
    }

    // Download progress callback
    const sendProgress = (progress: number) => {
      event.sender.send('hamlib:downloadProgress', { progress });
    };

    // Download the zip file
    console.log('Downloading Hamlib...');
    sendProgress(0);

    const response = await fetch(hamlibUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    let downloadedSize = 0;

    const fileStream = createWriteStream(zipPath);
    const pipelineAsync = promisify(pipeline);

    // Track download progress
    response.body?.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      if (totalSize > 0) {
        const progress = Math.round((downloadedSize / totalSize) * 50); // 50% for download
        sendProgress(progress);
      }
    });

    await pipelineAsync(response.body!, fileStream);
    console.log('Download completed');

    // Extract the zip file
    console.log('Extracting Hamlib...');
    sendProgress(60);

    const tempExtractDir = join(userDataPath, 'hamlib_temp');

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(Extract({ path: tempExtractDir }))
        .on('close', () => {
          console.log('Extraction completed');
          sendProgress(70);
          resolve();
        })
        .on('error', reject);
    });

    // Find the extracted folder (should be something like hamlib-w64-4.6.5)
    const extractedContents = fs.readdirSync(tempExtractDir);
    const hamlibFolder = extractedContents.find(item => {
      const itemPath = join(tempExtractDir, item);
      return fs.statSync(itemPath).isDirectory() && item.startsWith('hamlib');
    });

    if (!hamlibFolder) {
      throw new Error('Hamlib folder not found in extracted archive');
    }

    const extractedHamlibPath = join(tempExtractDir, hamlibFolder);
    console.log('Found Hamlib folder:', hamlibFolder);

    // Move contents from extracted folder to final destination
    const moveContents = (src: string, dest: string) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const items = fs.readdirSync(src);
      for (const item of items) {
        const srcPath = join(src, item);
        const destPath = join(dest, item);

        if (fs.statSync(srcPath).isDirectory()) {
          moveContents(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    moveContents(extractedHamlibPath, hamlibDir);
    sendProgress(80);

    // Clean up temporary extraction directory and zip file
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    // Verify installation
    if (!fs.existsSync(join(hamlibBinPath, 'rigctld.exe'))) {
      throw new Error('rigctld.exe not found after extraction');
    }

    sendProgress(90);

    // Add firewall exceptions
    const firewallResult = await addFirewallExceptions();
    if (!firewallResult.success && firewallResult.userCancelled) {
      console.warn('User cancelled firewall configuration during Hamlib installation');
    }
    sendProgress(100);

    console.log('Hamlib installation completed');
    console.log('Hamlib installed at:', hamlibBinPath);
    return { success: true, message: 'Hamlib installed successfully', path: hamlibBinPath };
  } catch (error) {
    console.error('Hamlib installation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Helper function to get rigctld path
function getRigctldPath(): string | null {
  if (process.platform !== 'win32') {
    return null; // On non-Windows, rigctld should be in PATH
  }

  try {
    const userDataPath = getHamLedgerDataPath();
    const hamlibBinPath = join(userDataPath, 'hamlib', 'bin', 'rigctld.exe');

    if (fs.existsSync(hamlibBinPath)) {
      return hamlibBinPath;
    }

    // Fallback: try to find rigctld in PATH
    return 'rigctld.exe';
  } catch (error) {
    console.warn('Error getting rigctld path:', error);
    return 'rigctld.exe';
  }
}

// Add Windows Firewall exceptions for HamLedger and rigctld
// checkOnly: if true, only checks if rules exist without creating them (silent mode)
async function addFirewallExceptions(checkOnly: boolean = false): Promise<{
  success: boolean;
  userCancelled?: boolean;
  error?: string;
  rulesExist?: boolean;
}> {
  if (process.platform !== 'win32') {
    return { success: true, rulesExist: true }; // Only for Windows
  }

  const appPath = process.execPath;
  const appName = 'HamLedger';
  const rigctldPath = getRigctldPath();

  // First, check if rules already exist
  return new Promise(resolve => {
    const checkCommand = `powershell -Command "Get-NetFirewallRule -DisplayName '*HamLedger*' -ErrorAction SilentlyContinue | Select-Object -First 1"`;

    exec(checkCommand, { timeout: 5000 }, (checkError, checkStdout) => {
      const rulesExist = !checkError && checkStdout && checkStdout.trim().length > 0;

      if (rulesExist && checkOnly) {
        console.log('Firewall rules already exist, skipping configuration');
        resolve({ success: true, rulesExist: true });
        return;
      }

      if (rulesExist) {
        console.log('Firewall rules already exist');
      }

      // If checkOnly, we're done
      if (checkOnly) {
        resolve({ success: true, rulesExist: false });
        return;
      }

      // Create or update firewall rules
      const psCommand = `
        try {
          # Add HamLedger to firewall exceptions
          $appPath = '${appPath.replace(/\\/g, '\\\\')}'
          $appName = '${appName}'

          # Check if rule already exists for HamLedger
          $existingRule = Get-NetFirewallRule -DisplayName "$appName*" -ErrorAction SilentlyContinue
          if (-not $existingRule) {
            New-NetFirewallRule -DisplayName "$appName - Inbound" -Direction Inbound -Program $appPath -Action Allow -Profile Any
            New-NetFirewallRule -DisplayName "$appName - Outbound" -Direction Outbound -Program $appPath -Action Allow -Profile Any
            Write-Output "Added firewall rules for $appName"
          } else {
            Write-Output "Firewall rules for $appName already exist"
          }

          # Add rigctld to firewall exceptions with specific path
          ${rigctldPath ? `$rigctldPath = '${rigctldPath.replace(/\\/g, '\\\\')}'` : ''}
          $rigctldRule = Get-NetFirewallRule -DisplayName "rigctld*" -ErrorAction SilentlyContinue
          if (-not $rigctldRule) {
            ${rigctldPath ? `New-NetFirewallRule -DisplayName "rigctld - Inbound" -Direction Inbound -Program $rigctldPath -Action Allow -Profile Any` : ''}
            ${rigctldPath ? `New-NetFirewallRule -DisplayName "rigctld - Outbound" -Direction Outbound -Program $rigctldPath -Action Allow -Profile Any` : ''}
            # Also add generic rule for any rigctld.exe as fallback
            New-NetFirewallRule -DisplayName "rigctld (any) - Inbound" -Direction Inbound -Program "*rigctld.exe" -Action Allow -Profile Any
            New-NetFirewallRule -DisplayName "rigctld (any) - Outbound" -Direction Outbound -Program "*rigctld.exe" -Action Allow -Profile Any
            Write-Output "Added firewall rules for rigctld"
          } else {
            Write-Output "Firewall rules for rigctld already exist"
          }

          Write-Output "Firewall configuration completed successfully"
        } catch {
          Write-Error "Failed to configure firewall: $($_.Exception.Message)"
          exit 1
        }
      `;

      // Run PowerShell command with elevated privileges
      const command = `powershell -Command "Start-Process powershell -ArgumentList '-Command', '${psCommand.replace(/'/g, "''")}' -Verb RunAs -Wait"`;

      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Error configuring firewall:', error);

          // Check if user cancelled UAC prompt
          if (error.message.includes('cancelled') || error.message.includes('1223')) {
            console.warn('User cancelled firewall configuration');
            resolve({ success: false, userCancelled: true, rulesExist: false });
            return;
          }

          // Other errors (no admin rights, etc.)
          console.warn('Firewall configuration failed, but continuing...');
          resolve({ success: false, error: error.message, rulesExist: false });
          return;
        }

        if (stderr) {
          console.warn('Firewall configuration stderr:', stderr);
        }

        console.log('Firewall configuration result:', stdout);
        resolve({ success: true, rulesExist: false });
      });
    });
  });
}


// Settings file path
const userSettingsPath = join(getHamLedgerDataPath(), 'settings.json');
const defaultSettingsPath = join(app.getAppPath(), 'src/settings.json');

// Load settings helper function
function loadSettings(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(userSettingsPath)) {
      return JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    }
    return JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
  } catch (error) {
    console.debug('Error loading settings:', error);
    return null;
  }
}

// Settings handlers
ipcMain.handle('settings:load', async () => {
  try {
    if (fs.existsSync(userSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      return settings;
    }
    // Return null if no user settings exist - this will trigger setup wizard
    return null;
  } catch (error) {
    console.debug('Error loading settings:', error);
    return null;
  }
});

ipcMain.handle('settings:save', async (_, settings: Record<string, unknown>) => {
  try {
    fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

// Restart rigctld with new settings
async function restartRigctld(): Promise<void> {
  console.log('Restarting rigctld...');
  stopRigctld();

  // Wait a moment for the process to fully stop
  await new Promise(resolve => setTimeout(resolve, 1000));

  await startRigctld();
}

// Rigctld restart handler
ipcMain.handle('rigctld:restart', async () => {
  try {
    await restartRigctld();
    return { success: true };
  } catch (error) {
    console.error('Error restarting rigctld:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Rigctld elevated start handler (one-time admin execution)
ipcMain.handle('rigctld:startElevated', async () => {
  try {
    // First, stop any existing normal rigctld process
    stopRigctld();

    // Wait a moment for the process to fully stop
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await startRigctldElevated();
    return result;
  } catch (error) {
    console.error('Error starting elevated rigctld:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Add firewall exceptions handler
ipcMain.handle('firewall:addExceptions', async () => {
  try {
    const result = await addFirewallExceptions();
    return result;
  } catch (error) {
    console.error('Error adding firewall exceptions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// WSJT-X initialization
async function initializeWSJTX(): Promise<void> {
  try {
    console.log('🔧 Initializing WSJT-X service...');

    // Always set up event listeners regardless of settings
    wsjtxService.on('qso', async (qso: WSJTXLoggedQSO) => {
      console.log('🎯 WSJT-X QSO event received in main process:', qso.dxCall);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings = loadSettings() as any;
      const wsjtxSettings = settings?.wsjtx || { enabled: false, port: 2237, autoLog: true };

      console.log('📋 WSJT-X settings:', wsjtxSettings);

      // Always handle QSO logging for now (can be made configurable later)
      if (wsjtxSettings.autoLog !== false) {
        console.log('✅ Processing WSJT-X QSO (auto-log enabled or default)');
        await handleWSJTXQSO(qso);
      } else {
        console.log('⚠️ WSJT-X auto-log is explicitly disabled, skipping QSO handling');
      }
    });

    wsjtxService.on('decode', (decode: unknown) => {
      // Forward decode messages to renderer if needed
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        window.webContents.send('wsjtx:decode', decode);
      });
    });

    wsjtxService.on('error', (error: Error) => {
      console.error('WSJT-X service error:', error);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = loadSettings() as any;
    const wsjtxSettings = settings?.wsjtx || { enabled: false, port: 2237, autoLog: true };

    if (wsjtxSettings.enabled) {
      wsjtxEnabled = true;
      // Start the service
      await wsjtxService.start();
      console.log('✅ WSJT-X service started and event listeners set up');
    } else {
      console.log('⚠️ WSJT-X service disabled in settings, but event listeners are ready');
    }
  } catch (error) {
    console.error('💥 Error initializing WSJT-X service:', error);
  }
}

// Handle WSJT-X QSO logging
async function handleWSJTXQSO(wsjtxQSO: WSJTXLoggedQSO): Promise<void> {
  try {
    console.log('🎯 Processing WSJT-X QSO in main process:', wsjtxQSO);

    // Convert WSJT-X QSO to HamLedger format
    const band = getBandFromFrequency(wsjtxQSO.txFrequency);

    const qso: QsoEntry = {
      callsign: wsjtxQSO.dxCall.toUpperCase(),
      datetime: wsjtxQSO.dateTimeOn.toISOString(),
      band: band ? band.name : 'Unknown',
      freqRx: wsjtxQSO.txFrequency / 1000000, // Convert Hz to MHz
      freqTx: wsjtxQSO.txFrequency / 1000000,
      mode: wsjtxQSO.mode,
      rstr: wsjtxQSO.reportReceived || '---',
      rstt: wsjtxQSO.reportSent || '---',
      remark: wsjtxQSO.comments || 'WSJT-X Auto-logged',
      notes: `Grid: ${wsjtxQSO.dxGrid || 'Unknown'}${wsjtxQSO.name ? `, Name: ${wsjtxQSO.name}` : ''}`,
    };

    console.log('📤 Sending WSJT-X QSO to renderer:', qso);

    // Send to renderer to add QSO using store's addQso method
    const windows = BrowserWindow.getAllWindows();
    console.log(`📡 Broadcasting to ${windows.length} windows`);

    windows.forEach((window, index) => {
      console.log(`📨 Sending wsjtx:add-qso to window ${index + 1}`);
      console.log(`📋 QSO data being sent:`, JSON.stringify(qso, null, 2));

      // Send the event
      window.webContents.send('wsjtx:add-qso', qso);

      // Verify the window is ready
      if (window.webContents.isLoading()) {
        console.warn(`⚠️ Window ${index + 1} is still loading, event may be lost`);
      } else {
        console.log(`✅ Event sent to ready window ${index + 1}`);
      }
    });
  } catch (error) {
    console.error('💥 Error handling WSJT-X QSO:', error);
  }
}

interface QslLabelData {
  callsign: string;
  name?: string;
  addr1?: string;
  addr2?: string;
  country?: string;
  date: string;
}

// QSL Labels generation handler (supports batch)
ipcMain.handle('qsl:generateLabels', async (_, labelDataArray: QslLabelData[]) => {
  try {
    const { jsPDF } = await import('jspdf');

    // Create new PDF document - A4 format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 dimensions: 210 x 297 mm
    // 3x8 grid = 24 labels per page
    const pageWidth = 210;
    const pageHeight = 297;
    const cols = 3;
    const rows = 8;
    const labelsPerPage = cols * rows;
    const labelWidth = pageWidth / cols;
    const labelHeight = pageHeight / rows;

    // Function to draw a single label
    const drawLabel = (labelData: QslLabelData, x: number, y: number) => {
      // Draw border around each label
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.1);
      doc.rect(x, y, labelWidth, labelHeight);

      // Center the address content vertically
      let currentY = y + 12;
      const leftMargin = x + 4;
      const maxWidth = labelWidth - 8;

      // Primary info: Name with callsign in brackets
      if (labelData.name) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const primaryInfo = `${labelData.name} (${labelData.callsign})`;
        const primaryLines = doc.splitTextToSize(primaryInfo, maxWidth);
        doc.text(primaryLines, leftMargin, currentY);
        currentY += primaryLines.length * 5;
      } else {
        // If no name, just show callsign
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(labelData.callsign, leftMargin, currentY);
        currentY += 5;
      }

      // Reset to normal font for address
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      // Add some spacing after name/callsign
      currentY += 2;

      // Address line 1
      if (labelData.addr1) {
        const addr1Lines = doc.splitTextToSize(labelData.addr1, maxWidth);
        doc.text(addr1Lines, leftMargin, currentY);
        currentY += addr1Lines.length * 4;
      }

      // Address line 2
      if (labelData.addr2) {
        const addr2Lines = doc.splitTextToSize(labelData.addr2, maxWidth);
        doc.text(addr2Lines, leftMargin, currentY);
        currentY += addr2Lines.length * 4;
      }

      // Country (emphasized)
      if (labelData.country) {
        currentY += 2; // Extra spacing before country
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(labelData.country.toUpperCase(), leftMargin, currentY);
      }
    };

    let labelIndex = 0;

    // Process each unique label data
    for (const labelData of labelDataArray) {
      // Calculate position on current page
      const positionOnPage = labelIndex % labelsPerPage;
      const row = Math.floor(positionOnPage / cols);
      const col = positionOnPage % cols;

      // Add new page if needed (except for first page)
      if (positionOnPage === 0 && labelIndex > 0) {
        doc.addPage();
      }

      const x = col * labelWidth;
      const y = row * labelHeight;

      // Draw the label
      drawLabel(labelData, x, y);

      labelIndex++;
    }

    // Generate filename
    let fileName;
    if (labelDataArray.length === 1) {
      fileName = `QSL_Labels_${labelDataArray[0].callsign}_${labelDataArray[0].date.replace(/\//g, '-')}.pdf`;
    } else {
      const timestamp = new Date().toISOString().split('T')[0];
      fileName = `QSL_Labels_Batch_${labelDataArray.length}_QSOs_${timestamp}.pdf`;
    }

    const filePath = join(app.getPath('downloads'), fileName);

    const pdfBuffer = doc.output('arraybuffer');
    fs.writeFileSync(filePath, new Uint8Array(pdfBuffer));

    return { success: true, filePath };
  } catch (error) {
    console.error('QSL labels generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// WSJT-X IPC handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
ipcMain.handle('wsjtx:start', async (_, _port: number = 2237) => {
  try {
    if (!wsjtxService.isRunning()) {
      await wsjtxService.start();
      wsjtxEnabled = true;
    }
    return { success: true };
  } catch (error) {
    console.error('Error starting WSJT-X service:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('wsjtx:stop', async () => {
  try {
    wsjtxService.stop();
    wsjtxEnabled = false;
    return { success: true };
  } catch (error) {
    console.error('Error stopping WSJT-X service:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('wsjtx:status', async () => {
  return {
    success: true,
    data: {
      enabled: wsjtxEnabled,
      running: wsjtxService.isRunning(),
    },
  };
});

// Open folder handler
ipcMain.handle('system:openFolder', async (_, filePath: string) => {
  try {
    const folderPath = path.dirname(filePath);
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error('Error opening folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
