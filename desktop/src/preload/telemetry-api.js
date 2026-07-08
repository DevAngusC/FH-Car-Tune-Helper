"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function on(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("fh6Telemetry", {
  getState: () => ipcRenderer.invoke("telemetry:get-state"),
  startListener: (options) => ipcRenderer.invoke("telemetry:start-listener", options),
  stopListener: () => ipcRenderer.invoke("telemetry:stop-listener"),
  startSession: (metadata) => ipcRenderer.invoke("telemetry:start-session", metadata),
  stopSession: () => ipcRenderer.invoke("telemetry:stop-session"),
  listSessions: () => ipcRenderer.invoke("telemetry:list-sessions"),
  loadSession: (sessionId) => ipcRenderer.invoke("telemetry:load-session", sessionId),
  updateSessionName: (sessionId, name) => ipcRenderer.invoke("telemetry:update-session-name", sessionId, name),
  openSessionFolder: (directory) => ipcRenderer.invoke("telemetry:open-session-folder", directory),
  onSample: (callback) => on("telemetry:sample", callback),
  onStatus: (callback) => on("telemetry:status", callback),
  onSession: (callback) => on("telemetry:session", callback),
  onError: (callback) => on("telemetry:error", callback)
});
