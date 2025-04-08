// import { contextBridge, ipcRenderer } from 'electron/renderer';
const { contextBridge, ipcRenderer } = require('electron/renderer');
console.log("Preload script loaded.");
contextBridge.exposeInMainWorld('electronAPI', {
    getTopLeftPosition: () => ipcRenderer.invoke('getTopLeftPosition'), // Renderer -> Main -> Renderer
    getBottomRightPosition: () => ipcRenderer.invoke('getBottomRightPosition'), // Renderer -> Main -> Renderer
    setAlgorithmConfig: (newAlgorithmConfig) => ipcRenderer.send('setAlgorithmConfig', newAlgorithmConfig), // Renderer -> Main
    setAlgorithmConfigToRenderer: (callback) => ipcRenderer.on('setAlgorithmConfigToRenderer', (_event, value) => callback(value)), // Main -> Renderer
});