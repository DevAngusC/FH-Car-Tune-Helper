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

test("rejects session ids that try to escape session root", async () => {
  const sessionRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fh6-session-store-"));
  await assert.rejects(() => loadSession(sessionRoot, "../outside"), /Invalid session id/);
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
