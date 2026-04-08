const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  loadConfig: () => ipcRenderer.invoke("load-config"),
  validateApiKey: (key) => ipcRenderer.invoke("validate-api-key", key),
  finishOnboarding: () => ipcRenderer.invoke("finish-onboarding"),
  installDependencies: () => ipcRenderer.invoke("install-dependencies"),
});
