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

let obs = null;
let isConnected = false;
let isStudioMode = false;
let currentScene = null;
let statsInterval = null;
let audioLevelIntervals = {};

// DOM Elements
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
  audioMixer: document.getElementById('audio-mixer'),
  streamBtn: document.getElementById('stream-btn'),
  recordBtn: document.getElementById('record-btn'),
  pauseRecordBtn: document.getElementById('pause-record-btn'),
  studioModeToggle: document.getElementById('studio-mode-toggle'),
  singlePreview: document.getElementById('single-preview'),
  studioPreview: document.getElementById('studio-preview'),
  transitionBtn: document.getElementById('transition-btn'),
  transitionSelect: document.getElementById('transition-select'),
  transitionDuration: document.getElementById('transition-duration'),
  streamTime: document.getElementById('stream-time'),
  fpsValue: document.getElementById('fps-value'),
  cpuValue: document.getElementById('cpu-value'),
  memoryValue: document.getElementById('memory-value'),
  bitrateValue: document.getElementById('bitrate-value'),
  droppedFrames: document.getElementById('dropped-frames'),
  recordingsList: document.getElementById('recordings-list'),
  refreshRecordings: document.getElementById('refresh-recordings'),
  savedConnections: document.getElementById('saved-connections'),
  saveConnectionBtn: document.getElementById('save-connection-btn'),
  deleteConnectionBtn: document.getElementById('delete-connection-btn')
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

// Setup event listeners
function setupEventListeners() {
  elements.connectBtn.addEventListener('click', handleConnect);
  elements.streamBtn.addEventListener('click', toggleStreaming);
  elements.recordBtn.addEventListener('click', toggleRecording);
  elements.pauseRecordBtn.addEventListener('click', pauseRecording);
  elements.studioModeToggle.addEventListener('change', toggleStudioMode);
  elements.transitionBtn.addEventListener('click', performTransition);
  elements.transitionSelect.addEventListener('change', setCurrentTransition);
  elements.refreshRecordings.addEventListener('click', loadRecordings);
  elements.savedConnections.addEventListener('change', loadSavedConnection);
  elements.saveConnectionBtn.addEventListener('click', saveCurrentConnection);
  elements.deleteConnectionBtn.addEventListener('click', deleteCurrentConnection);
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

function saveCurrentConnection() {
  const host = elements.wsHost.value.trim();
  const port = elements.wsPort.value.trim();
  const password = elements.wsPassword.value;
  
  if (!host || !port) {
    alert('Please enter host and port before saving.');
    return;
  }
  
  const connectionName = prompt('Enter a name for this connection:', `${host}:${port}`);
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
      getStudioModeStatus(),
      getStreamingStatus(),
      getRecordingStatus()
    ]);
    
    // Start stats polling
    startStatsPolling();
    
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
  });
  
  obs.on('SceneListChanged', () => {
    loadScenes();
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
  div.innerHTML = `
    <i class="fas fa-${getSourceIcon(item.sourceType)}"></i>
    <span>${item.sourceName}</span>
  `;
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

// Audio
async function loadAudioSources() {
  try {
    const { inputs } = await obs.call('GetInputList');
    
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
          audioInputs.push({ ...input, inputKind });
        }
      } catch (e) {
        // Input doesn't have audio or doesn't exist anymore
      }
    }
    
    elements.audioMixer.innerHTML = '';
    if (audioInputs.length === 0) {
      elements.audioMixer.innerHTML = '<div class="empty-state">No audio sources available</div>';
      return;
    }
    
    for (const input of audioInputs) {
      const audioChannel = await createAudioChannel(input.inputName, input.inputKind);
      elements.audioMixer.appendChild(audioChannel);
    }
  } catch (error) {
    console.error('Failed to load audio sources:', error);
    elements.audioMixer.innerHTML = '<div class="empty-state">Failed to load audio sources</div>';
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
  // OBS WebSocket 5.x provides InputVolumeMeters event for real-time audio levels
  const meter = document.querySelector(`.audio-meter[data-input="${inputName}"]`);
  if (!meter) return;
  
  // Poll audio levels periodically
  audioLevelIntervals[inputName] = setInterval(async () => {
    try {
      // Get input volume meters
      const response = await obs.call('GetInputVolume', { inputName });
      const volumeDb = response.inputVolumeDb;
      
      // Convert dB to percentage for visualization (roughly -60dB to 0dB range)
      // -60dB or lower = 0%, 0dB = 100%
      const percentage = Math.max(0, Math.min(100, ((volumeDb + 60) / 60) * 100));
      
      const bars = meter.querySelectorAll('.meter-bar');
      const activeCount = Math.floor((percentage / 100) * bars.length);
      
      bars.forEach((bar, index) => {
        if (index < activeCount) {
          bar.classList.add('active');
          // Red peak indicators for levels above 80%
          if (index > bars.length * 0.8) {
            bar.classList.add('peak');
          } else {
            bar.classList.remove('peak');
          }
        } else {
          bar.classList.remove('active', 'peak');
        }
      });
    } catch (error) {
      // If we can't get the volume, clear the meter
      const bars = meter.querySelectorAll('.meter-bar');
      bars.forEach(bar => bar.classList.remove('active', 'peak'));
    }
  }, 100); // Update 10 times per second for smooth animation
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

function updateStudioModeUI() {
  if (isStudioMode) {
    elements.singlePreview.style.display = 'none';
    elements.studioPreview.style.display = 'flex';
    elements.transitionBtn.disabled = false;
  } else {
    elements.singlePreview.style.display = 'flex';
    elements.studioPreview.style.display = 'none';
    elements.transitionBtn.disabled = true;
  }
}

async function performTransition() {
  try {
    await obs.call('TriggerStudioModeTransition');
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

// Recordings
async function loadRecordings() {
  try {
    // OBS WebSocket doesn't provide a direct way to list recordings
    // This is a placeholder implementation
    elements.recordingsList.innerHTML = `
      <div class="empty-state">
        <p>Recordings list not available via WebSocket</p>
        <small>Check OBS recordings folder manually</small>
      </div>
    `;
    
    // Optionally, you could implement file system access if running in Electron
    // with appropriate permissions
  } catch (error) {
    console.error('Failed to load recordings:', error);
  }
}

// UI helpers
function enableControls() {
  elements.streamBtn.disabled = false;
  elements.recordBtn.disabled = false;
  elements.transitionSelect.disabled = false;
  elements.transitionDuration.disabled = false;
}

function resetUI() {
  elements.scenesList.innerHTML = '<div class="empty-state">Not connected to OBS</div>';
  elements.sourcesList.innerHTML = '<div class="empty-state">Select a scene</div>';
  elements.audioMixer.innerHTML = '<div class="empty-state">No audio sources available</div>';
  elements.recordingsList.innerHTML = '<div class="empty-state">No recordings found</div>';
  
  elements.streamBtn.disabled = true;
  elements.recordBtn.disabled = true;
  elements.pauseRecordBtn.disabled = true;
  elements.transitionBtn.disabled = true;
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
  
  Object.values(audioLevelIntervals).forEach(interval => clearInterval(interval));
  audioLevelIntervals = {};
}

// Initialize app when DOM is ready
console.log('app.js loaded, waiting for DOMContentLoaded...');
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded event fired!');
  await init();
});
