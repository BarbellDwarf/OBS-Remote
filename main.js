const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let settingsWindow;
let OBSWebSocket;

// Load OBS WebSocket in main process
try {
  const obsws = require('obs-websocket-js');
  OBSWebSocket = obsws.default;
  // Export EventSubscription for use in connection
  exports.EventSubscription = obsws.EventSubscription;
  console.log('OBS WebSocket library loaded in main process');
} catch (error) {
  console.error('Failed to load OBS WebSocket library:', error);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1e1e1e',
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 720,
    minHeight: 640,
    parent: mainWindow || null,
    modal: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.removeMenu();
  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

// Store OBS instance in main process
let obs = null;

// IPC handlers for OBS operations
ipcMain.handle('obs:create', () => {
  try {
    if (!OBSWebSocket) {
      throw new Error('OBS WebSocket library not loaded');
    }
    obs = new OBSWebSocket();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('obs:connect', async (event, url, password) => {
  try {
    if (!obs) {
      throw new Error('OBS instance not created');
    }
    
    // Import EventSubscription enum
    const { EventSubscription } = require('obs-websocket-js');
    
    // Connect with InputVolumeMeters subscription
    // InputVolumeMeters is high-volume and not included in EventSubscription.All by default
    await obs.connect(url, password, {
      eventSubscriptions: EventSubscription.All | EventSubscription.InputVolumeMeters,
      rpcVersion: 1
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message, code: error.code };
  }
});

ipcMain.handle('obs:disconnect', async () => {
  try {
    if (obs) {
      await obs.disconnect();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('obs:call', async (event, requestType, requestData) => {
  try {
    if (!obs) {
      throw new Error('OBS instance not created');
    }
    const result = await obs.call(requestType, requestData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle OBS events by forwarding to renderer
function setupOBSEventForwarding() {
  if (!obs) return;
  
  const events = [
    'ConnectionClosed',
    'ConnectionError', 
    'CurrentProgramSceneChanged',
    'CurrentPreviewSceneChanged',  // Studio mode preview scene changes
    'SceneListChanged',
    'StreamStateChanged',
    'RecordStateChanged',
    'StudioModeStateChanged',
    'InputVolumeMeters'  // High-volume event for real-time audio level monitoring
  ];
  
  events.forEach(eventName => {
    obs.on(eventName, (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('obs:event', { eventName, data });
      }
    });
  });
}

ipcMain.handle('obs:setupEvents', () => {
  try {
    setupOBSEventForwarding();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:open', () => {
  try {
    createSettingsWindow();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
