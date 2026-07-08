"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { SessionRecorder } = require("../src/main/telemetry/session-recorder");

test("records samples and writes session artifacts", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-telemetry-"));
  const recorder = new SessionRecorder({ sessionRoot });

  const session = await recorder.start({ name: "Unit Test Car", gameId: "fh6" });
  recorder.record(sample(80));
  recorder.record(sample(90));
  const stopped = await recorder.stop();

  assert.equal(session.id, stopped.id);
  assert.equal(stopped.sampleCount, 2);

  const sessionJson = JSON.parse(await fs.readFile(stopped.files.session, "utf8"));
  const summaryJson = JSON.parse(await fs.readFile(stopped.files.summary, "utf8"));
  const samplesText = await fs.readFile(stopped.files.samples, "utf8");

  assert.equal(sessionJson.sampleCount, 2);
  assert.equal(summaryJson.sampleCount, 2);
  assert.equal(samplesText.trim().split("\n").length, 2);
});

test("uses a local timestamp name when recording starts without a name", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-telemetry-"));
  const recorder = new SessionRecorder({ sessionRoot });

  const session = await recorder.start({ gameId: "fh6" });
  const stopped = await recorder.stop();
  const sessionJson = JSON.parse(await fs.readFile(stopped.files.session, "utf8"));

  assert.match(session.metadata.name, /^\d{8} \d{2}:\d{2}$/);
  assert.equal(sessionJson.metadata.name, session.metadata.name);
  assert.equal(sessionJson.metadata.defaultName, session.metadata.name);
  assert.match(session.id, /^\d{8}_\d{6}-auto$/);
});

function sample(speedKph) {
  return {
    receivedAt: new Date().toISOString(),
    motion: { speedKph },
    engine: { rpm: 5000, rpmPct: 75 },
    inputs: { throttlePct: 50, brakePct: 0, steerPct: 0, gear: 4 },
    wheels: {
      frontLeft: { combinedSlip: 0.2, tireTempC: 80 },
      frontRight: { combinedSlip: 0.2, tireTempC: 80 },
      rearLeft: { combinedSlip: 0.2, tireTempC: 80 },
      rearRight: { combinedSlip: 0.2, tireTempC: 80 }
    }
  };
}
