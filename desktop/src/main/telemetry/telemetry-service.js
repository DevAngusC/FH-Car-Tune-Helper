"use strict";

const { EventEmitter } = require("node:events");
const { SessionRecorder } = require("./session-recorder");
const { UdpTelemetryListener } = require("./udp-listener");
const { listSessions, loadSession, updateSessionName } = require("../storage/session-store");

class TelemetryService extends EventEmitter {
  constructor({ sessionRoot, listener = new UdpTelemetryListener() }) {
    super();
    this.sessionRoot = sessionRoot;
    this.listener = listener;
    this.recorder = new SessionRecorder({ sessionRoot });
    this.lastSample = null;

    this.listener.on("sample", (sample) => {
      this.lastSample = sample;
      if (this.recorder.isRecording) {
        this.recorder.record(sample);
      }
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
    const status = await this.listener.stop();
    this.emit("status", this.getState(status));
    return this.getState(status);
  }

  async startSession(metadata = {}) {
    const session = await this.recorder.start(metadata);
    this.emit("session", session);
    return session;
  }

  async stopSession() {
    const session = await this.recorder.stop();
    this.emit("session", session);
    return session;
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
      lastSample: this.lastSample
    };
  }
}

module.exports = {
  TelemetryService
};
