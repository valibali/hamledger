// src/electron/main/main.ts
import { join } from "path";
import { app, BrowserWindow, ipcMain } from "electron";
import PouchDB from "pouchdb";
import fs from "fs";

const isDev = process.env.npm_lifecycle_event === "app:dev" ? true : false;

// Initialize PouchDB
const dbPath = join(app.getPath("userData"), "hamlogger.db");
const db = new PouchDB(dbPath);

// Ensure the database directory exists
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
    },
  });

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // Open the DevTools.
  } else {
    mainWindow.loadFile(join(__dirname, "../../index.html"));
  }

  mainWindow.maximize();
  // mainWindow.loadURL( //this doesn't work on macOS in build and preview mode
  //     isDev ?
  //     'http://localhost:3000' :
  //     join(__dirname, '../../index.html')
  // );
}

// Set up IPC handlers for database operations
ipcMain.handle("qso:add", async (_, qso) => {
  try {
    const response = await db.post(qso);
    // Write to JSON file as backup
    const jsonPath = join(app.getPath("userData"), "hamlogger.json");
    const allDocs = await db.allDocs({ include_docs: true });
    const jsonData = allDocs.rows.map((row) => row.doc);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    return { ok: true, id: response.id };
  } catch (error) {
    console.error("Failed to save QSO:", error);
    return { ok: false, error };
  }
});

ipcMain.handle("qso:getAllDocs", async () => {
  try {
    return await db.allDocs({ include_docs: true });
  } catch (error) {
    console.error("Failed to get all docs:", error);
    return { rows: [] };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
