// OBS Remote Control Application
// OBS WebSocket wrapper using IPC
class OBSWebSocketWrapper {
  constructor() {
    this.eventHandlers = {};
  }
  
  async connect(url, password) {
    const result = await window.electronAPI.obs.connect(url, password);
    if (!result.success) {
      const error = new Error(result.error);
      error.code = result.code;
      throw error;
    }
  }
  
  async disconnect() {
    const result = await window.electronAPI.obs.disconnect();
    if (!result.success) {
      throw new Error(result.error);
    }
  }
  
  async call(requestType, requestData) {
    const result = await window.electronAPI.obs.call(requestType, requestData);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }
  
  on(eventName, callback) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(callback);
  }
  
  _handleEvent(eventName, data) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => callback(data));
    }
  }
}

// Settings defaults
const SETTINGS_KEY = 'obsPreferences';
const SETTINGS_VERSION = 1;
const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  statsIntervalMs: 1000,
  syncIntervalMs: 1000,
  minDb: -60,
  maxDb: 0,
  theme: {
    mode: 'dark',
    accent: '#0084ff'
  },
  autoReconnect: {
    enabled: true,
    delayMs: 2000,
    jitterMs: 500,
    maxAttempts: 5
  },
  defaultConnectionName: '',
  shortcuts: {
    toggleConnect: 'Ctrl+Shift+C',
    toggleStream: 'Ctrl+Shift+S',
    toggleRecord: 'Ctrl+Shift+R',
    toggleStudioMode: 'Ctrl+Shift+M',
    triggerTransition: 'Ctrl+Shift+T'
  }
};

// Audio meter constants (mutable from settings)
let MIN_DB = DEFAULT_SETTINGS.minDb;  // Minimum dB level (silent/very quiet)
let MAX_DB = DEFAULT_SETTINGS.maxDb;    // Maximum dB level (peak/clipping)
let DB_RANGE = MAX_DB - MIN_DB;  // Total dB range (60)
const PEAK_THRESHOLD_DB = -5;  // dB level for peak indicator (red)
let preferences = { ...DEFAULT_SETTINGS };

let obs = null;
let isConnected = false;
let isStudioMode = false;
let currentScene = null;
let statsInterval = null;
let audioLevelIntervals = {};
let syncInterval = null; // For bidirectional sync
let isUserInteractingWithTransition = false; // Prevent sync from overwriting user changes
let lastConnectionDetails = null;
let autoReconnectTimeout = null;
let userInitiatedDisconnect = false;
let reconnectAttempts = 0;
let sceneThumbnails = {};
let thumbnailQueue = [];
let activeThumbnailRequests = 0;
let thumbnailRefreshInterval = null;
let thumbnailQueueSet = new Set();
const DEFAULT_THUMBNAIL_INTERVAL = 10; // seconds

// DOM Elements - with null checks for missing elements
const elements = {
  wsHost: document.getElementById('ws-host'),
  wsPort: document.getElementById('ws-port'),
  wsPassword: document.getElementById('ws-password'),
  connectBtn: document.getElementById('connect-btn'),
  statusIndicator: document.getElementById('status-indicator'),
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  scenesList: document.getElementById('scenes-list'),
  sourcesList: document.getElementById('sources-list'),
  audioMixer: document.getElementById('audio-mixer'), // Legacy - will be removed
  globalAudioMixer: document.getElementById('global-audio-mixer'),
  sceneAudioMixer: document.getElementById('scene-audio-mixer'),
  streamBtn: document.getElementById('stream-btn'),
  recordBtn: document.getElementById('record-btn'),
  pauseRecordBtn: document.getElementById('pause-record-btn'),
  virtualCamBtn: document.getElementById('virtualcam-btn'),
  studioModeToggle: document.getElementById('studio-mode-toggle'),
  singlePreview: document.getElementById('single-preview'),
  studioPreview: document.getElementById('studio-preview'),
  transitionBtn: document.getElementById('transition-btn'), // May be null (commented out in HTML)
  transitionSelect: document.getElementById('transition-select'),
  transitionDuration: document.getElementById('transition-duration'),
  streamTime: document.getElementById('stream-time'),
  fpsValue: document.getElementById('fps-value'),
  cpuValue: document.getElementById('cpu-value'),
  memoryValue: document.getElementById('memory-value'),
  bitrateValue: document.getElementById('bitrate-value'),
  droppedFrames: document.getElementById('dropped-frames'),
  savedConnections: document.getElementById('saved-connections'),
  saveConnectionBtn: document.getElementById('save-connection-btn'),
  deleteConnectionBtn: document.getElementById('delete-connection-btn'),
  collectionsList: document.getElementById('collections-list'),
  refreshCollections: document.getElementById('refresh-collections'),
  profilesList: document.getElementById('profiles-list'),
  refreshProfiles: document.getElementById('refresh-profiles'),
  recordingsList: document.getElementById('recordings-list'),
  refreshRecordings: document.getElementById('refresh-recordings'),
  layoutPresetSelect: document.getElementById('layout-preset-select'),
  saveLayoutPresetBtn: document.getElementById('save-layout-preset'),
  deleteLayoutPresetBtn: document.getElementById('delete-layout-preset'),
  resetLayoutPresetBtn: document.getElementById('reset-layout-preset'),
  layoutDensitySelect: document.getElementById('layout-density-select'),
  sidebarLeftWidth: document.getElementById('sidebar-left-width'),
  sidebarRightWidth: document.getElementById('sidebar-right-width')
};

const DEFAULT_LAYOUT_PRESETS = {
  expanded: { id: 'expanded', name: 'Expanded', density: 'expanded', sidebarLeft: 280, sidebarRight: 300 },
  compact: { id: 'compact', name: 'Compact', density: 'compact', sidebarLeft: 240, sidebarRight: 240 }
};

const LAYOUT_PRESETS_KEY = 'obsLayoutPresets';
const ACTIVE_LAYOUT_PRESET_KEY = 'obsActiveLayoutPreset';
let layoutPresets = { ...DEFAULT_LAYOUT_PRESETS };

const LAYOUT_LIMITS = {
  min: 200,
  max: 420
  openSettingsBtn: document.getElementById('open-settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  settingsCancelBtn: document.getElementById('settings-cancel-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsStatsInterval: document.getElementById('settings-stats-interval'),
  settingsSyncInterval: document.getElementById('settings-sync-interval'),
  settingsMinDb: document.getElementById('settings-min-db'),
  settingsMaxDb: document.getElementById('settings-max-db'),
  settingsAccent: document.getElementById('settings-accent'),
  settingsThemeMode: document.getElementById('settings-theme-mode'),
  settingsAutoReconnect: document.getElementById('settings-auto-reconnect'),
  settingsReconnectDelay: document.getElementById('settings-reconnect-delay'),
  settingsReconnectJitter: document.getElementById('settings-reconnect-jitter'),
  settingsReconnectAttempts: document.getElementById('settings-reconnect-attempts'),
  settingsDefaultConnection: document.getElementById('settings-default-connection'),
  shortcutInputs: document.querySelectorAll('.shortcut-input'),
  shortcutJson: document.getElementById('shortcut-json'),
  shortcutResetBtn: document.getElementById('shortcut-reset-btn'),
  shortcutExportBtn: document.getElementById('shortcut-export-btn'),
  shortcutImportBtn: document.getElementById('shortcut-import-btn')
  refreshScenes: document.getElementById('refresh-scenes'),
  thumbnailToggle: document.getElementById('thumbnail-toggle'),
  thumbnailInterval: document.getElementById('thumbnail-interval')
};

// Preferences helpers
function loadPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const merged = {
      ...DEFAULT_SETTINGS,
      ...stored,
      theme: { ...DEFAULT_SETTINGS.theme, ...(stored.theme || {}) },
      autoReconnect: { ...DEFAULT_SETTINGS.autoReconnect, ...(stored.autoReconnect || {}) },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(stored.shortcuts || {}) }
    };
    merged.version = SETTINGS_VERSION;
    return merged;
  } catch (e) {
    console.warn('Failed to load preferences, using defaults', e);
    return { ...DEFAULT_SETTINGS };
  }
}

function savePreferences(nextPrefs) {
  preferences = { ...preferences, ...nextPrefs };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
}

function applyPreferences() {
  MIN_DB = preferences.minDb;
  MAX_DB = preferences.maxDb;
  DB_RANGE = Math.max(1, MAX_DB - MIN_DB);

  // Theme
  const root = document.documentElement;
  const accent = preferences.theme?.accent || DEFAULT_SETTINGS.theme.accent;
  root.style.setProperty('--primary-color', accent);
  root.style.setProperty('--accent-color', accent);
  if (preferences.theme?.mode === 'dim') {
    root.style.setProperty('--dark-bg', '#1b1b1b');
    root.style.setProperty('--darker-bg', '#121212');
    root.style.setProperty('--panel-bg', '#1f1f1f');
  } else {
    root.style.setProperty('--dark-bg', '#1e1e1e');
    root.style.setProperty('--darker-bg', '#141414');
    root.style.setProperty('--panel-bg', '#252525');
  }
}

function populateSettingsUI() {
  if (!elements.settingsModal) return;
  elements.settingsStatsInterval.value = preferences.statsIntervalMs;
  elements.settingsSyncInterval.value = preferences.syncIntervalMs;
  elements.settingsMinDb.value = preferences.minDb;
  elements.settingsMaxDb.value = preferences.maxDb;
  elements.settingsAccent.value = preferences.theme?.accent || DEFAULT_SETTINGS.theme.accent;
  elements.settingsThemeMode.value = preferences.theme?.mode || DEFAULT_SETTINGS.theme.mode;
  elements.settingsAutoReconnect.checked = !!preferences.autoReconnect?.enabled;
  elements.settingsReconnectDelay.value = preferences.autoReconnect?.delayMs;
  elements.settingsReconnectJitter.value = preferences.autoReconnect?.jitterMs;
  elements.settingsReconnectAttempts.value = preferences.autoReconnect?.maxAttempts;
  updateShortcutInputsFromPreferences();
  updateShortcutJsonTextarea();
  refreshDefaultConnectionOptions();
}

function showSettingsModal() {
  populateSettingsUI();
  elements.settingsModal.style.display = 'flex';
}

function hideSettingsModal() {
  if (elements.settingsModal) elements.settingsModal.style.display = 'none';
}

function updateShortcutInputsFromPreferences() {
  if (!elements.shortcutInputs) return;
  elements.shortcutInputs.forEach(input => {
    const action = input.dataset.action;
    input.value = preferences.shortcuts[action] || '';
  });
}

function updateShortcutJsonTextarea() {
  if (elements.shortcutJson) {
    const source = (elements.settingsModal && elements.settingsModal.style.display !== 'none')
      ? readShortcutsFromInputs()
      : preferences.shortcuts;
    elements.shortcutJson.value = JSON.stringify(source, null, 2);
  }
}

function collectSettingsFromUI() {
  const next = { ...preferences };
  const statsInterval = parseInt(elements.settingsStatsInterval.value, 10);
  const syncInterval = parseInt(elements.settingsSyncInterval.value, 10);
  let minDb = parseInt(elements.settingsMinDb.value, 10);
  let maxDb = parseInt(elements.settingsMaxDb.value, 10);
  if (Number.isNaN(minDb)) minDb = DEFAULT_SETTINGS.minDb;
  if (Number.isNaN(maxDb)) maxDb = DEFAULT_SETTINGS.maxDb;
  if (minDb >= maxDb) {
    alert('Max dB must be greater than min dB. Please adjust and try again.');
    return null;
  }
  next.statsIntervalMs = Math.max(500, statsInterval || DEFAULT_SETTINGS.statsIntervalMs);
  next.syncIntervalMs = Math.max(500, syncInterval || DEFAULT_SETTINGS.syncIntervalMs);
  next.minDb = minDb;
  next.maxDb = maxDb;
  next.theme = {
    mode: elements.settingsThemeMode.value || DEFAULT_SETTINGS.theme.mode,
    accent: elements.settingsAccent.value || DEFAULT_SETTINGS.theme.accent
  };
  next.autoReconnect = {
    enabled: !!elements.settingsAutoReconnect.checked,
    delayMs: Math.max(500, parseInt(elements.settingsReconnectDelay.value, 10) || DEFAULT_SETTINGS.autoReconnect.delayMs),
    jitterMs: Math.max(0, parseInt(elements.settingsReconnectJitter.value, 10) || DEFAULT_SETTINGS.autoReconnect.jitterMs),
    maxAttempts: Math.max(1, parseInt(elements.settingsReconnectAttempts.value, 10) || DEFAULT_SETTINGS.autoReconnect.maxAttempts)
  };
  next.defaultConnectionName = elements.settingsDefaultConnection.value || '';
  next.shortcuts = readShortcutsFromInputs();
  return next;
}

function refreshDefaultConnectionOptions() {
  if (!elements.settingsDefaultConnection) return;
  const connections = getSavedConnections();
  elements.settingsDefaultConnection.innerHTML = '<option value="">None</option>';
  connections.forEach(conn => {
    const opt = document.createElement('option');
    opt.value = conn.name;
    opt.textContent = conn.name;
    elements.settingsDefaultConnection.appendChild(opt);
  });
  elements.settingsDefaultConnection.value = preferences.defaultConnectionName || '';
}

function normalizeShortcutFromEvent(event) {
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key);
  return parts.join('+');
}

function handleShortcutInputKeydown(e) {
  e.preventDefault();
  const combo = normalizeShortcutFromEvent(e);
  e.target.value = combo;
}

function readShortcutsFromInputs() {
  const next = { ...preferences.shortcuts };
  if (!elements.shortcutInputs) return next;
  elements.shortcutInputs.forEach(input => {
    const action = input.dataset.action;
    if (action && input.value.trim()) {
      next[action] = input.value.trim();
    }
  });
  return next;
}

function parseShortcutJsonTextarea() {
  if (!elements.shortcutJson || !elements.shortcutJson.value.trim()) return null;
  try {
    const parsed = JSON.parse(elements.shortcutJson.value);
    return parsed;
  } catch (e) {
    alert('Invalid JSON for shortcuts. Expect an object like {"toggleStream": "Ctrl+Shift+S"}.');
    return null;
  }
}

function buildNormalizedShortcutMap() {
  const map = {};
  Object.entries(preferences.shortcuts || {}).forEach(([action, combo]) => {
    if (combo) {
      map[combo.toUpperCase()] = action;
    }
  });
  return map;
}

function shouldBlockShortcuts(event) {
  const target = event.target;
  if (!target) return false;
  if (target.closest('[data-block-shortcuts]')) return true;
  if (isInteractiveElement(target)) return true;
  if (elements.settingsModal && elements.settingsModal.style.display !== 'none') {
    return true;
  }
  return false;
}

function isInteractiveElement(target) {
  const tag = target.tagName?.toLowerCase();
  if ((['input', 'textarea', 'select', 'button'].includes(tag) || target.isContentEditable) && !target.classList.contains('shortcut-input')) {
    return true;
  }
  return false;
}

function executeShortcutAction(action) {
  switch (action) {
    case 'toggleConnect':
      handleConnect();
      break;
    case 'toggleStream':
      toggleStreaming();
      break;
    case 'toggleRecord':
      toggleRecording();
      break;
    case 'toggleStudioMode':
      if (elements.studioModeToggle) {
        elements.studioModeToggle.checked = !elements.studioModeToggle.checked;
        toggleStudioMode();
      }
      break;
    case 'triggerTransition':
      performTransition();
      break;
    default:
      break;
  }
}

function registerGlobalShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (shouldBlockShortcuts(event)) return;
    const combo = normalizeShortcutFromEvent(event).toUpperCase();
    const map = buildNormalizedShortcutMap();
    const action = map[combo];
    if (action) {
      event.preventDefault();
      executeShortcutAction(action);
    }
  });
}

// Initialize
async function init() {
  console.log('Initializing OBS Remote Control...');
  console.log('electronAPI available:', typeof window.electronAPI);
  
  // Check if electronAPI is available
  if (typeof window.electronAPI === 'undefined' || typeof window.electronAPI.obs === 'undefined') {
    console.error('Electron API not available!');
    console.error('electronAPI:', window.electronAPI);
    alert('Error: Application API is not available. Please restart the application.');
    return;
  }
  
  try {
    // Create OBS instance in main process
    const createResult = await window.electronAPI.obs.create();
    if (!createResult.success) {
      throw new Error(createResult.error);
    }
    console.log('OBS instance created in main process');
    
    // Create wrapper instance
    obs = new OBSWebSocketWrapper();
    console.log('OBS wrapper created:', typeof obs);
    
    // Setup event forwarding
    window.electronAPI.obs.on((eventName, data) => {
      obs._handleEvent(eventName, data);
    });
    
    await window.electronAPI.obs.setupEvents();
    console.log('OBS event forwarding setup');
    
    setupEventListeners();
    loadConnectionsList();
    loadSettings();
    initializeLayoutPresets();
    console.log('OBS Remote Control initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to initialize: ' + error.message);
  }
}

// Setup event listeners with null checks
function setupEventListeners() {
  if (elements.connectBtn) elements.connectBtn.addEventListener('click', handleConnect);
  if (elements.streamBtn) elements.streamBtn.addEventListener('click', toggleStreaming);
  if (elements.recordBtn) elements.recordBtn.addEventListener('click', toggleRecording);
  if (elements.pauseRecordBtn) elements.pauseRecordBtn.addEventListener('click', pauseRecording);
  if (elements.virtualCamBtn) elements.virtualCamBtn.addEventListener('click', toggleVirtualCamera);
  if (elements.studioModeToggle) elements.studioModeToggle.addEventListener('change', toggleStudioMode);
  if (elements.transitionBtn) elements.transitionBtn.addEventListener('click', performTransition);
  if (elements.transitionSelect) {
    elements.transitionSelect.addEventListener('change', setCurrentTransition);
    // Prevent bidirectional sync from overwriting during user interaction
    elements.transitionSelect.addEventListener('focus', () => { isUserInteractingWithTransition = true; });
    elements.transitionSelect.addEventListener('blur', () => { setTimeout(() => { isUserInteractingWithTransition = false; }, 100); });
  }
  if (elements.savedConnections) elements.savedConnections.addEventListener('change', loadSavedConnection);
  if (elements.saveConnectionBtn) elements.saveConnectionBtn.addEventListener('click', saveCurrentConnection);
  if (elements.deleteConnectionBtn) elements.deleteConnectionBtn.addEventListener('click', deleteCurrentConnection);
  if (elements.refreshCollections) elements.refreshCollections.addEventListener('click', loadSceneCollections);
  if (elements.refreshProfiles) elements.refreshProfiles.addEventListener('click', loadProfiles);
  if (elements.refreshRecordings) elements.refreshRecordings.addEventListener('click', loadRecordings);
  if (elements.layoutPresetSelect) elements.layoutPresetSelect.addEventListener('change', (e) => applyLayoutPreset(e.target.value));
  if (elements.layoutDensitySelect) elements.layoutDensitySelect.addEventListener('change', () => applyLayoutFromInputs(true));
  if (elements.sidebarLeftWidth) elements.sidebarLeftWidth.addEventListener('input', () => applyLayoutFromInputs(true));
  if (elements.sidebarRightWidth) elements.sidebarRightWidth.addEventListener('input', () => applyLayoutFromInputs(true));
  if (elements.saveLayoutPresetBtn) elements.saveLayoutPresetBtn.addEventListener('click', saveCustomLayoutPreset);
  if (elements.deleteLayoutPresetBtn) elements.deleteLayoutPresetBtn.addEventListener('click', deleteSelectedLayoutPreset);
  if (elements.resetLayoutPresetBtn) elements.resetLayoutPresetBtn.addEventListener('click', resetLayoutPresetsToDefault);

  if (elements.openSettingsBtn) elements.openSettingsBtn.addEventListener('click', showSettingsModal);
  if (elements.settingsCloseBtn) elements.settingsCloseBtn.addEventListener('click', hideSettingsModal);
  if (elements.settingsCancelBtn) elements.settingsCancelBtn.addEventListener('click', hideSettingsModal);
  if (elements.settingsSaveBtn) elements.settingsSaveBtn.addEventListener('click', () => {
    const next = collectSettingsFromUI();
    if (!next) return;
    preferences = next;
    savePreferences(preferences);
    applyPreferences();
    updateShortcutJsonTextarea();
    if (isConnected) {
      startStatsPolling();
      startBidirectionalSync();
    }
    hideSettingsModal();
  });
  if (elements.shortcutInputs) {
    elements.shortcutInputs.forEach(input => {
      input.addEventListener('keydown', handleShortcutInputKeydown);
      input.addEventListener('focus', (e) => e.target.select());
    });
  }
  if (elements.shortcutResetBtn) {
    elements.shortcutResetBtn.addEventListener('click', () => {
      elements.shortcutInputs.forEach(input => {
        const action = input.dataset.action;
        input.value = DEFAULT_SETTINGS.shortcuts[action] || '';
      });
      updateShortcutJsonTextarea();
    });
  }
  if (elements.shortcutExportBtn) {
    elements.shortcutExportBtn.addEventListener('click', async () => {
      updateShortcutJsonTextarea();
      try {
        await navigator.clipboard.writeText(elements.shortcutJson.value);
        alert('Shortcut map copied to clipboard.');
      } catch (e) {
        if (elements.shortcutJson) {
          elements.shortcutJson.focus();
          elements.shortcutJson.select();
        }
        alert('Clipboard unavailable. Please copy the JSON manually from the field.');
      }
    });
  }
  if (elements.shortcutImportBtn) {
    elements.shortcutImportBtn.addEventListener('click', () => {
      const parsed = parseShortcutJsonTextarea();
      if (parsed) {
        Object.keys(DEFAULT_SETTINGS.shortcuts).forEach(action => {
          if (parsed[action]) {
            const input = document.querySelector(`.shortcut-input[data-action="${action}"]`);
            if (input) input.value = parsed[action];
          }
        });
        updateShortcutJsonTextarea();
      }
    });
  }
  if (elements.refreshScenes) elements.refreshScenes.addEventListener('click', () => {
    clearSceneThumbnails(true);
    loadScenes();
  });
  if (elements.thumbnailToggle) elements.thumbnailToggle.addEventListener('change', () => {
    saveSettings();
    if (isThumbnailsEnabled()) {
      startThumbnailRefresh();
      refreshAllThumbnails(true);
    } else {
      stopThumbnailRefresh();
      clearSceneThumbnails(false);
    }
  });
  if (elements.thumbnailInterval) elements.thumbnailInterval.addEventListener('change', () => {
    saveSettings();
    startThumbnailRefresh();
  });
}

// Connection Management Functions
function getSavedConnections() {
  const connections = localStorage.getItem('obsConnections');
  return connections ? JSON.parse(connections) : [];
}

function saveSavedConnections(connections) {
  localStorage.setItem('obsConnections', JSON.stringify(connections));
}

function loadConnectionsList() {
  const connections = getSavedConnections();
  elements.savedConnections.innerHTML = '<option value="">-- New Connection --</option>';
  
  connections.forEach((conn, index) => {
    const option = document.createElement('option');
    option.value = index.toString();
    option.textContent = conn.name;
    elements.savedConnections.appendChild(option);
  });
  refreshDefaultConnectionOptions();
  
  // Auto-select default connection
  if (preferences.defaultConnectionName) {
    const idx = connections.findIndex(c => c.name === preferences.defaultConnectionName);
    if (idx >= 0) {
      elements.savedConnections.value = idx.toString();
      loadSavedConnection();
    }
  }
}

function loadSavedConnection() {
  const selectedIndex = elements.savedConnections.value;
  if (selectedIndex === '') {
    // New connection - clear fields
    elements.wsHost.value = 'localhost';
    elements.wsPort.value = '4455';
    elements.wsPassword.value = '';
    return;
  }
  
  const connections = getSavedConnections();
  const connection = connections[selectedIndex];
  if (connection) {
    elements.wsHost.value = connection.host;
    elements.wsPort.value = connection.port;
    // Decrypt password (simple base64 for obfuscation)
    elements.wsPassword.value = connection.password ? atob(connection.password) : '';
  }
}

// Layout presets
function loadStoredLayoutPresets() {
  let presets = { ...DEFAULT_LAYOUT_PRESETS };
  const stored = localStorage.getItem(LAYOUT_PRESETS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      Object.values(parsed || {}).forEach((preset) => {
        const sanitized = sanitizePreset(preset);
        if (sanitized) {
          presets[sanitized.id] = sanitized;
        }
      });
    } catch (err) {
      console.warn('Failed to parse stored layout presets', err);
    }
  }
  return presets;
}

function saveLayoutPresets(presets) {
  localStorage.setItem(LAYOUT_PRESETS_KEY, JSON.stringify(presets));
}

function populateLayoutPresetSelect() {
  if (!elements.layoutPresetSelect) return;
  elements.layoutPresetSelect.innerHTML = '';

  const defaultsOrder = ['expanded', 'compact'];
  const sorted = Object.values(layoutPresets).sort((a, b) => {
    const aIndex = defaultsOrder.indexOf(a.id);
    const bIndex = defaultsOrder.indexOf(b.id);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    }
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    elements.layoutPresetSelect.appendChild(option);
  });
}

function setDensityClass(density) {
  const body = document.body;
  if (!body) return;
  body.classList.remove('density-compact', 'density-expanded');
  body.classList.add(density === 'compact' ? 'density-compact' : 'density-expanded');
}

function clampSidebar(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return LAYOUT_LIMITS.min;
  return Math.min(LAYOUT_LIMITS.max, Math.max(LAYOUT_LIMITS.min, parsed));
}

function sanitizePreset(preset) {
  if (!preset || typeof preset !== 'object') return null;
  const density = preset.density === 'compact' ? 'compact' : 'expanded';
  const sidebarLeft = clampSidebar(preset.sidebarLeft || LAYOUT_LIMITS.min);
  const sidebarRight = clampSidebar(preset.sidebarRight || LAYOUT_LIMITS.min);
  const id = preset.id && typeof preset.id === 'string' ? preset.id : null;
  const name = preset.name && typeof preset.name === 'string' ? preset.name : null;
  if (!id || !name) return null;
  return { id, name, density, sidebarLeft, sidebarRight };
}

function applyLayoutPreset(presetId) {
  if (!elements.layoutPresetSelect) return;
  if (presetId === '__custom') {
    applyLayoutFromInputs(false);
    localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, '__custom');
    return;
  }

  const preset = sanitizePreset(layoutPresets[presetId]) || DEFAULT_LAYOUT_PRESETS.expanded;
  const density = preset.density || 'expanded';
  const leftWidth = preset.sidebarLeft || 280;
  const rightWidth = preset.sidebarRight || 300;

  document.documentElement.style.setProperty('--sidebar-left', `${leftWidth}px`);
  document.documentElement.style.setProperty('--sidebar-right', `${rightWidth}px`);
  setDensityClass(density);

  if (elements.layoutDensitySelect) elements.layoutDensitySelect.value = density;
  if (elements.sidebarLeftWidth) elements.sidebarLeftWidth.value = leftWidth;
  if (elements.sidebarRightWidth) elements.sidebarRightWidth.value = rightWidth;

  if (elements.layoutPresetSelect.value !== presetId) {
    const optionExists = Array.from(elements.layoutPresetSelect.options).some(opt => opt.value === presetId);
    if (optionExists) {
      elements.layoutPresetSelect.value = presetId;
    }
  }

  localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, presetId);
}

function applyLayoutFromInputs(markCustom) {
  const density = elements.layoutDensitySelect ? elements.layoutDensitySelect.value : 'expanded';
  const leftWidth = elements.sidebarLeftWidth ? clampSidebar(elements.sidebarLeftWidth.value) : 280;
  const rightWidth = elements.sidebarRightWidth ? clampSidebar(elements.sidebarRightWidth.value) : 300;

  document.documentElement.style.setProperty('--sidebar-left', `${leftWidth}px`);
  document.documentElement.style.setProperty('--sidebar-right', `${rightWidth}px`);
  setDensityClass(density);

  if (markCustom && elements.layoutPresetSelect) {
    let customOption = elements.layoutPresetSelect.querySelector('option[value="__custom"]');
    if (!customOption) {
      customOption = document.createElement('option');
      customOption.value = '__custom';
      customOption.textContent = 'Custom (unsaved)';
      elements.layoutPresetSelect.appendChild(customOption);
    }
    elements.layoutPresetSelect.value = '__custom';
    localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, '__custom');
  } else if (elements.layoutPresetSelect && elements.layoutPresetSelect.value === '__custom') {
    localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, '__custom');
  }
}

function saveCustomLayoutPreset() {
  if (!elements.layoutPresetSelect) return;
  showConnectionNameDialog('New Preset', (name) => {
    if (!name) return;

    const density = elements.layoutDensitySelect ? elements.layoutDensitySelect.value : 'expanded';
    const leftWidth = elements.sidebarLeftWidth ? clampSidebar(elements.sidebarLeftWidth.value) : 280;
    const rightWidth = elements.sidebarRightWidth ? clampSidebar(elements.sidebarRightWidth.value) : 300;

    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!id) return;
    if (['expanded', 'compact', '__custom'].includes(id)) {
      notifyUser('Preset name is reserved (expanded, compact). Choose another name.');
      return;
    }

    layoutPresets[id] = {
      id,
      name: name.trim(),
      density,
      sidebarLeft: leftWidth,
      sidebarRight: rightWidth
    };

    saveLayoutPresets(layoutPresets);
    populateLayoutPresetSelect();
    applyLayoutPreset(id);
  }, { title: 'Save Layout Preset', label: 'Preset Name:' });
}

function deleteSelectedLayoutPreset() {
  if (!elements.layoutPresetSelect) return;
  const selectedId = elements.layoutPresetSelect.value;
  if (!selectedId || selectedId === '__custom') {
    notifyUser('Only saved presets can be deleted. Select a saved preset first.');
    return;
  }
  if (DEFAULT_LAYOUT_PRESETS[selectedId]) {
    notifyUser('Default presets cannot be deleted.');
    return;
  }
  delete layoutPresets[selectedId];
  saveLayoutPresets(layoutPresets);
  populateLayoutPresetSelect();
  applyLayoutPreset('expanded');
  localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, 'expanded');
}

function resetLayoutPresetsToDefault() {
  layoutPresets = { ...DEFAULT_LAYOUT_PRESETS };
  saveLayoutPresets(layoutPresets);
  populateLayoutPresetSelect();
  applyLayoutPreset('expanded');
  localStorage.setItem(ACTIVE_LAYOUT_PRESET_KEY, 'expanded');
}

function initializeLayoutPresets() {
  layoutPresets = loadStoredLayoutPresets();
  populateLayoutPresetSelect();
  const activePresetId = localStorage.getItem(ACTIVE_LAYOUT_PRESET_KEY) || 'expanded';
  applyLayoutPreset(layoutPresets[activePresetId] ? activePresetId : 'expanded');
}

function notifyUser(message) {
  if (elements.statusText) {
    const previous = elements.statusText.textContent;
    elements.statusText.textContent = message;
    setTimeout(() => {
      elements.statusText.textContent = previous;
    }, 3000);
  } else {
    alert(message);
  }
}

// Custom dialog function (replaces prompt() which doesn't work in Electron renderer)
function showConnectionNameDialog(defaultValue, callback, options = {}) {
  const dialog = document.getElementById('connection-name-dialog');
  const input = document.getElementById('connection-name-input');
  const saveBtn = document.getElementById('dialog-save-btn');
  const cancelBtn = document.getElementById('dialog-cancel-btn');
  const titleEl = dialog.querySelector('.modal-header h3');
  const labelEl = dialog.querySelector('label[for="connection-name-input"]');

  if (titleEl) titleEl.textContent = options.title || 'Save Connection';
  if (labelEl) labelEl.textContent = options.label || 'Connection Name:';
  
  // Set default value
  input.value = defaultValue;
  
  // Show dialog
  dialog.style.display = 'flex';
  
  // Focus input and select text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  
  // Handle save
  const handleSave = () => {
    const value = input.value.trim();
    dialog.style.display = 'none';
    cleanup();
    callback(value);
  };
  
  // Handle cancel
  const handleCancel = () => {
    dialog.style.display = 'none';
    cleanup();
    callback(null);
  };
  
  // Handle keyboard
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };
  
  // Cleanup function
  const cleanup = () => {
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeyDown);
  };
  
  // Add event listeners
  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeyDown);
}

function saveCurrentConnection() {
  const host = elements.wsHost.value.trim();
  const port = elements.wsPort.value.trim();
  const password = elements.wsPassword.value;
  
  if (!host || !port) {
    alert('Please enter host and port before saving.');
    return;
  }
  
  // Show custom dialog (prompt() is not supported in Electron renderer)
  showConnectionNameDialog(`${host}:${port}`, (connectionName) => {
    if (!connectionName) return;
    
    const connections = getSavedConnections();
    
    // Check if a connection with this name already exists
    const existingIndex = connections.findIndex(c => c.name === connectionName);
    
    const newConnection = {
      name: connectionName,
      host: host,
      port: port,
      // Encrypt password (simple base64 for obfuscation - not truly secure but better than plaintext)
      password: password ? btoa(password) : ''
    };
    
    if (existingIndex >= 0) {
      // Update existing
      if (confirm('A connection with this name already exists. Update it?')) {
        connections[existingIndex] = newConnection;
      } else {
        return;
      }
    } else {
      // Add new
      connections.push(newConnection);
    }
    
    saveSavedConnections(connections);
    loadConnectionsList();
    refreshDefaultConnectionOptions();
    
    // Select the saved connection
    const newIndex = connections.findIndex(c => c.name === connectionName);
    elements.savedConnections.value = newIndex;
    
    alert('Connection saved successfully!');
  });
}

function deleteCurrentConnection() {
  const selectedIndex = elements.savedConnections.value;
  if (selectedIndex === '') {
    alert('Please select a connection to delete.');
    return;
  }
  
  const connections = getSavedConnections();
  const connection = connections[selectedIndex];
  
  if (!confirm(`Delete connection "${connection.name}"?`)) {
    return;
  }
  
  connections.splice(selectedIndex, 1);
  saveSavedConnections(connections);
  loadConnectionsList();
  refreshDefaultConnectionOptions();
  
  // Reset to new connection
  elements.savedConnections.value = '';
  loadSavedConnection();
  
  alert('Connection deleted successfully!');
}

// Legacy save/load functions (kept for backwards compatibility)
function saveSettings() {
  const settings = {
    host: elements.wsHost.value,
    port: elements.wsPort.value,
    thumbnailsEnabled: elements.thumbnailToggle ? elements.thumbnailToggle.checked : true,
    thumbnailInterval: getThumbnailIntervalSeconds()
  };
  localStorage.setItem('obsSettings', JSON.stringify(settings));
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('obsSettings') || '{}');
  if (settings.host) elements.wsHost.value = settings.host;
  if (settings.port) elements.wsPort.value = settings.port;
  // Thumbnail preferences
  if (elements.thumbnailToggle) {
    elements.thumbnailToggle.checked = settings.thumbnailsEnabled !== false;
  }
  if (elements.thumbnailInterval) {
    const interval = settings.thumbnailInterval || DEFAULT_THUMBNAIL_INTERVAL;
    elements.thumbnailInterval.value = interval;
  }
}

function clearAutoReconnectTimer() {
  if (autoReconnectTimeout) {
    clearTimeout(autoReconnectTimeout);
    autoReconnectTimeout = null;
  }
}

function scheduleAutoReconnect(reason = '') {
  if (!preferences.autoReconnect?.enabled || userInitiatedDisconnect) return;
  if (!lastConnectionDetails) return;
  const maxAttempts = preferences.autoReconnect.maxAttempts || DEFAULT_SETTINGS.autoReconnect.maxAttempts;
  if (reconnectAttempts >= maxAttempts) return;
  const baseDelay = Math.max(500, preferences.autoReconnect.delayMs || DEFAULT_SETTINGS.autoReconnect.delayMs);
  const jitter = Math.max(0, preferences.autoReconnect.jitterMs || DEFAULT_SETTINGS.autoReconnect.jitterMs);
  const delay = baseDelay + Math.floor(Math.random() * jitter);
  reconnectAttempts += 1;
  clearAutoReconnectTimer();
  autoReconnectTimeout = setTimeout(async () => {
    try {
      console.log(`Auto-reconnect attempt ${reconnectAttempts} (reason: ${reason || 'unknown'})`);
      await connect(lastConnectionDetails);
    } catch (e) {
      console.warn('Auto-reconnect attempt failed', e);
      scheduleAutoReconnect('retry');
    }
  }, delay);
}

// Connection handling
async function handleConnect() {
  if (!obs) {
    alert('OBS WebSocket client not initialized. Please reload the page.');
    return;
  }
  
  if (isConnected) {
    userInitiatedDisconnect = true;
    await disconnect();
  } else {
    userInitiatedDisconnect = false;
    reconnectAttempts = 0;
    await connect();
  }
}

async function connect(connectionOpts = null) {
  try {
    console.log('Attempting to connect to OBS...');
    updateConnectionStatus('connecting', 'Connecting...');
    elements.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    elements.connectBtn.disabled = true;

    const host = connectionOpts?.host || elements.wsHost.value || 'localhost';
    const port = connectionOpts?.port || elements.wsPort.value || '4455';
    const password = connectionOpts?.password || elements.wsPassword.value || '';

    lastConnectionDetails = { host, port, password };
    elements.wsHost.value = host;
    elements.wsPort.value = port;
    elements.wsPassword.value = password;
    userInitiatedDisconnect = false;

    console.log(`Connecting to ws://${host}:${port}`);
    await obs.connect(`ws://${host}:${port}`, password);
    
    console.log('Connection successful!');
    isConnected = true;
    reconnectAttempts = 0;
    clearAutoReconnectTimer();
    updateConnectionStatus('connected', 'Connected');
    elements.connectBtn.innerHTML = '<i class="fas fa-plug"></i> Disconnect';
    elements.connectBtn.disabled = false;
    elements.connectBtn.classList.remove('btn-primary');
    elements.connectBtn.classList.add('btn-danger');
    
    saveSettings();
    await initializeOBSConnection();
  } catch (error) {
    console.error('Connection failed:', error);
    updateConnectionStatus('disconnected', 'Connection Failed');
    elements.connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
    elements.connectBtn.disabled = false;
    if (!userInitiatedDisconnect) {
      scheduleAutoReconnect('connect-failed');
    }
    
    // Provide more detailed error message
    let errorMessage = 'Failed to connect to OBS';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    if (error.code === 'ECONNREFUSED') {
      errorMessage += '\n\nMake sure:\n• OBS Studio is running\n• WebSocket server is enabled in OBS\n• Host and port are correct';
    }
    alert(errorMessage);
  }
}

async function disconnect() {
  try {
    console.log('Disconnecting from OBS...');
    userInitiatedDisconnect = true;
    clearAutoReconnectTimer();
    if (obs && isConnected) {
      await obs.disconnect();
    }
    resetConnectionUI();
    console.log('Disconnected successfully');
  } catch (error) {
    console.error('Disconnect error:', error);
    // Still reset UI even if disconnect fails
    resetConnectionUI();
  }
}

function updateConnectionStatus(status, text) {
  elements.statusDot.className = `status-dot ${status}`;
  elements.statusText.textContent = text;
}

// Reset connection UI to disconnected state
function resetConnectionUI() {
  isConnected = false;
  updateConnectionStatus('disconnected', 'Disconnected');
  elements.connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
  elements.connectBtn.classList.remove('btn-danger');
  elements.connectBtn.classList.add('btn-primary');
  elements.connectBtn.disabled = false;
  clearIntervals();
  resetUI();
}

// Initialize OBS connection
async function initializeOBSConnection() {
  try {
    // Setup event listeners for OBS events
    setupOBSEventListeners();
    
    // Load initial data
    await Promise.all([
      loadScenes(),
      loadTransitions(),
      loadAudioSources(),
      loadSceneCollections(),
      loadProfiles(),
      loadRecordings(),
      getStudioModeStatus(),
      getStreamingStatus(),
      getRecordingStatus(),
      getVirtualCameraStatus()
    ]);
    
    // Start stats polling
    startStatsPolling();
    
    // Start bidirectional sync polling
    startBidirectionalSync();
    
    // Enable controls
    enableControls();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

function setupOBSEventListeners() {
  // Connection events
  obs.on('ConnectionClosed', () => {
    console.log('Connection to OBS closed');
    resetConnectionUI();
    scheduleAutoReconnect('closed');
  });
  
  obs.on('ConnectionError', (error) => {
    console.error('Connection error:', error);
    resetConnectionUI();
    alert('Lost connection to OBS: ' + (error.message || 'Unknown error'));
    scheduleAutoReconnect('error');
  });
  
  // Scene events
  obs.on('CurrentProgramSceneChanged', (data) => {
    currentScene = data.sceneName;
    updateActiveScene();
    // Update studio mode indicators if in studio mode
    if (isStudioMode) {
      updateSceneIndicators();
    }
    // Refresh audio mixer to show scene-specific audio
    loadAudioSources();
  });
  
  obs.on('SceneListChanged', () => {
    loadScenes();
    // Update studio mode indicators if in studio mode
    if (isStudioMode) {
      updateSceneIndicators();
    }
  });
  
  // Preview scene changed event (studio mode)
  obs.on('CurrentPreviewSceneChanged', (data) => {
    if (isStudioMode) {
      updateSceneIndicators();
    }
  });
  
  // Stream events
  obs.on('StreamStateChanged', (data) => {
    updateStreamButton(data.outputActive);
  });
  
  // Recording events
  obs.on('RecordStateChanged', (data) => {
    updateRecordButton(data.outputActive);
  });
  
  // Studio mode events
  obs.on('StudioModeStateChanged', (data) => {
    isStudioMode = data.studioModeEnabled;
    updateStudioModeUI();
  });
  
  // Audio level events (OBS WebSocket 5.x feature)
  obs.on('InputVolumeMeters', (data) => {
    console.log('[InputVolumeMeters] Event received:', data ? 'YES' : 'NO');
    // data.inputs is an array of {inputName, inputLevelsMul: [[channels], [channels], ...]}
    if (data && data.inputs) {
      console.log(`[InputVolumeMeters] Processing ${data.inputs.length} inputs`);
      data.inputs.forEach(input => {
        console.log(`[InputVolumeMeters] Input: ${input.inputName}, Levels:`, input.inputLevelsMul);
        updateAudioMeter(input.inputName, input.inputLevelsMul);
      });
    } else {
      console.warn('[InputVolumeMeters] No data or inputs in event');
    }
  });
}

// Update audio meter with real OBS audio levels
function updateAudioMeter(inputName, levelsMul) {
  const meter = document.querySelector(`.audio-meter[data-input="${inputName}"]`);
  console.log(`[updateAudioMeter] Looking for meter with input="${inputName}", Found:`, meter ? 'YES' : 'NO');
  
  if (!meter) {
    console.warn(`[updateAudioMeter] No meter element found for input "${inputName}"`);
    return;
  }
  
  const bars = meter.querySelectorAll('.meter-bar');
  console.log(`[updateAudioMeter] Found ${bars.length} meter bars for "${inputName}"`);
  
  if (bars.length === 0) {
    console.warn(`[updateAudioMeter] No meter bars found in meter for "${inputName}"`);
    return;
  }
  
  // levelsMul is an array of channel arrays: [[ch1_levels], [ch2_levels], ...]
  // Each channel has 3 values: [magnitude, peak, inputLevel]
  // We'll use the magnitude (index 0) from the first channel
  if (!levelsMul || levelsMul.length === 0) {
    console.log(`[updateAudioMeter] No level data for "${inputName}", clearing meter`);
    // No audio data - clear meter
    bars.forEach(bar => bar.classList.remove('active', 'peak'));
    return;
  }
  
  // Get magnitude from first channel (mono or left channel)
  const magnitude = levelsMul[0][0]; // Range: 0.0 to 1.0
  
  // Convert linear magnitude to dB (logarithmic scale)
  // Professional audio meters use dB scale for better visualization
  // dB = 20 * log10(magnitude), typically ranges from MIN_DB (quiet) to MAX_DB (peak)
  const dB = magnitude > 0 ? 20 * Math.log10(magnitude) : MIN_DB;
  console.log(`[updateAudioMeter] "${inputName}" magnitude: ${magnitude.toFixed(3)}, dB: ${dB.toFixed(1)}`);
  
  // Map dB range (MIN_DB to MAX_DB) to meter bars (0 to totalBars)
  // MIN_DB or below = 0% (silent)
  // -40dB = ~30% (quiet)
  // -20dB = ~65% (typical speech)
  // PEAK_THRESHOLD_DB (-5dB) = ~90% (loud)
  // MAX_DB (0dB) = 100% (peak/clipping)
  const totalBars = bars.length;
  const dbNormalized = Math.max(0, Math.min(1, (dB - MIN_DB) / DB_RANGE)); // Normalize MIN_DB to MAX_DB => 0.0 to 1.0
  const activeCount = Math.round(dbNormalized * totalBars);
  console.log(`[updateAudioMeter] "${inputName}" lighting ${activeCount}/${totalBars} bars (${(dbNormalized * 100).toFixed(0)}%)`);
  
  // Update meter bars
  bars.forEach((bar, index) => {
    if (index < activeCount) {
      bar.classList.add('active');
      // Peak indicator (red) for levels above PEAK_THRESHOLD_DB (very loud, near clipping)
      if (dB > PEAK_THRESHOLD_DB) {
        bar.classList.add('peak');
      } else {
        bar.classList.remove('peak');
      }
    } else {
      bar.classList.remove('active', 'peak');
    }
  });
}

// Scenes
async function loadScenes() {
  try {
    const { scenes, currentProgramSceneName } = await obs.call('GetSceneList');
    currentScene = currentProgramSceneName;
    
    elements.scenesList.innerHTML = '';
    scenes.reverse().forEach(scene => {
      const sceneItem = createSceneItem(scene.sceneName);
      elements.scenesList.appendChild(sceneItem);
      queueSceneThumbnail(scene.sceneName);
    });
    
    updateActiveScene();
    startThumbnailRefresh();
  } catch (error) {
    console.error('Failed to load scenes:', error);
    elements.scenesList.innerHTML = '<div class="empty-state">Failed to load scenes</div>';
  }
}

function createSceneItem(sceneName) {
  const item = document.createElement('div');
  item.className = 'list-item';
  item.innerHTML = `
    <div class="scene-thumbnail">
      <div class="thumb-placeholder loading"><i class="fas fa-image"></i></div>
    </div>
    <div class="list-item-label">
      <i class="fas fa-image list-item-icon"></i>
      <span>${sceneName}</span>
    </div>
  `;
  item.addEventListener('click', () => setScene(sceneName));
  item.addEventListener('mouseenter', () => queueSceneThumbnail(sceneName, true));
  item.dataset.sceneName = sceneName;
  return item;
}

function updateActiveScene() {
  document.querySelectorAll('#scenes-list .list-item').forEach(item => {
    if (item.dataset.sceneName === currentScene) {
      item.classList.add('active');
      loadSceneSources(currentScene);
    } else {
      item.classList.remove('active');
    }
  });
}

async function setScene(sceneName) {
  try {
    if (isStudioMode) {
      await obs.call('SetCurrentPreviewScene', { sceneName });
    } else {
      await obs.call('SetCurrentProgramScene', { sceneName });
      currentScene = sceneName;
      updateActiveScene();
      // Refresh audio mixer when scene changes
      await loadAudioSources();
    }
    queueSceneThumbnail(sceneName, true);
  } catch (error) {
    console.error('Failed to set scene:', error);
  }
}

// Scene thumbnails
const THUMBNAIL_WIDTH = 240;
const THUMBNAIL_HEIGHT = 135;
const MAX_THUMBNAIL_REQUESTS = 2;

function isThumbnailsEnabled() {
  return elements.thumbnailToggle ? elements.thumbnailToggle.checked : true;
}

function getThumbnailIntervalSeconds() {
  const raw = elements.thumbnailInterval ? parseInt(elements.thumbnailInterval.value, 10) : NaN;
  if (!Number.isFinite(raw)) return DEFAULT_THUMBNAIL_INTERVAL;
  return Math.min(120, Math.max(5, raw));
}

function getThumbnailIntervalMs() {
  return getThumbnailIntervalSeconds() * 1000;
}

function stopThumbnailRefresh() {
  if (thumbnailRefreshInterval) {
    clearInterval(thumbnailRefreshInterval);
    thumbnailRefreshInterval = null;
  }
}

function startThumbnailRefresh() {
  stopThumbnailRefresh();
  if (!isThumbnailsEnabled()) return;
  thumbnailRefreshInterval = setInterval(() => {
    refreshAllThumbnails(false);
  }, getThumbnailIntervalMs());
}

function refreshAllThumbnails(force = false) {
  if (!isThumbnailsEnabled()) return;
  document.querySelectorAll('#scenes-list .list-item').forEach(item => {
    const sceneName = item.dataset.sceneName;
    if (sceneName) {
      queueSceneThumbnail(sceneName, force);
    }
  });
}

function clearSceneThumbnails(resetPlaceholders = false) {
  sceneThumbnails = {};
  thumbnailQueue = [];
  activeThumbnailRequests = 0;
  thumbnailQueueSet.clear();
  if (resetPlaceholders) {
    document.querySelectorAll('#scenes-list .scene-thumbnail').forEach(box => {
      setThumbnailPlaceholder(box, true);
    });
  }
}

function setThumbnailPlaceholder(box, isLoading) {
  if (!box) return;
  const placeholder = document.createElement('div');
  placeholder.className = 'thumb-placeholder' + (isLoading ? ' loading' : '');
  const icon = document.createElement('i');
  icon.className = 'fas fa-image';
  placeholder.appendChild(icon);
  box.replaceChildren(placeholder);
}

function queueSceneThumbnail(sceneName, force = false) {
  if (!sceneName || !obs || !isThumbnailsEnabled()) return;
  const now = Date.now();
  const cadenceMs = getThumbnailIntervalMs();
  const existing = sceneThumbnails[sceneName];
  if (!force && existing) {
    if (existing.status === 'loading') return;
    if (existing.status === 'error' && existing.lastFail && now - existing.lastFail < cadenceMs) {
      updateSceneThumbnail(sceneName);
      return;
    }
    if (existing.status === 'loaded' && existing.updatedAt && now - existing.updatedAt < cadenceMs) {
      updateSceneThumbnail(sceneName);
      return;
    }
  }
  sceneThumbnails[sceneName] = {
    ...(existing || {}),
    status: 'loading'
  };
  if (!thumbnailQueueSet.has(sceneName)) {
    thumbnailQueueSet.add(sceneName);
    thumbnailQueue.push(sceneName);
  }
  updateSceneThumbnail(sceneName);
  processThumbnailQueue();
}

function processThumbnailQueue() {
  while (activeThumbnailRequests < MAX_THUMBNAIL_REQUESTS && thumbnailQueue.length > 0) {
    const sceneName = thumbnailQueue.shift();
    if (!sceneName) continue;
    thumbnailQueueSet.delete(sceneName);
    activeThumbnailRequests++;
    fetchSceneThumbnail(sceneName).finally(() => {
      activeThumbnailRequests--;
      processThumbnailQueue();
    });
  }
}

async function fetchSceneThumbnail(sceneName) {
  try {
    const { imageData } = await obs.call('GetSourceScreenshot', {
      sourceName: sceneName,
      imageFormat: 'jpeg',
      imageCompressionQuality: 60,
      imageWidth: THUMBNAIL_WIDTH,
      imageHeight: THUMBNAIL_HEIGHT
    });
    const hasImage = !!imageData;
    sceneThumbnails[sceneName] = {
      status: hasImage ? 'loaded' : 'error',
      data: hasImage ? imageData : null,
      updatedAt: hasImage ? Date.now() : null,
      lastFail: hasImage ? null : Date.now()
    };
  } catch (error) {
    console.error('Thumbnail fetch failed for scene:', sceneName, error);
    sceneThumbnails[sceneName] = {
      status: 'error',
      data: null,
      updatedAt: null,
      lastFail: Date.now()
    };
  }
  updateSceneThumbnail(sceneName);
}

function updateSceneThumbnail(sceneName) {
  const entry = sceneThumbnails[sceneName];
  document.querySelectorAll('#scenes-list .list-item').forEach(item => {
    if (item.dataset.sceneName !== sceneName) return;
    const box = item.querySelector('.scene-thumbnail');
    if (!box) return;
    if (!isThumbnailsEnabled()) {
      setThumbnailPlaceholder(box, false);
      return;
    }
    if (entry && entry.status === 'loaded' && entry.data) {
      const img = document.createElement('img');
      img.src = `data:image/jpeg;base64,${entry.data}`;
      img.alt = `${sceneName} thumbnail`;
      box.replaceChildren(img);
    } else if (entry && entry.status === 'loading') {
      setThumbnailPlaceholder(box, true);
    } else {
      setThumbnailPlaceholder(box, false);
    }
  });
}

// Sources
async function loadSceneSources(sceneName) {
  try {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
    
    elements.sourcesList.innerHTML = '';
    sceneItems.reverse().forEach(item => {
      const sourceItem = createSourceItem(item);
      elements.sourcesList.appendChild(sourceItem);
    });
  } catch (error) {
    console.error('Failed to load sources:', error);
    elements.sourcesList.innerHTML = '<div class="empty-state">Failed to load sources</div>';
  }
}

function createSourceItem(item) {
  const div = document.createElement('div');
  div.className = `source-item ${item.sceneItemEnabled ? 'visible' : 'hidden'}`;
  div.dataset.sceneItemId = item.sceneItemId;
  div.dataset.sourceName = item.sourceName;
  
  const iconSpan = document.createElement('i');
  iconSpan.className = `fas fa-${getSourceIcon(item.sourceType)}`;
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'source-name';
  nameSpan.textContent = item.sourceName;
  
  const visibilityBtn = document.createElement('button');
  visibilityBtn.className = 'btn-icon source-visibility-btn';
  visibilityBtn.title = item.sceneItemEnabled ? 'Hide source' : 'Show source';
  visibilityBtn.innerHTML = `<i class="fas fa-eye${item.sceneItemEnabled ? '' : '-slash'}"></i>`;
  visibilityBtn.onclick = (e) => {
    e.stopPropagation();
    // Read current visibility state from DOM instead of captured variable
    const isCurrentlyVisible = div.classList.contains('visible');
    toggleSourceVisibility(item.sceneItemId, item.sourceName, !isCurrentlyVisible, visibilityBtn, div);
  };
  
  div.appendChild(iconSpan);
  div.appendChild(nameSpan);
  div.appendChild(visibilityBtn);
  
  return div;
}

function getSourceIcon(sourceType) {
  const icons = {
    'OBS_SOURCE_TYPE_INPUT': 'cube',
    'OBS_SOURCE_TYPE_FILTER': 'filter',
    'OBS_SOURCE_TYPE_TRANSITION': 'exchange-alt',
    'OBS_SOURCE_TYPE_SCENE': 'layer-group'
  };
  return icons[sourceType] || 'cube';
}

async function toggleSourceVisibility(sceneItemId, sourceName, enabled, button, sourceDiv) {
  try {
    await obs.call('SetSceneItemEnabled', {
      sceneName: currentScene,
      sceneItemId: sceneItemId,
      sceneItemEnabled: enabled
    });
    
    // Update UI
    sourceDiv.className = `source-item ${enabled ? 'visible' : 'hidden'}`;
    button.innerHTML = `<i class="fas fa-eye${enabled ? '' : '-slash'}"></i>`;
    button.title = enabled ? 'Hide source' : 'Show source';
    
    console.log(`Source "${sourceName}" visibility set to ${enabled ? 'visible' : 'hidden'}`);
  } catch (error) {
    console.error('Failed to toggle source visibility:', error);
    alert('Failed to toggle source visibility: ' + error.message);
  }
}

// Audio
async function loadAudioSources() {
  try {
    const { inputs } = await obs.call('GetInputList');
    
    // Get current scene to determine scene-specific sources
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: currentProgramSceneName });
    
    // Get list of source names in the current scene
    const sceneSourceNames = new Set(sceneItems.map(item => item.sourceName));
    
    // Filter for audio inputs - check if they have audio tracks
    const audioInputs = [];
    for (const input of inputs) {
      try {
        // Check if this input has audio by trying to get its settings
        // Audio sources will have volume controls available
        const { inputVolumeDb } = await obs.call('GetInputVolume', { inputName: input.inputName });
        if (inputVolumeDb !== undefined) {
          // This input has audio, get its kind for icon selection
          let inputKind = 'unknown';
          try {
            const settings = await obs.call('GetInputSettings', { inputName: input.inputName });
            inputKind = settings.inputKind || input.inputKind || 'unknown';
          } catch (e) {
            // Fallback to input data
            inputKind = input.inputKind || 'unknown';
          }
          
          // Determine if this is in the current scene
          const isInScene = sceneSourceNames.has(input.inputName);
          
          audioInputs.push({ ...input, inputKind, isInScene });
        }
      } catch (e) {
        // Input doesn't have audio or doesn't exist anymore
      }
    }
    
    // Separate into global and scene-specific
    const globalAudio = audioInputs.filter(input => !input.isInScene);
    const sceneAudio = audioInputs.filter(input => input.isInScene);
    
    // Populate global audio mixer
    elements.globalAudioMixer.innerHTML = '';
    if (globalAudio.length === 0) {
      elements.globalAudioMixer.innerHTML = '<div class="empty-state">No global audio sources</div>';
    } else {
      for (const input of globalAudio) {
        const audioChannel = await createAudioChannel(input.inputName, input.inputKind);
        elements.globalAudioMixer.appendChild(audioChannel);
      }
    }
    
    // Populate scene audio mixer
    elements.sceneAudioMixer.innerHTML = '';
    if (sceneAudio.length === 0) {
      elements.sceneAudioMixer.innerHTML = '<div class="empty-state">No scene audio sources</div>';
    } else {
      for (const input of sceneAudio) {
        const audioChannel = await createAudioChannel(input.inputName, input.inputKind);
        elements.sceneAudioMixer.appendChild(audioChannel);
      }
    }
  } catch (error) {
    console.error('Failed to load audio sources:', error);
    elements.globalAudioMixer.innerHTML = '<div class="empty-state">Failed to load audio sources</div>';
    elements.sceneAudioMixer.innerHTML = '<div class="empty-state">Failed to load audio sources</div>';
  }
}

async function createAudioChannel(inputName, inputKind = 'unknown') {
  const channel = document.createElement('div');
  channel.className = 'audio-channel';
  
  try {
    const { inputMuted, inputVolumeDb } = await obs.call('GetInputMute', { inputName });
    const volumePercent = dbToPercent(inputVolumeDb);
    
    // Get appropriate icon based on input kind
    const icon = getAudioSourceIcon(inputKind);
    
    channel.innerHTML = `
      <div class="audio-channel-header">
        <div class="audio-channel-name">
          <i class="fas fa-${icon}"></i>
          <span>${inputName}</span>
        </div>
        <div class="audio-channel-controls">
          <button class="mute-btn ${inputMuted ? 'muted' : ''}" data-input="${inputName}">
            <i class="fas fa-volume-${inputMuted ? 'mute' : 'up'}"></i>
          </button>
        </div>
      </div>
      <div class="volume-control">
        <input type="range" class="volume-slider" min="0" max="100" value="${volumePercent}" 
               data-input="${inputName}">
        <span class="volume-value">${Math.round(volumePercent)}%</span>
      </div>
      <div class="audio-meter" data-input="${inputName}">
        ${Array(20).fill('<div class="meter-bar"></div>').join('')}
      </div>
    `;
    
    // Setup event listeners
    const muteBtn = channel.querySelector('.mute-btn');
    const volumeSlider = channel.querySelector('.volume-slider');
    const volumeValue = channel.querySelector('.volume-value');
    
    muteBtn.addEventListener('click', () => toggleMute(inputName, muteBtn));
    volumeSlider.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value);
      volumeValue.textContent = `${percent}%`;
      setVolume(inputName, percent);
    });
    
    // Start audio level monitoring
    startAudioLevelMonitoring(inputName);
  } catch (error) {
    console.error(`Failed to create audio channel for ${inputName}:`, error);
  }
  
  return channel;
}

// Get icon for audio source type
function getAudioSourceIcon(inputKind) {
  const kind = inputKind.toLowerCase();
  
  // Desktop audio / system audio
  if (kind.includes('wasapi') || kind.includes('desktop') || kind.includes('pulse')) {
    return 'desktop';
  }
  
  // Microphone / audio input device
  if (kind.includes('input') || kind.includes('capture') || kind.includes('device')) {
    return 'microphone';
  }
  
  // Media source (video/audio files)
  if (kind.includes('ffmpeg') || kind.includes('media') || kind.includes('vlc')) {
    return 'file-audio';
  }
  
  // Browser source
  if (kind.includes('browser')) {
    return 'globe';
  }
  
  // Application audio capture
  if (kind.includes('application') || kind.includes('window')) {
    return 'window-maximize';
  }
  
  // Default audio icon
  return 'volume-up';
}

async function toggleMute(inputName, button) {
  try {
    const { inputMuted } = await obs.call('GetInputMute', { inputName });
    await obs.call('SetInputMute', { inputName, inputMuted: !inputMuted });
    
    button.classList.toggle('muted');
    const icon = button.querySelector('i');
    icon.className = inputMuted ? 'fas fa-volume-up' : 'fas fa-volume-mute';
  } catch (error) {
    console.error('Failed to toggle mute:', error);
  }
}

async function setVolume(inputName, percent) {
  try {
    const db = percentToDb(percent);
    await obs.call('SetInputVolume', { inputName, inputVolumeDb: db });
  } catch (error) {
    console.error('Failed to set volume:', error);
  }
}

function dbToPercent(db) {
  return Math.round(Math.pow(10, db / 20) * 100);
}

function percentToDb(percent) {
  return 20 * Math.log10(percent / 100);
}

function startAudioLevelMonitoring(inputName) {
  // Note: Audio levels are now handled via InputVolumeMeters event
  // This function is kept for backward compatibility but levels are updated via event
  console.log(`Audio level monitoring for ${inputName} will use InputVolumeMeters event`);
}

// Streaming
async function getStreamingStatus() {
  try {
    const { outputActive } = await obs.call('GetStreamStatus');
    updateStreamButton(outputActive);
  } catch (error) {
    console.error('Failed to get streaming status:', error);
  }
}

async function toggleStreaming() {
  try {
    const { outputActive } = await obs.call('GetStreamStatus');
    
    if (outputActive) {
      await obs.call('StopStream');
    } else {
      await obs.call('StartStream');
    }
  } catch (error) {
    console.error('Failed to toggle streaming:', error);
    alert(`Failed to ${elements.streamBtn.textContent.includes('Start') ? 'start' : 'stop'} streaming: ${error.message}`);
  }
}

function updateStreamButton(isStreaming) {
  if (isStreaming) {
    elements.streamBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Streaming';
    elements.streamBtn.classList.remove('btn-success');
    elements.streamBtn.classList.add('btn-danger');
  } else {
    elements.streamBtn.innerHTML = '<i class="fas fa-circle"></i> Start Streaming';
    elements.streamBtn.classList.remove('btn-danger');
    elements.streamBtn.classList.add('btn-success');
  }
}

// Recording
async function getRecordingStatus() {
  try {
    const { outputActive } = await obs.call('GetRecordStatus');
    updateRecordButton(outputActive);
  } catch (error) {
    console.error('Failed to get recording status:', error);
  }
}

async function toggleRecording() {
  try {
    const { outputActive } = await obs.call('GetRecordStatus');
    
    if (outputActive) {
      await obs.call('StopRecord');
    } else {
      await obs.call('StartRecord');
    }
  } catch (error) {
    console.error('Failed to toggle recording:', error);
    alert(`Failed to ${elements.recordBtn.textContent.includes('Start') ? 'start' : 'stop'} recording: ${error.message}`);
  }
}

function updateRecordButton(isRecording) {
  if (isRecording) {
    elements.recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
    elements.recordBtn.classList.remove('btn-danger');
    elements.recordBtn.classList.add('btn-secondary');
    elements.pauseRecordBtn.disabled = false;
  } else {
    elements.recordBtn.innerHTML = '<i class="fas fa-record-vinyl"></i> Start Recording';
    elements.recordBtn.classList.remove('btn-secondary');
    elements.recordBtn.classList.add('btn-danger');
    elements.pauseRecordBtn.disabled = true;
  }
}

async function pauseRecording() {
  try {
    const { outputPaused } = await obs.call('GetRecordStatus');
    
    if (outputPaused) {
      await obs.call('ResumeRecord');
      elements.pauseRecordBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Recording';
    } else {
      await obs.call('PauseRecord');
      elements.pauseRecordBtn.innerHTML = '<i class="fas fa-play"></i> Resume Recording';
    }
  } catch (error) {
    console.error('Failed to pause/resume recording:', error);
  }
}

// Studio Mode
async function getStudioModeStatus() {
  try {
    const { studioModeEnabled } = await obs.call('GetStudioModeEnabled');
    isStudioMode = studioModeEnabled;
    elements.studioModeToggle.checked = isStudioMode;
    updateStudioModeUI();
  } catch (error) {
    console.error('Failed to get studio mode status:', error);
  }
}

async function toggleStudioMode() {
  try {
    isStudioMode = elements.studioModeToggle.checked;
    await obs.call('SetStudioModeEnabled', { studioModeEnabled: isStudioMode });
    updateStudioModeUI();
  } catch (error) {
    console.error('Failed to toggle studio mode:', error);
    elements.studioModeToggle.checked = !isStudioMode;
  }
}

async function updateStudioModeUI() {
  if (isStudioMode) {
    if (elements.singlePreview) elements.singlePreview.style.display = 'none';
    if (elements.studioPreview) elements.studioPreview.style.display = 'flex';
    if (elements.transitionBtn) elements.transitionBtn.disabled = false;
    
    // Show studio mode indicators
    const indicators = document.getElementById('studio-mode-indicators');
    if (indicators) {
      indicators.style.display = 'flex';
      await updateSceneIndicators();
    }
  } else {
    if (elements.singlePreview) elements.singlePreview.style.display = 'flex';
    if (elements.studioPreview) elements.studioPreview.style.display = 'none';
    if (elements.transitionBtn) elements.transitionBtn.disabled = true;
    
    // Hide studio mode indicators
    const indicators = document.getElementById('studio-mode-indicators');
    if (indicators) {
      indicators.style.display = 'none';
    }
  }
}

async function updateSceneIndicators() {
  if (!isStudioMode || !isConnected) return;
  
  try {
    // Get current program scene
    const { currentProgramSceneName } = await obs.call('GetSceneList');
    const programSceneEl = document.getElementById('program-scene-name');
    if (programSceneEl) {
      programSceneEl.textContent = currentProgramSceneName || 'No Scene';
    }
    
    // Get current preview scene (studio mode only)
    const { currentPreviewSceneName } = await obs.call('GetCurrentPreviewScene');
    const previewSceneEl = document.getElementById('preview-scene-name');
    if (previewSceneEl) {
      previewSceneEl.textContent = currentPreviewSceneName || 'No Scene';
    }
    
    console.log(`[Studio Mode] Program: ${currentProgramSceneName}, Preview: ${currentPreviewSceneName}`);
  } catch (error) {
    console.error('Failed to update scene indicators:', error);
  }
}

async function performTransition() {
  try {
    await obs.call('TriggerStudioModeTransition');
    // Update indicators after transition
    setTimeout(() => {
      if (isStudioMode) {
        updateSceneIndicators();
      }
    }, 100);
  } catch (error) {
    console.error('Failed to perform transition:', error);
  }
}

// Transitions
async function loadTransitions() {
  try {
    const { transitions, currentSceneTransitionName } = await obs.call('GetSceneTransitionList');
    
    elements.transitionSelect.innerHTML = '';
    transitions.forEach(transition => {
      const option = document.createElement('option');
      option.value = transition.transitionName;
      option.textContent = transition.transitionName;
      if (transition.transitionName === currentSceneTransitionName) {
        option.selected = true;
      }
      elements.transitionSelect.appendChild(option);
    });
    
    // Get current transition duration
    const { transitionDuration } = await obs.call('GetCurrentSceneTransition');
    elements.transitionDuration.value = transitionDuration;
  } catch (error) {
    console.error('Failed to load transitions:', error);
  }
}

async function setCurrentTransition() {
  try {
    const transitionName = elements.transitionSelect.value;
    await obs.call('SetCurrentSceneTransition', { transitionName });
    
    const duration = parseInt(elements.transitionDuration.value);
    await obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: duration });
  } catch (error) {
    console.error('Failed to set transition:', error);
  }
}

// Statistics
function startStatsPolling() {
  if (statsInterval) clearInterval(statsInterval);
  
  const intervalMs = Math.max(500, preferences.statsIntervalMs || DEFAULT_SETTINGS.statsIntervalMs);
  statsInterval = setInterval(async () => {
    try {
      const stats = await obs.call('GetStats');
      updateStats(stats);
      
      // Update streaming time
      try {
        const { outputActive, outputTimecode } = await obs.call('GetStreamStatus');
        if (outputActive) {
          elements.streamTime.textContent = outputTimecode || '00:00:00';
        } else {
          elements.streamTime.textContent = '--:--:--';
        }
      } catch (e) {
        // Ignore
      }
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
  }, intervalMs);
}

function updateStats(stats) {
  elements.fpsValue.textContent = stats.activeFps ? stats.activeFps.toFixed(1) : '--';
  elements.cpuValue.textContent = stats.cpuUsage ? stats.cpuUsage.toFixed(1) + '%' : '--%';
  elements.memoryValue.textContent = stats.memoryUsage ? (stats.memoryUsage / 1024 / 1024).toFixed(0) + ' MB' : '-- MB';
  
  if (stats.outputStats && stats.outputStats.length > 0) {
    const output = stats.outputStats[0];
    elements.bitrateValue.textContent = output.outputBytes 
      ? (output.outputBytes / 1000).toFixed(0) + ' kbps' 
      : '-- kbps';
  }
  
  const droppedFrames = stats.renderSkippedFrames || 0;
  const totalFrames = stats.renderTotalFrames || 1;
  const droppedPercent = ((droppedFrames / totalFrames) * 100).toFixed(2);
  elements.droppedFrames.textContent = `${droppedFrames} (${droppedPercent}%)`;
}

// Virtual Camera Control
async function toggleVirtualCamera() {
  try {
    const { outputActive } = await obs.call('GetVirtualCamStatus');
    
    if (outputActive) {
      await obs.call('StopVirtualCam');
      elements.virtualCamBtn.innerHTML = '<i class="fas fa-video"></i> Start Virtual Camera';
      elements.virtualCamBtn.classList.remove('btn-success');
      elements.virtualCamBtn.classList.add('btn-secondary');
    } else {
      await obs.call('StartVirtualCam');
      elements.virtualCamBtn.innerHTML = '<i class="fas fa-video-slash"></i> Stop Virtual Camera';
      elements.virtualCamBtn.classList.remove('btn-secondary');
      elements.virtualCamBtn.classList.add('btn-success');
    }
  } catch (error) {
    console.error('Failed to toggle virtual camera:', error);
    alert('Failed to toggle virtual camera: ' + error.message);
  }
}

async function getVirtualCameraStatus() {
  try {
    const { outputActive } = await obs.call('GetVirtualCamStatus');
    if (outputActive) {
      elements.virtualCamBtn.innerHTML = '<i class="fas fa-video-slash"></i> Stop Virtual Camera';
      elements.virtualCamBtn.classList.remove('btn-secondary');
      elements.virtualCamBtn.classList.add('btn-success');
    } else {
      elements.virtualCamBtn.innerHTML = '<i class="fas fa-video"></i> Start Virtual Camera';
      elements.virtualCamBtn.classList.remove('btn-success');
      elements.virtualCamBtn.classList.add('btn-secondary');
    }
  } catch (error) {
    console.error('Failed to get virtual camera status:', error);
  }
}

// Scene Collections
async function loadSceneCollections() {
  try {
    const { sceneCollections, currentSceneCollectionName } = await obs.call('GetSceneCollectionList');
    
    if (!elements.collectionsList) return;
    
    elements.collectionsList.innerHTML = '';
    sceneCollections.forEach(collection => {
      const item = document.createElement('div');
      item.className = 'list-item' + (collection === currentSceneCollectionName ? ' active' : '');
      item.innerHTML = `
        <span class="list-item-label">
          <i class="fas fa-layer-group list-item-icon"></i>
          ${collection}
        </span>
      `;
      item.addEventListener('click', () => switchSceneCollection(collection));
      elements.collectionsList.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load scene collections:', error);
    if (elements.collectionsList) {
      elements.collectionsList.innerHTML = '<div class="empty-state">Failed to load collections</div>';
    }
  }
}

async function switchSceneCollection(collectionName) {
  try {
    await obs.call('SetCurrentSceneCollection', { sceneCollectionName: collectionName });
    // Wait a moment for OBS to switch collections
    setTimeout(async () => {
      await loadSceneCollections();
      clearSceneThumbnails(true);
      await loadScenes();
      await loadAudioSources();
    }, 500);
  } catch (error) {
    console.error('Failed to switch scene collection:', error);
    alert('Failed to switch scene collection: ' + error.message);
  }
}

// Profiles
async function loadProfiles() {
  try {
    const { profiles, currentProfileName } = await obs.call('GetProfileList');
    
    if (!elements.profilesList) return;
    
    elements.profilesList.innerHTML = '';
    profiles.forEach(profile => {
      const item = document.createElement('div');
      item.className = 'list-item' + (profile === currentProfileName ? ' active' : '');
      item.innerHTML = `
        <span class="list-item-label">
          <i class="fas fa-sitemap list-item-icon"></i>
          ${profile}
        </span>
      `;
      item.addEventListener('click', () => switchProfile(profile));
      elements.profilesList.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load profiles:', error);
    if (elements.profilesList) {
      elements.profilesList.innerHTML = '<div class="empty-state">Failed to load profiles</div>';
    }
  }
}

async function switchProfile(profileName) {
  try {
    await obs.call('SetCurrentProfile', { profileName: profileName });
    // Wait a moment for OBS to switch profiles
    setTimeout(async () => {
      await loadProfiles();
      clearSceneThumbnails(true);
      await loadScenes();
      await loadAudioSources();
    }, 500);
  } catch (error) {
    console.error('Failed to switch profile:', error);
    alert('Failed to switch profile: ' + error.message);
  }
}

// Recordings (removed - not supported by WebSocket)
async function loadRecordings() {
  // OBS WebSocket doesn't provide a direct way to list recordings
  console.log('Recordings list not available via OBS WebSocket');
  if (elements.recordingsList) {
    elements.recordingsList.innerHTML = '<div class="empty-state">OBS WebSocket does not expose recordings list</div>';
  }
}

// UI helpers
function enableControls() {
  elements.streamBtn.disabled = false;
  elements.recordBtn.disabled = false;
  if (elements.virtualCamBtn) elements.virtualCamBtn.disabled = false;
  elements.transitionSelect.disabled = false;
  elements.transitionDuration.disabled = false;
}

function resetUI() {
  elements.scenesList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  elements.sourcesList.innerHTML = '<div class="empty-state">Select a scene</div>';
  if (elements.audioMixer) elements.audioMixer.innerHTML = '<div class="empty-state">No audio sources available</div>';
  if (elements.collectionsList) elements.collectionsList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  if (elements.profilesList) elements.profilesList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  if (elements.recordingsList) elements.recordingsList.innerHTML = '<div class="empty-state">Recordings list requires OBS connection</div>';
  clearSceneThumbnails(true);
  stopThumbnailRefresh();
  
  elements.streamBtn.disabled = true;
  elements.recordBtn.disabled = true;
  elements.pauseRecordBtn.disabled = true;
  if (elements.virtualCamBtn) elements.virtualCamBtn.disabled = true;
  if (elements.transitionBtn) elements.transitionBtn.disabled = true;
  elements.transitionSelect.disabled = true;
  elements.transitionDuration.disabled = true;
  
  elements.streamTime.textContent = '--:--:--';
  elements.fpsValue.textContent = '--';
  elements.cpuValue.textContent = '--%';
  elements.memoryValue.textContent = '-- MB';
  elements.bitrateValue.textContent = '-- kbps';
  elements.droppedFrames.textContent = '0 (0%)';
  
  elements.studioModeToggle.checked = false;
  updateStudioModeUI();
}

function clearIntervals() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  stopThumbnailRefresh();
  
  Object.values(audioLevelIntervals).forEach(interval => clearInterval(interval));
  audioLevelIntervals = {};
}

// Bidirectional sync - poll OBS for state changes
function startBidirectionalSync() {
  if (syncInterval) clearInterval(syncInterval);
  
  const intervalMs = Math.max(500, preferences.syncIntervalMs || DEFAULT_SETTINGS.syncIntervalMs);
  syncInterval = setInterval(async () => {
    if (!isConnected || !obs) return;
    
    try {
      // Sync audio volume sliders and mute buttons
      const audioChannels = document.querySelectorAll('.audio-channel');
      for (const channel of audioChannels) {
        const inputName = channel.querySelector('.volume-slider')?.dataset.input;
        if (!inputName) continue;
        
        try {
          // Get current volume from OBS
          const { inputVolumeDb } = await obs.call('GetInputVolume', { inputName });
          const percent = dbToPercent(inputVolumeDb);
          
          // Update slider if not currently being dragged
          const slider = channel.querySelector('.volume-slider');
          const volumeValue = channel.querySelector('.volume-value');
          if (slider && document.activeElement !== slider) {
            slider.value = percent;
            if (volumeValue) volumeValue.textContent = `${Math.round(percent)}%`;
          }
          
          // Update mute button
          const { inputMuted } = await obs.call('GetInputMute', { inputName });
          const muteBtn = channel.querySelector('.mute-btn');
          if (muteBtn) {
            if (inputMuted) {
              muteBtn.classList.add('muted');
              muteBtn.querySelector('i').className = 'fas fa-volume-mute';
            } else {
              muteBtn.classList.remove('muted');
              muteBtn.querySelector('i').className = 'fas fa-volume-up';
            }
          }
        } catch (e) {
          // Source may have been removed
        }
      }
      
      // Sync studio mode toggle
      if (elements.studioModeToggle) {
        const { studioModeEnabled } = await obs.call('GetStudioModeEnabled');
        if (elements.studioModeToggle.checked !== studioModeEnabled) {
          isStudioMode = studioModeEnabled;
          elements.studioModeToggle.checked = studioModeEnabled;
          updateStudioModeUI();
        }
      }
      
      // Sync streaming status
      const { outputActive: streamActive } = await obs.call('GetStreamStatus');
      const isStreamButtonActive = elements.streamBtn && elements.streamBtn.textContent.includes('Stop');
      if (streamActive !== isStreamButtonActive) {
        updateStreamButton(streamActive);
      }
      
      // Sync recording status
      const { outputActive: recordActive } = await obs.call('GetRecordStatus');
      const isRecordButtonActive = elements.recordBtn && elements.recordBtn.textContent.includes('Stop');
      if (recordActive !== isRecordButtonActive) {
        updateRecordButton(recordActive);
      }
      
      // Sync transition selection
      if (elements.transitionSelect && !isUserInteractingWithTransition) {
        const { currentSceneTransitionName } = await obs.call('GetCurrentSceneTransition');
        if (elements.transitionSelect.value !== currentSceneTransitionName) {
          elements.transitionSelect.value = currentSceneTransitionName;
        }
        
        // Sync transition duration
        const { transitionDuration } = await obs.call('GetCurrentSceneTransition');
        if (elements.transitionDuration && elements.transitionDuration.value != transitionDuration) {
          elements.transitionDuration.value = transitionDuration;
        }
      }
      
    } catch (error) {
      console.error('Bidirectional sync error:', error);
      // Don't spam errors if connection is lost
    }
  }, intervalMs); // Poll every second
}

// Initialize app when DOM is ready
console.log('app.js loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded event fired!');
  preferences = loadPreferences();
  applyPreferences();
  registerGlobalShortcuts();
  await init();
});
