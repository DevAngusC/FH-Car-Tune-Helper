"use strict";

const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { TelemetryService } = require("../src/main/telemetry/telemetry-service");

test("auto records only while isRaceOn is active", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-auto-record-"));
  const listener = new FakeListener();
  const service = new TelemetryService({ sessionRoot, listener, autoStopDelayMs: 20 });

  await service.startListener();
  assert.equal(service.getState().autoRecord.state, "waiting");

  listener.emitSample(sample({ isRaceOn: false, speedKph: 0 }));
  assert.equal(service.getState().recording, false);

  const startPromise = once(service, "session");
  listener.emitSample(sample({ isRaceOn: true, speedKph: 80 }));
  const [started] = await startPromise;
  assert.equal(started.endedAt, null);

  await tick();
  listener.emitSample(sample({ isRaceOn: true, speedKph: 90 }));

  const stopPromise = waitForEndedSession(service);
  listener.emitSample(sample({ isRaceOn: false, speedKph: 0 }));
  const stopped = await stopPromise;

  assert.equal(stopped.sampleCount, 2);
  assert.equal(stopped.summary.sampleCount, 2);
  await tick();
  assert.equal(service.getState().autoRecord.state, "waiting");
});

class FakeListener extends EventEmitter {
  constructor() {
    super();
    this.status = {
      listening: false,
      port: 5300,
      host: "127.0.0.1",
      packetsReceived: 0,
      packetsDecoded: 0,
      decodeErrors: 0,
      lastPacketAt: null,
      lastError: null
    };
  }

  start() {
    this.status.listening = true;
    this.emit("listening", this.getStatus());
    return Promise.resolve(this.getStatus());
  }

  stop() {
    this.status.listening = false;
    this.emit("stopped", this.getStatus());
    return Promise.resolve(this.getStatus());
  }

  emitSample(value) {
    this.status.packetsReceived += 1;
    this.status.packetsDecoded += 1;
    this.status.lastPacketAt = value.receivedAt;
    this.emit("sample", value);
  }

  getStatus() {
    return { ...this.status };
  }
}

function waitForEndedSession(service) {
  return new Promise((resolve) => {
    const onSession = (session) => {
      if (!session?.endedAt) {
        return;
      }
      service.removeListener("session", onSession);
      resolve(session);
    };
    service.on("session", onSession);
  });
}

function sample({ isRaceOn, speedKph }) {
  return {
    schema: "fh6-tune-helper.telemetry.sample.v1",
    gameId: "fh6",
    receivedAt: new Date().toISOString(),
    timestampMs: Date.now(),
    isRaceOn,
    motion: {
      speedKph,
      position: { x: speedKph, y: 0, z: speedKph / 2 }
    },
    engine: { rpm: 5000, rpmPct: 75 },
    inputs: { throttlePct: speedKph > 0 ? 80 : 0, brakePct: 0, steerPct: 0, gear: speedKph > 0 ? 3 : 0 },
    wheels: {}
  };
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}
