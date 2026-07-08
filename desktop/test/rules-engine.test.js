"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createTelemetrySummary } = require("../src/main/telemetry/rules-engine");

test("creates rule findings for repeated understeer and gearing patterns", () => {
  const samples = [];

  for (let index = 0; index < 100; index += 1) {
    samples.push(
      sample({
        speedKph: 95,
        throttlePct: index < 20 ? 50 : 80,
        brakePct: index > 85 ? 80 : 0,
        steerPct: index < 20 ? 55 : 8,
        rpmPct: index > 60 ? 99 : 72,
        frontSlip: index < 20 ? 0.65 : 0.25,
        rearSlip: index < 20 ? 0.25 : 0.35,
        maxSlip: index > 85 ? 1.4 : 0.45
      })
    );
  }

  const summary = createTelemetrySummary(samples, {
    startedAt: "2026-07-08T00:00:00.000Z",
    endedAt: "2026-07-08T00:01:00.000Z"
  });

  assert.equal(summary.sampleCount, 100);
  assert.equal(summary.durationMs, 60000);
  assert.ok(summary.findings.some((finding) => finding.code === "understeer-mid-corner"));
  assert.ok(summary.findings.some((finding) => finding.code === "gear-too-short"));
  assert.ok(summary.findings.some((finding) => finding.code === "brake-lockup"));
  assert.equal(summary.replay.sourceSampleCount, 100);
  assert.equal(summary.replay.channels.wheelSlip, true);
});

function sample(values) {
  return {
    receivedAt: "2026-07-08T00:00:00.000Z",
    motion: { speedKph: values.speedKph },
    engine: { rpm: 6000, rpmPct: values.rpmPct },
    inputs: {
      throttlePct: values.throttlePct,
      brakePct: values.brakePct,
      steerPct: values.steerPct,
      gear: 3
    },
    wheels: {
      frontLeft: { combinedSlip: values.frontSlip, tireTempC: 82 },
      frontRight: { combinedSlip: values.frontSlip, tireTempC: 82 },
      rearLeft: { combinedSlip: values.rearSlip, tireTempC: 76 },
      rearRight: { combinedSlip: values.maxSlip ?? values.rearSlip, tireTempC: 76 }
    }
  };
}
