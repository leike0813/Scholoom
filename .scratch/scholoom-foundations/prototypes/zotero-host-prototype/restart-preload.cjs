const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('literatureClient', {
  request: (method, params = {}) => ipcRenderer.invoke('literature-request', method, params),
});
