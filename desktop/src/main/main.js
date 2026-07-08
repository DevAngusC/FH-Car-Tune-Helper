"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { registerTelemetryIpc } = require("./ipc");
const { resolveSessionRoot } = require("./storage/session-store");
const { TelemetryService } = require("./telemetry/telemetry-service");

let mainWindow = null;
let latestSample = null;
let sampleFlushTimer = null;

const telemetryService = new TelemetryService({
  sessionRoot: resolveSessionRoot(app)
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 720,
    minHeight: 640,
    title: "FH6 Telemetry",
    webPreferences: {
      preload: path.join(__dirname, "../preload/telemetry-api.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function startSampleFlush() {
  if (sampleFlushTimer) {
    return;
  }

  sampleFlushTimer = setInterval(() => {
    if (!latestSample) {
      return;
    }
    broadcast("telemetry:sample", latestSample);
    latestSample = null;
  }, 100);
}

registerTelemetryIpc({ ipcMain, telemetryService, shell });

telemetryService.on("sample", (sample) => {
  latestSample = sample;
});
telemetryService.on("status", (state) => broadcast("telemetry:status", state));
telemetryService.on("session", (session) => broadcast("telemetry:session", session));
telemetryService.on("decode-error", (error) => broadcast("telemetry:error", error.message));
telemetryService.on("listener-error", (error) => broadcast("telemetry:error", error.message));

app.whenReady().then(() => {
  createWindow();
  startSampleFlush();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (sampleFlushTimer) {
    clearInterval(sampleFlushTimer);
  }
  await telemetryService.stopSession();
  await telemetryService.stopListener();
});
