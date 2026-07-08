"use strict";

const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const test = require("node:test");
const { once } = require("node:events");
const { UdpTelemetryListener } = require("../src/main/telemetry/udp-listener");

test("listens on UDP and emits normalized samples", async () => {
  const listener = new UdpTelemetryListener({
    port: 0,
    host: "127.0.0.1",
    decoder: () => ({
      gameId: "fh6",
      packetFormat: "dash",
      packetLength: 4,
      receivedAt: new Date().toISOString(),
      isRaceOn: true,
      engine: { rpm: 4500, maxRpm: 7000, idleRpm: 900 },
      dash: { speedMps: 20 },
      inputs: { throttleRaw: 255, brakeRaw: 0, clutchRaw: 0, handbrakeRaw: 0, gear: 3, steerRaw: 0 },
      wheels: {}
    })
  });

  const status = await listener.start();
  const socket = dgram.createSocket("udp4");
  socket.send(Buffer.from([1, 2, 3, 4]), status.port, "127.0.0.1");

  const [sample] = await once(listener, "sample");
  socket.close();
  await listener.stop();

  assert.equal(sample.gameId, "fh6");
  assert.equal(sample.motion.speedKph, 72);
  assert.equal(sample.inputs.throttlePct, 100);
});
