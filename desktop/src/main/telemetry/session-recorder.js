"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createTelemetrySummary } = require("./rules-engine");

class SessionRecorder {
  constructor({ sessionRoot }) {
    this.sessionRoot = sessionRoot;
    this.activeSession = null;
  }

  get isRecording() {
    return Boolean(this.activeSession);
  }

  getCurrentSession() {
    return this.activeSession ? publicSession(this.activeSession) : null;
  }

  async start(metadata = {}) {
    if (this.activeSession) {
      throw new Error("A telemetry session is already recording.");
    }

    const started = new Date();
    const startedAt = started.toISOString();
    const defaultName = formatLocalSessionName(started);
    const explicitName = normalizeDisplayName(metadata.name || metadata.carName);
    const sessionName = explicitName || defaultName;
    const safeName = explicitName ? sanitizeName(explicitName) : "auto";
    const directoryName = `${timestampForPath(started)}-${safeName}`;
    const directory = path.join(this.sessionRoot, directoryName);

    await fsp.mkdir(directory, { recursive: true });

    const session = {
      id: directoryName,
      directory,
      startedAt,
      endedAt: null,
      metadata: {
        ...metadata,
        name: sessionName,
        defaultName,
        startedAt
      },
      sampleCount: 0,
      samples: [],
      samplesFile: path.join(directory, "samples.ndjson"),
      summaryFile: path.join(directory, "summary.json"),
      sessionFile: path.join(directory, "session.json"),
      stream: fs.createWriteStream(path.join(directory, "samples.ndjson"), { flags: "a" })
    };

    this.activeSession = session;
    await writeJson(session.sessionFile, {
      schema: "fh6-tune-helper.telemetry.session.v1",
      id: session.id,
      startedAt,
      endedAt: null,
      metadata: session.metadata,
      sampleCount: 0
    });

    return publicSession(session);
  }

  record(sample) {
    if (!this.activeSession || !sample) {
      return;
    }

    this.activeSession.sampleCount += 1;
    this.activeSession.samples.push(sample);
    this.activeSession.stream.write(`${JSON.stringify(sample)}\n`);
  }

  async stop() {
    if (!this.activeSession) {
      return null;
    }

    const session = this.activeSession;
    this.activeSession = null;
    session.endedAt = new Date().toISOString();
    session.metadata.endedAt = session.endedAt;

    await closeStream(session.stream);

    const summary = createTelemetrySummary(session.samples, session.metadata);

    await writeJson(session.summaryFile, summary);
    await writeJson(session.sessionFile, {
      schema: "fh6-tune-helper.telemetry.session.v1",
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      metadata: session.metadata,
      sampleCount: session.sampleCount,
      files: {
        samples: path.basename(session.samplesFile),
        summary: path.basename(session.summaryFile)
      }
    });

    return {
      ...publicSession(session),
      summary
    };
  }
}

function publicSession(session) {
  return {
    id: session.id,
    directory: session.directory,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    sampleCount: session.sampleCount,
    files: {
      samples: session.samplesFile,
      summary: session.summaryFile,
      session: session.sessionFile
    },
    metadata: session.metadata
  };
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

function sanitizeName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "fh6-session";
}

function normalizeDisplayName(value) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized.slice(0, 80);
}

function timestampForPath(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function formatLocalSessionName(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${year}${month}${day} ${hours}:${minutes}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

module.exports = {
  formatLocalSessionName,
  normalizeDisplayName,
  SessionRecorder,
  sanitizeName,
  timestampForPath
};
