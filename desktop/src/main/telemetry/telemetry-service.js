"use strict";

const { EventEmitter } = require("node:events");
const { SessionRecorder } = require("./session-recorder");
const { UdpTelemetryListener } = require("./udp-listener");
const { listSessions, loadSession, updateSessionName } = require("../storage/session-store");

class TelemetryService extends EventEmitter {
  constructor({ sessionRoot, listener = new UdpTelemetryListener(), autoStopDelayMs = 1000 } = {}) {
    super();
    this.sessionRoot = sessionRoot;
    this.listener = listener;
    this.recorder = new SessionRecorder({ sessionRoot });
    this.lastSample = null;
    this.autoRecordEnabled = true;
    this.autoStopDelayMs = autoStopDelayMs;
    this.autoStartPromise = null;
    this.autoStopPromise = null;
    this.autoFalseTimer = null;
    this.pendingAutoSamples = [];

    this.listener.on("sample", (sample) => {
      this.lastSample = sample;
      this.handleAutoRecordSample(sample);
      this.emit("sample", sample);
    });

    this.listener.on("listening", (status) => this.emit("status", this.getState(status)));
    this.listener.on("stopped", (status) => this.emit("status", this.getState(status)));
    this.listener.on("decode-error", (error) => this.emit("decode-error", error));
    this.listener.on("listener-error", (error) => this.emit("listener-error", error));
  }

  async startListener(options = {}) {
    const status = await this.listener.start(options);
    this.emit("status", this.getState(status));
    return this.getState(status);
  }

  async stopListener() {
    this.clearAutoFalseTimer();
    if (this.recorder.isRecording) {
      await this.stopSession();
    }
    const status = await this.listener.stop();
    this.emit("status", this.getState(status));
    return this.getState(status);
  }

  async startSession(metadata = {}) {
    const session = await this.recorder.start(metadata);
    this.emit("session", session);
    this.emit("status", this.getState());
    return session;
  }

  async stopSession() {
    this.clearAutoFalseTimer();
    const session = await this.recorder.stop();
    this.emit("session", session);
    this.emit("status", this.getState());
    return session;
  }

  async setAutoRecordEnabled(enabled) {
    this.autoRecordEnabled = Boolean(enabled);
    this.pendingAutoSamples = [];
    this.clearAutoFalseTimer();

    if (!this.autoRecordEnabled && this.recorder.isRecording) {
      await this.stopSession();
    } else {
      this.emit("status", this.getState());
    }

    return this.getState();
  }

  handleAutoRecordSample(sample) {
    if (!this.autoRecordEnabled) {
      return;
    }

    if (sample?.isRaceOn) {
      this.clearAutoFalseTimer();
      this.recordRaceSample(sample);
      return;
    }

    this.pendingAutoSamples = [];
    if (this.recorder.isRecording) {
      this.scheduleAutoStop();
    }
  }

  recordRaceSample(sample) {
    if (this.recorder.isRecording) {
      this.recorder.record(sample);
      return;
    }

    this.pendingAutoSamples.push(sample);
    if (this.autoStartPromise || this.autoStopPromise) {
      return;
    }

    this.autoStartPromise = this.startSession({
      gameId: sample.gameId ?? "fh6",
      autoRecord: true,
      trigger: "isRaceOn"
    })
      .then(() => {
        const samples = this.pendingAutoSamples;
        this.pendingAutoSamples = [];
        for (const pendingSample of samples) {
          this.recorder.record(pendingSample);
        }
        if (!samples.length && !this.lastSample?.isRaceOn) {
          this.scheduleAutoStop();
        }
        this.emit("status", this.getState());
      })
      .catch((error) => {
        this.pendingAutoSamples = [];
        this.emit("listener-error", error);
      })
      .finally(() => {
        this.autoStartPromise = null;
      });
  }

  scheduleAutoStop() {
    if (this.autoFalseTimer || this.autoStopPromise) {
      return;
    }

    this.autoFalseTimer = setTimeout(() => {
      this.autoFalseTimer = null;
      this.autoStopPromise = this.stopSession()
        .catch((error) => this.emit("listener-error", error))
        .finally(() => {
          this.autoStopPromise = null;
          this.emit("status", this.getState());
        });
      this.emit("status", this.getState());
    }, this.autoStopDelayMs);
  }

  clearAutoFalseTimer() {
    if (!this.autoFalseTimer) {
      return;
    }

    clearTimeout(this.autoFalseTimer);
    this.autoFalseTimer = null;
  }

  async listSessions() {
    return listSessions(this.sessionRoot);
  }

  async loadSession(sessionId) {
    return loadSession(this.sessionRoot, sessionId);
  }

  async updateSessionName(sessionId, name) {
    return updateSessionName(this.sessionRoot, sessionId, name);
  }

  getState(status = this.listener.getStatus()) {
    return {
      listener: status,
      recording: this.recorder.isRecording,
      session: this.recorder.getCurrentSession(),
      lastSample: this.lastSample,
      autoRecord: {
        enabled: this.autoRecordEnabled,
        state: this.autoRecordState(status),
        stopDelayMs: this.autoStopDelayMs
      }
    };
  }

  autoRecordState(status = this.listener.getStatus()) {
    if (this.autoStopPromise) {
      return "saving";
    }
    if (this.autoStartPromise) {
      return "starting";
    }
    if (this.recorder.isRecording) {
      return "recording";
    }
    if (!this.autoRecordEnabled) {
      return "off";
    }
    if (status.listening) {
      return "waiting";
    }
    return "idle";
  }
}

module.exports = {
  TelemetryService
};
