const { contextBridge, ipcRenderer } = require('electron');

// Expose OBS API through IPC to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  // OBS WebSocket methods
  obs: {
    create: () => ipcRenderer.invoke('obs:create'),
    connect: (url, password) => ipcRenderer.invoke('obs:connect', url, password),
    disconnect: () => ipcRenderer.invoke('obs:disconnect'),
    call: (requestType, requestData) => ipcRenderer.invoke('obs:call', requestType, requestData),
    setupEvents: () => ipcRenderer.invoke('obs:setupEvents'),
    
    // Event listener
    on: (callback) => {
      ipcRenderer.on('obs:event', (event, { eventName, data }) => {
        callback(eventName, data);
      });
    },
    
    // Remove event listener
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('obs:event');
    }
  },

  settings: {
    open: () => ipcRenderer.invoke('settings:open')
  }
});
