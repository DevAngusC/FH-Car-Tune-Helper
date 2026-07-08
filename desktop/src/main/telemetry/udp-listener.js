"use strict";

const dgram = require("node:dgram");
const { EventEmitter } = require("node:events");
const { decodeForzaPacket } = require("./forza-dash-decoder");
const { normalizeForzaTelemetry } = require("./telemetry-normalizer");

class UdpTelemetryListener extends EventEmitter {
  constructor({ port = 5300, host = "0.0.0.0", decoder = decodeForzaPacket, normalizer = normalizeForzaTelemetry } = {}) {
    super();
    this.port = port;
    this.host = host;
    this.decoder = decoder;
    this.normalizer = normalizer;
    this.socket = null;
    this.status = {
      listening: false,
      port,
      host,
      packetsReceived: 0,
      packetsDecoded: 0,
      decodeErrors: 0,
      lastPacketAt: null,
      lastError: null
    };
  }

  start(options = {}) {
    if (this.socket) {
      return Promise.resolve(this.getStatus());
    }

    this.port = Number(options.port ?? this.port) || 5300;
    this.host = options.host ?? this.host;
    this.status.port = this.port;
    this.status.host = this.host;
    this.status.lastError = null;

    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      this.socket = socket;

      socket.on("message", (message, remote) => this.handleMessage(message, remote));
      socket.on("error", (error) => {
        this.status.lastError = error.message;
        this.emit("listener-error", error);
      });

      socket.once("listening", () => {
        const address = socket.address();
        if (address && typeof address === "object") {
          this.status.port = address.port;
          this.status.host = address.address;
        }
        this.status.listening = true;
        this.emit("listening", this.getStatus());
        resolve(this.getStatus());
      });

      socket.once("error", (error) => {
        if (!this.status.listening) {
          this.socket = null;
          reject(error);
        }
      });

      socket.bind(this.port, this.host);
    });
  }

  stop() {
    if (!this.socket) {
      this.status.listening = false;
      return Promise.resolve(this.getStatus());
    }

    return new Promise((resolve) => {
      const socket = this.socket;
      this.socket = null;
      socket.close(() => {
        this.status.listening = false;
        this.emit("stopped", this.getStatus());
        resolve(this.getStatus());
      });
    });
  }

  handleMessage(message, remote) {
    this.status.packetsReceived += 1;
    this.status.lastPacketAt = new Date().toISOString();

    try {
      const raw = this.decoder(message, {
        receivedAt: this.status.lastPacketAt,
        source: {
          address: remote.address,
          port: remote.port,
          size: message.length
        }
      });
      const sample = this.normalizer(raw);
      this.status.packetsDecoded += 1;
      this.emit("sample", sample);
    } catch (error) {
      this.status.decodeErrors += 1;
      this.status.lastError = error.message;
      this.emit("decode-error", error);
    }
  }

  getStatus() {
    return { ...this.status };
  }
}

module.exports = {
  UdpTelemetryListener
};
