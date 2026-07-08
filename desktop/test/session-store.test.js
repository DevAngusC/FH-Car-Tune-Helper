"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { listSessions, loadSession, updateSessionName } = require("../src/main/storage/session-store");

test("lists and loads recorded session summaries", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-session-store-"));
  const sessionId = "2026-07-08_00-00-00-test-car";
  const directory = path.join(sessionRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });

  await fs.writeFile(
    path.join(directory, "session.json"),
    JSON.stringify({
      id: sessionId,
      startedAt: "2026-07-08T00:00:00.000Z",
      endedAt: "2026-07-08T00:01:00.000Z",
      sampleCount: 2,
      metadata: { name: "Test Car" },
      files: {
        samples: "samples.ndjson",
        summary: "summary.json"
      }
    }),
    "utf8"
  );

  await fs.writeFile(
    path.join(directory, "summary.json"),
    JSON.stringify({
      schema: "fh6-tune-helper.telemetry.summary.v1",
      sampleCount: 2,
      findings: [],
      replay: { frameCount: 2, frames: [{ sourceIndex: 0 }, { sourceIndex: 1 }] }
    }),
    "utf8"
  );

  const sessions = await listSessions(sessionRoot);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, sessionId);
  assert.equal(sessions[0].hasSummary, true);

  const loaded = await loadSession(sessionRoot, sessionId);
  assert.equal(loaded.id, sessionId);
  assert.equal(loaded.summary.replay.frameCount, 2);
});

test("recovers sample count from raw session files", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-session-store-"));
  const sessionId = "20260708_211715-auto";
  const directory = path.join(sessionRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });

  await fs.writeFile(
    path.join(directory, "session.json"),
    JSON.stringify({
      id: sessionId,
      startedAt: "2026-07-08T13:17:15.669Z",
      endedAt: null,
      sampleCount: 0,
      metadata: { name: "20260708 21:17" },
      files: {
        samples: "samples.ndjson",
        summary: "summary.json"
      }
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(directory, "samples.ndjson"),
    `${JSON.stringify(rawSample(80))}\n${JSON.stringify(rawSample(92))}\n`,
    "utf8"
  );

  const sessions = await listSessions(sessionRoot);
  assert.equal(sessions[0].sampleCount, 2);
  assert.equal(sessions[0].hasSummary, false);

  const loaded = await loadSession(sessionRoot, sessionId);
  assert.equal(loaded.sampleCount, 2);
  assert.equal(loaded.summary.sampleCount, 2);
});

test("rejects session ids that try to escape session root", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-session-store-"));
  await assert.rejects(() => loadSession(sessionRoot, "../outside"), /賽事 ID 無效/);
});

test("updates a recorded session display name", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-session-store-"));
  const sessionId = "20260708_193400-auto";
  const directory = path.join(sessionRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });

  await fs.writeFile(
    path.join(directory, "session.json"),
    JSON.stringify({
      id: sessionId,
      startedAt: "2026-07-08T11:34:00.000Z",
      endedAt: "2026-07-08T11:40:00.000Z",
      sampleCount: 0,
      metadata: { name: "20260708 19:34", defaultName: "20260708 19:34" },
      files: {
        samples: "samples.ndjson",
        summary: "summary.json"
      }
    }),
    "utf8"
  );

  await fs.writeFile(
    path.join(directory, "summary.json"),
    JSON.stringify({
      schema: "fh6-tune-helper.telemetry.summary.v1",
      metadata: { name: "20260708 19:34", defaultName: "20260708 19:34" },
      sampleCount: 0,
      findings: []
    }),
    "utf8"
  );

  const loaded = await updateSessionName(sessionRoot, sessionId, "  Rally test   rear diff  ");
  assert.equal(loaded.metadata.name, "Rally test rear diff");
  assert.equal(loaded.summary.metadata.name, "Rally test rear diff");

  const sessionJson = JSON.parse(await fs.readFile(path.join(directory, "session.json"), "utf8"));
  assert.equal(sessionJson.metadata.name, "Rally test rear diff");
});

function rawSample(speedKph) {
  return {
    receivedAt: "2026-07-08T13:17:15.669Z",
    motion: { speedKph },
    engine: { rpm: 5000, rpmPct: 75 },
    inputs: { throttlePct: 50, brakePct: 0, steerPct: 0, gear: 4 },
    wheels: {}
  };
}
