"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { decodeForzaPacket, UnsupportedForzaPacketError } = require("../src/main/telemetry/forza-dash-decoder");
const { normalizeForzaTelemetry } = require("../src/main/telemetry/telemetry-normalizer");

test("decodes and normalizes a Forza dash packet", () => {
  const packet = createDashPacket();
  const raw = decodeForzaPacket(packet, {
    receivedAt: "2026-07-08T00:00:00.000Z",
    source: { address: "127.0.0.1", port: 5300, size: packet.length }
  });

  assert.equal(raw.packetFormat, "dash");
  assert.equal(raw.packetLength, 311);
  assert.equal(raw.isRaceOn, true);
  assert.equal(raw.timestampMs, 123456);
  assert.equal(raw.engine.rpm, 5000);
  assert.equal(raw.dash.speedMps, 30);
  assert.equal(raw.inputs.gear, 4);
  assert.equal(raw.inputs.steerRaw, -20);
  assert.equal(raw.wheels.frontLeft.tireTempC, 82);
  assert.equal(raw.dash.racePosition, 2);
  assert.equal(raw.dash.currentRaceTimeSeconds, 125);
  assert.equal(raw.wheels.frontLeft.rotationSpeed, 30);
  assert.equal(raw.wheels.frontLeft.onRumbleStrip, 0);

  const normalized = normalizeForzaTelemetry(raw);
  assert.equal(normalized.motion.speedKph, 108);
  assert.equal(Math.round(normalized.engine.rpmPct), 71);
  assert.equal(Math.round(normalized.inputs.throttlePct), 50);
  assert.equal(Math.round(normalized.inputs.brakePct), 10);
  assert.equal(Math.round(normalized.inputs.steerPct), -16);
  assert.equal(normalized.inputs.clutchPct, 0);
  assert.equal(normalized.inputs.normalizedDrivingLine, 0);
  assert.equal(normalized.dash.racePosition, 2);
  assert.equal(normalized.wheels.frontLeft.rotationSpeed, 30);
});

test("decodes and normalizes a Horizon dash packet with the 12-byte extension", () => {
  const packet = createDashPacket({ horizon: true });
  const raw = decodeForzaPacket(packet, {
    receivedAt: "2026-07-08T00:00:00.000Z",
    source: { address: "127.0.0.1", port: 5300, size: packet.length }
  });

  assert.equal(raw.packetFormat, "dash");
  assert.equal(raw.packetLayout, "horizon-dash");
  assert.equal(raw.packetLength, 324);
  assert.equal(raw.position.x, 10);
  assert.equal(raw.position.y, 20);
  assert.equal(raw.position.z, 30);
  assert.equal(raw.dash.speedMps, 30);
  assert.equal(raw.inputs.gear, 4);
  assert.equal(raw.inputs.steerRaw, -20);
  assert.equal(raw.wheels.frontLeft.tireTempC, 82);
  assert.equal(raw.dash.racePosition, 2);

  const normalized = normalizeForzaTelemetry(raw);
  assert.equal(normalized.motion.speedKph, 108);
  assert.equal(Math.round(normalized.inputs.throttlePct), 50);
  assert.equal(normalized.dash.currentRaceTimeSeconds, 125);
});

test("rejects packets shorter than the Forza sled shape", () => {
  assert.throws(() => decodeForzaPacket(Buffer.alloc(12)), UnsupportedForzaPacketError);
});

function createDashPacket({ horizon = false } = {}) {
  const buffer = Buffer.alloc(horizon ? 324 : 311);
  let offset = 0;

  buffer.writeInt32LE(1, offset);
  offset += 4;
  buffer.writeUInt32LE(123456, offset);
  offset += 4;
  offset = writeFloatSeries(buffer, offset, [7000, 900, 5000]);
  offset = writeFloatSeries(buffer, offset, [1, 2, 3]);
  offset = writeFloatSeries(buffer, offset, [4, 5, 6]);
  offset = writeFloatSeries(buffer, offset, [0.1, 0.2, 0.3]);
  offset = writeFloatSeries(buffer, offset, [0.01, 0.02, 0.03]);
  offset = writeFloatSeries(buffer, offset, [0.2, 0.2, 0.3, 0.3]);
  offset = writeFloatSeries(buffer, offset, [0.1, 0.1, 0.2, 0.2]);
  offset = writeFloatSeries(buffer, offset, [30, 30, 32, 32]);
  offset = writeIntSeries(buffer, offset, [0, 0, 0, 0]);
  offset = writeFloatSeries(buffer, offset, [0, 0, 0, 0]);
  offset = writeFloatSeries(buffer, offset, [0, 0, 0, 0]);
  offset = writeFloatSeries(buffer, offset, [2, 2, 3, 3]);
  offset = writeFloatSeries(buffer, offset, [0.4, 0.4, 0.5, 0.5]);
  offset = writeFloatSeries(buffer, offset, [0.03, 0.03, 0.04, 0.04]);
  offset = writeIntSeries(buffer, offset, [100, 6, 800, 2, 8]);
  if (horizon) {
    offset = writeFloatSeries(buffer, offset, [0, 0, 0]);
  }
  offset = writeFloatSeries(buffer, offset, [10, 20, 30]);
  offset = writeFloatSeries(buffer, offset, [30, 100000, 400]);
  offset = writeFloatSeries(buffer, offset, [82, 83, 78, 79]);
  offset = writeFloatSeries(buffer, offset, [1.2, 0.7, 1200, 80, 83, 24, 125]);

  buffer.writeUInt16LE(3, offset);
  offset += 2;
  buffer.writeUInt8(2, offset);
  offset += 1;
  buffer.writeUInt8(128, offset);
  buffer.writeUInt8(26, offset + 1);
  buffer.writeUInt8(0, offset + 2);
  buffer.writeUInt8(0, offset + 3);
  buffer.writeUInt8(4, offset + 4);
  buffer.writeInt8(-20, offset + 5);
  buffer.writeInt8(0, offset + 6);
  buffer.writeInt8(0, offset + 7);

  return buffer;
}

function writeFloatSeries(buffer, offset, values) {
  for (const value of values) {
    buffer.writeFloatLE(value, offset);
    offset += 4;
  }
  return offset;
}

function writeIntSeries(buffer, offset, values) {
  for (const value of values) {
    buffer.writeInt32LE(value, offset);
    offset += 4;
  }
  return offset;
}
