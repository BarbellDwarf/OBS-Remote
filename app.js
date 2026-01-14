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

// Audio meter constants
const MIN_DB = -60;  // Minimum dB level (silent/very quiet)
const MAX_DB = 0;    // Maximum dB level (peak/clipping)
const DB_RANGE = MAX_DB - MIN_DB;  // Total dB range (60)
const PEAK_THRESHOLD_DB = -5;  // dB level for peak indicator (red)
const FILTER_CROP_MAX = 3840; // 4K UHD width; bounds typical HD/4K frame sizes
let toastContainer = null;

let obs = null;
let isConnected = false;
let isStudioMode = false;
let currentScene = null;
let statsInterval = null;
let audioLevelIntervals = {};
let syncInterval = null; // For bidirectional sync
let isUserInteractingWithTransition = false; // Prevent sync from overwriting user changes

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
  refreshProfiles: document.getElementById('refresh-profiles')
};

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
    option.value = index;
    option.textContent = conn.name;
    elements.savedConnections.appendChild(option);
  });
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

// Custom dialog function (replaces prompt() which doesn't work in Electron renderer)
function showConnectionNameDialog(defaultValue, callback) {
  const dialog = document.getElementById('connection-name-dialog');
  const input = document.getElementById('connection-name-input');
  const saveBtn = document.getElementById('dialog-save-btn');
  const cancelBtn = document.getElementById('dialog-cancel-btn');
  
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
  
  // Reset to new connection
  elements.savedConnections.value = '';
  loadSavedConnection();
  
  alert('Connection deleted successfully!');
}

// Legacy save/load functions (kept for backwards compatibility)
function saveSettings() {
  const settings = {
    host: elements.wsHost.value,
    port: elements.wsPort.value
  };
  localStorage.setItem('obsSettings', JSON.stringify(settings));
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('obsSettings') || '{}');
  if (settings.host) elements.wsHost.value = settings.host;
  if (settings.port) elements.wsPort.value = settings.port;
}

// Connection handling
async function handleConnect() {
  if (!obs) {
    alert('OBS WebSocket client not initialized. Please reload the page.');
    return;
  }
  
  if (isConnected) {
    await disconnect();
  } else {
    await connect();
  }
}

async function connect() {
  try {
    console.log('Attempting to connect to OBS...');
    updateConnectionStatus('connecting', 'Connecting...');
    elements.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    elements.connectBtn.disabled = true;

    const host = elements.wsHost.value || 'localhost';
    const port = elements.wsPort.value || '4455';
    const password = elements.wsPassword.value || '';

    console.log(`Connecting to ws://${host}:${port}`);
    await obs.connect(`ws://${host}:${port}`, password);
    
    console.log('Connection successful!');
    isConnected = true;
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
  });
  
  obs.on('ConnectionError', (error) => {
    console.error('Connection error:', error);
    resetConnectionUI();
    alert('Lost connection to OBS: ' + (error.message || 'Unknown error'));
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
    });
    
    updateActiveScene();
  } catch (error) {
    console.error('Failed to load scenes:', error);
    elements.scenesList.innerHTML = '<div class="empty-state">Failed to load scenes</div>';
  }
}

function createSceneItem(sceneName) {
  const item = document.createElement('div');
  item.className = 'list-item';
  item.innerHTML = `
    <div class="list-item-label">
      <i class="fas fa-image list-item-icon"></i>
      <span>${sceneName}</span>
    </div>
  `;
  item.addEventListener('click', () => setScene(sceneName));
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
  } catch (error) {
    console.error('Failed to set scene:', error);
  }
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
  
  const header = document.createElement('div');
  header.className = 'source-header';

  const iconSpan = document.createElement('i');
  iconSpan.className = `fas fa-${getSourceIcon(item.sourceType)}`;
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'source-name';
  nameSpan.textContent = item.sourceName;
  
  const actions = document.createElement('div');
  actions.className = 'source-actions';
  
  const filtersBtn = document.createElement('button');
  filtersBtn.className = 'btn-icon source-filters-btn';
  filtersBtn.title = 'Filters';
  filtersBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
  
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

  actions.appendChild(filtersBtn);
  actions.appendChild(visibilityBtn);
  
  header.appendChild(iconSpan);
  header.appendChild(nameSpan);
  header.appendChild(actions);

  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'filters-drawer';
  filtersContainer.style.display = 'none';

  filtersBtn.onclick = async (e) => {
    e.stopPropagation();
    const isOpen = filtersContainer.style.display === 'block';
    filtersContainer.style.display = isOpen ? 'none' : 'block';
    filtersBtn.classList.toggle('active', !isOpen);
    if (!isOpen) {
      await renderSourceFilters(item.sourceName, filtersContainer);
    }
  };
  
  div.appendChild(header);
  div.appendChild(filtersContainer);
  
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

// Source Filters
async function renderSourceFilters(sourceName, container) {
  container.innerHTML = '<div class="filters-loading">Loading filters...</div>';
  try {
    const { filters } = await obs.call('GetSourceFilterList', { sourceName });
    if (!filters || filters.length === 0) {
      container.innerHTML = '<div class="empty-state small">No filters on this source</div>';
      return;
    }
    
    container.innerHTML = '';
    filters.forEach(filter => {
      const row = createFilterRow(sourceName, filter, container);
      container.appendChild(row);
    });
  } catch (error) {
    console.error(`Failed to load filters for ${sourceName}:`, error);
    container.innerHTML = '<div class="empty-state small">Failed to load filters</div>';
  }
}

function createFilterRow(sourceName, filter, container) {
  const row = document.createElement('div');
  row.className = 'filter-row';
  
  const header = document.createElement('div');
  header.className = 'filter-row-header';
  const nameWrap = document.createElement('div');
  nameWrap.className = 'filter-name';
  const nameIcon = document.createElement('i');
  nameIcon.className = 'fas fa-filter';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = filter.filterName;
  nameWrap.appendChild(nameIcon);
  nameWrap.appendChild(nameSpan);
  header.appendChild(nameWrap);
  
  const toggle = document.createElement('label');
  toggle.className = 'switch';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = !!filter.filterEnabled;
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider round';
  toggle.appendChild(toggleInput);
  toggle.appendChild(toggleSlider);
  toggleInput.addEventListener('change', async () => {
    await setFilterEnabled(sourceName, filter.filterName, toggleInput.checked, container);
  });
  
  header.appendChild(toggle);
  row.appendChild(header);
  
  const controls = createFilterControls(sourceName, filter, container);
  if (controls) {
    row.appendChild(controls);
  }
  
  return row;
}

function createFilterControls(sourceName, filter, container) {
  const settings = filter.filterSettings || {};
  const controls = document.createElement('div');
  controls.className = 'filter-controls';
  let hasControl = false;
  
  const addNumberControl = (label, key, value, min, max, step, isInteger = false) => {
    hasControl = true;
    let currentValue = value;
    const wrapper = document.createElement('label');
    wrapper.className = 'filter-control';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.min = min;
    input.max = max;
    input.step = step;
    wrapper.appendChild(span);
    wrapper.appendChild(input);
    input.addEventListener('change', async (e) => {
      const raw = isInteger ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
      if (Number.isNaN(raw)) {
        showToast(`Enter a valid number between ${min} and ${max}.`);
        e.target.value = currentValue;
        return;
      }
      const clamped = Math.max(min, Math.min(max, raw));
      if (clamped !== raw) {
        e.target.value = clamped;
      }
      await updateFilterSetting(sourceName, filter.filterName, { [key]: clamped }, container);
      currentValue = clamped;
    });
    controls.appendChild(wrapper);
  };
  
  if (typeof settings.db === 'number') {
    addNumberControl('Gain (dB)', 'db', settings.db, -30, 30, 0.1);
  }
  
  if (typeof settings.brightness === 'number') {
    addNumberControl('Brightness', 'brightness', settings.brightness, -2, 2, 0.05);
  }
  if (typeof settings.contrast === 'number') {
    addNumberControl('Contrast', 'contrast', settings.contrast, 0, 2, 0.05);
  }
  if (typeof settings.saturation === 'number') {
    addNumberControl('Saturation', 'saturation', settings.saturation, 0, 2, 0.05);
  }
  if (typeof settings.gamma === 'number') {
    addNumberControl('Gamma', 'gamma', settings.gamma, 0, 3, 0.05);
  }
  
  if (typeof settings.left === 'number') {
    addNumberControl('Left', 'left', settings.left, 0, FILTER_CROP_MAX, 1, true);
  }
  if (typeof settings.right === 'number') {
    addNumberControl('Right', 'right', settings.right, 0, FILTER_CROP_MAX, 1, true);
  }
  if (typeof settings.top === 'number') {
    addNumberControl('Top', 'top', settings.top, 0, FILTER_CROP_MAX, 1, true);
  }
  if (typeof settings.bottom === 'number') {
    addNumberControl('Bottom', 'bottom', settings.bottom, 0, FILTER_CROP_MAX, 1, true);
  }
  
  if (typeof settings.threshold === 'number') {
    addNumberControl('Threshold', 'threshold', settings.threshold, -60, 0, 0.5);
  }
  
  if (!hasControl) {
    controls.innerHTML = '<div class="filter-note">No quick controls for this filter type.</div>';
  }
  
  return controls;
}

async function setFilterEnabled(sourceName, filterName, enabled, container) {
  try {
    await obs.call('SetSourceFilterEnabled', { sourceName, filterName, filterEnabled: enabled });
  } catch (error) {
    console.error(`Failed to toggle filter "${filterName}" on ${sourceName}:`, error);
    showToast(`Failed to toggle filter "${filterName}": ${error.message}`);
    if (container) {
      await renderSourceFilters(sourceName, container);
    }
  }
}

async function updateFilterSetting(sourceName, filterName, partialSettings, container) {
  try {
    await obs.call('SetSourceFilterSettings', {
      sourceName,
      filterName,
      filterSettings: partialSettings
    });
  } catch (error) {
    console.error(`Failed to update filter settings for "${filterName}" on ${sourceName}:`, error);
    showToast(`Failed to update settings for filter "${filterName}": ${error.message}`);
    if (container) {
      await renderSourceFilters(sourceName, container);
    }
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
  }, 1000);
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
  // This function is kept for backwards compatibility but does nothing
  console.log('Recordings list not available via OBS WebSocket');
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
  elements.audioMixer.innerHTML = '<div class="empty-state">No audio sources available</div>';
  if (elements.collectionsList) elements.collectionsList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  if (elements.profilesList) elements.profilesList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  
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
  
  Object.values(audioLevelIntervals).forEach(interval => clearInterval(interval));
  audioLevelIntervals = {};
}

// Bidirectional sync - poll OBS for state changes
function startBidirectionalSync() {
  if (syncInterval) clearInterval(syncInterval);
  
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
  }, 1000); // Poll every second
}

// Initialize app when DOM is ready
console.log('app.js loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded event fired!');
  await init();
});
function showToast(message) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
