"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createTelemetrySummary } = require("../telemetry/rules-engine");

function resolveSessionRoot(app) {
  if (process.env.FH6_TELEMETRY_SESSION_DIR) {
    return process.env.FH6_TELEMETRY_SESSION_DIR;
  }

  const basePath = app?.getPath ? app.getPath("userData") : process.cwd();
  return path.join(basePath, "sessions");
}

async function listSessions(sessionRoot) {
  await fsp.mkdir(sessionRoot, { recursive: true });
  const entries = await fsp.readdir(sessionRoot, { withFileTypes: true });
  const sessions = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory = path.join(sessionRoot, entry.name);
    const sessionFile = path.join(directory, "session.json");
    try {
      const session = JSON.parse(await fsp.readFile(sessionFile, "utf8"));
      const samplesFile = path.join(directory, session.files?.samples ?? "samples.ndjson");
      const summaryFile = path.join(directory, session.files?.summary ?? "summary.json");
      const sampleCount = await resolveSampleCount(session, samplesFile, summaryFile);
      sessions.push({
        id: session.id ?? entry.name,
        directory,
        startedAt: session.startedAt ?? null,
        endedAt: session.endedAt ?? null,
        sampleCount,
        metadata: session.metadata ?? {},
        files: {
          session: sessionFile,
          samples: samplesFile,
          summary: summaryFile
        },
        hasSummary: await fileExists(summaryFile)
      });
    } catch {
      continue;
    }
  }

  return sessions.sort((left, right) => {
    const leftTime = Date.parse(left.startedAt ?? "");
    const rightTime = Date.parse(right.startedAt ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

async function loadSession(sessionRoot, sessionId) {
  const directory = resolveSessionDirectory(sessionRoot, sessionId);
  const sessionFile = path.join(directory, "session.json");
  const session = JSON.parse(await fsp.readFile(sessionFile, "utf8"));
  const samplesFile = path.join(directory, session.files?.samples ?? "samples.ndjson");
  const summaryFile = path.join(directory, session.files?.summary ?? "summary.json");
  let summary = null;

  if (await fileExists(summaryFile)) {
    summary = JSON.parse(await fsp.readFile(summaryFile, "utf8"));
  }

  if (!summary?.replay && (await fileExists(samplesFile))) {
    summary = createTelemetrySummary(await readNdjson(samplesFile), session.metadata ?? {});
  }

  let sampleCount = Math.max(session.sampleCount ?? 0, summary?.sampleCount ?? 0);
  if (sampleCount === 0 && (await fileExists(samplesFile))) {
    sampleCount = await countNdjsonLines(samplesFile);
  }

  return {
    id: session.id ?? sessionId,
    directory,
    startedAt: session.startedAt ?? null,
    endedAt: session.endedAt ?? null,
    sampleCount,
    metadata: session.metadata ?? {},
    files: {
      session: sessionFile,
      samples: samplesFile,
      summary: summaryFile
    },
    summary
  };
}

async function updateSessionName(sessionRoot, sessionId, name) {
  const directory = resolveSessionDirectory(sessionRoot, sessionId);
  const sessionFile = path.join(directory, "session.json");
  const session = JSON.parse(await fsp.readFile(sessionFile, "utf8"));
  const displayName = normalizeDisplayName(name) || session.metadata?.defaultName || session.metadata?.name || session.id || sessionId;
  session.metadata = {
    ...(session.metadata ?? {}),
    name: displayName
  };

  await writeJson(sessionFile, session);

  const summaryFile = path.join(directory, session.files?.summary ?? "summary.json");
  if (await fileExists(summaryFile)) {
    const summary = JSON.parse(await fsp.readFile(summaryFile, "utf8"));
    summary.metadata = {
      ...(summary.metadata ?? {}),
      ...session.metadata
    };
    await writeJson(summaryFile, summary);
  }

  return loadSession(sessionRoot, sessionId);
}

function resolveSessionDirectory(sessionRoot, sessionId) {
  if (!sessionId || sessionId.includes("/") || sessionId.includes("\\") || sessionId.includes("..")) {
    throw new Error("賽事 ID 無效。");
  }

  const root = path.resolve(sessionRoot);
  const directory = path.resolve(root, sessionId);
  if (!directory.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
    throw new Error("賽事路徑超出資料夾範圍。");
  }

  return directory;
}

function normalizeDisplayName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

async function readNdjson(filePath) {
  const text = await fsp.readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function resolveSampleCount(session, samplesFile, summaryFile) {
  if (typeof session.sampleCount === "number" && session.sampleCount > 0) {
    return session.sampleCount;
  }

  if (await fileExists(summaryFile)) {
    try {
      const summary = JSON.parse(await fsp.readFile(summaryFile, "utf8"));
      if (typeof summary.sampleCount === "number" && summary.sampleCount > 0) {
        return summary.sampleCount;
      }
    } catch {
      return session.sampleCount ?? 0;
    }
  }

  if (await fileExists(samplesFile)) {
    return countNdjsonLines(samplesFile);
  }

  return session.sampleCount ?? 0;
}

function countNdjsonLines(filePath) {
  return new Promise((resolve, reject) => {
    let lines = 0;
    let hasBytes = false;
    let lastByte = null;
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => {
      hasBytes = true;
      lastByte = chunk[chunk.length - 1];
      for (const byte of chunk) {
        if (byte === 10) {
          lines += 1;
        }
      }
    });
    stream.once("error", reject);
    stream.once("end", () => resolve(lines + (hasBytes && lastByte !== 10 ? 1 : 0)));
  });
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  listSessions,
  loadSession,
  resolveSessionRoot,
  updateSessionName
};
