"use strict";

function registerTelemetryIpc({ ipcMain, telemetryService, shell }) {
  ipcMain.handle("telemetry:get-state", () => telemetryService.getState());
  ipcMain.handle("telemetry:start-listener", async (_event, options) => telemetryService.startListener(options));
  ipcMain.handle("telemetry:stop-listener", async () => telemetryService.stopListener());
  ipcMain.handle("telemetry:set-auto-record", async (_event, enabled) => telemetryService.setAutoRecordEnabled(enabled));
  ipcMain.handle("telemetry:start-session", async (_event, metadata) => telemetryService.startSession(metadata));
  ipcMain.handle("telemetry:stop-session", async () => telemetryService.stopSession());
  ipcMain.handle("telemetry:list-sessions", async () => telemetryService.listSessions());
  ipcMain.handle("telemetry:load-session", async (_event, sessionId) => telemetryService.loadSession(sessionId));
  ipcMain.handle("telemetry:update-session-name", async (_event, sessionId, name) =>
    telemetryService.updateSessionName(sessionId, name)
  );
  ipcMain.handle("telemetry:open-session-folder", async (_event, directory) => {
    if (!directory || !shell?.openPath) {
      return null;
    }
    return shell.openPath(directory);
  });
}

module.exports = {
  registerTelemetryIpc
};
