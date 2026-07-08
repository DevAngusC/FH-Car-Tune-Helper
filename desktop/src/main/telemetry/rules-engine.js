"use strict";

const WHEEL_GROUPS = {
  front: ["frontLeft", "frontRight"],
  rear: ["rearLeft", "rearRight"],
  all: ["frontLeft", "frontRight", "rearLeft", "rearRight"]
};
const { createReplayModel } = require("./replay-model");

function createTelemetrySummary(samples, metadata = {}) {
  const validSamples = Array.isArray(samples) ? samples.filter(Boolean) : [];
  const startedAt = metadata.startedAt ?? validSamples[0]?.receivedAt ?? null;
  const endedAt = metadata.endedAt ?? validSamples.at(-1)?.receivedAt ?? null;
  const durationMs = durationBetween(startedAt, endedAt);

  const speedStats = stats(validSamples.map((sample) => sample.motion?.speedKph));
  const rpmStats = stats(validSamples.map((sample) => sample.engine?.rpm));
  const throttleStats = stats(validSamples.map((sample) => sample.inputs?.throttlePct));
  const brakeStats = stats(validSamples.map((sample) => sample.inputs?.brakePct));
  const steerStats = stats(validSamples.map((sample) => Math.abs(sample.inputs?.steerPct ?? 0)));
  const frontTempStats = wheelStats(validSamples, WHEEL_GROUPS.front, "tireTempC");
  const rearTempStats = wheelStats(validSamples, WHEEL_GROUPS.rear, "tireTempC");

  const counters = {
    understeer: 0,
    powerOversteer: 0,
    brakeLockup: 0,
    redline: 0,
    lowRpmExit: 0
  };

  for (const sample of validSamples) {
    const speedKph = sample.motion?.speedKph ?? 0;
    const throttle = sample.inputs?.throttlePct ?? 0;
    const brake = sample.inputs?.brakePct ?? 0;
    const steer = Math.abs(sample.inputs?.steerPct ?? 0);
    const rpmPct = sample.engine?.rpmPct ?? null;
    const frontSlip = averageWheelValue(sample, WHEEL_GROUPS.front, "combinedSlip");
    const rearSlip = averageWheelValue(sample, WHEEL_GROUPS.rear, "combinedSlip");
    const maxSlip = maxWheelValue(sample, WHEEL_GROUPS.all, "combinedSlip");

    if (speedKph > 35 && steer > 35 && frontSlip !== null && rearSlip !== null && frontSlip > rearSlip + 0.15) {
      counters.understeer += 1;
    }

    if (speedKph > 35 && throttle > 65 && rearSlip !== null && frontSlip !== null && rearSlip > frontSlip + 0.2) {
      counters.powerOversteer += 1;
    }

    if (speedKph > 45 && brake > 70 && maxSlip !== null && maxSlip > 1.15) {
      counters.brakeLockup += 1;
    }

    if (throttle > 70 && rpmPct !== null && rpmPct > 97) {
      counters.redline += 1;
    }

    if (speedKph > 30 && throttle > 70 && rpmPct !== null && rpmPct < 45) {
      counters.lowRpmExit += 1;
    }
  }

  const findings = [];
  addRatioFinding(findings, counters.understeer, validSamples.length, {
    code: "understeer-mid-corner",
    title: "彎中推頭傾向",
    detail: "大角度轉向時，前輪綜合滑移反覆高於後輪。",
    suggestedArea: "前輪抓地、空力平衡、前彈簧 / 防傾桿、差速減速"
  });
  addRatioFinding(findings, counters.powerOversteer, validSamples.length, {
    code: "power-oversteer-exit",
    title: "補油甩尾傾向",
    detail: "高油門區段中，後輪綜合滑移反覆高於前輪。",
    suggestedArea: "後輪抓地、差速加速、後彈簧 / 防傾桿、油門控制"
  });
  addRatioFinding(findings, counters.brakeLockup, validSamples.length, {
    code: "brake-lockup",
    title: "煞車鎖死或重煞不穩",
    detail: "高煞車輸入時，輪胎綜合滑移也同步偏高。",
    suggestedArea: "煞車壓力、煞車平衡、前輪負載"
  });
  addRatioFinding(findings, counters.redline, validSamples.length, {
    code: "gear-too-short",
    title: "高油門頻繁撞紅線",
    detail: "高油門時，引擎轉速反覆停留在接近紅線的位置。",
    suggestedArea: "終傳比、高檔齒比延伸"
  });
  addRatioFinding(findings, counters.lowRpmExit, validSamples.length, {
    code: "gear-too-long",
    title: "補油時轉速偏低",
    detail: "高油門區段中，引擎轉速反覆掉到動力帶以下。",
    suggestedArea: "終傳比、低檔齒比間距"
  });

  const frontRearTempDelta = nullableDelta(frontTempStats.average, rearTempStats.average);
  if (frontRearTempDelta !== null && Math.abs(frontRearTempDelta) > 12) {
    findings.push({
      code: frontRearTempDelta > 0 ? "front-tires-hotter" : "rear-tires-hotter",
      severity: "info",
      title: frontRearTempDelta > 0 ? "前胎溫度偏高" : "後胎溫度偏高",
      detail: "前後平均胎溫差距超過 12C。",
      suggestedArea: "胎壓、定位角、空力與抗側傾平衡",
      sampleRatio: null
    });
  }

  return {
    schema: "fh6-tune-helper.telemetry.summary.v1",
    createdAt: new Date().toISOString(),
    metadata,
    sampleCount: validSamples.length,
    startedAt,
    endedAt,
    durationMs,
    stats: {
      speedKph: speedStats,
      rpm: rpmStats,
      throttlePct: throttleStats,
      brakePct: brakeStats,
      absoluteSteerPct: steerStats,
      frontTireTempC: frontTempStats,
      rearTireTempC: rearTempStats
    },
    counters,
    findings,
    replay: createReplayModel(validSamples)
  };
}

function addRatioFinding(findings, count, total, details) {
  const ratio = total > 0 ? count / total : 0;
  if (count === 0 || ratio < 0.02) {
    return;
  }

  findings.push({
    ...details,
    severity: ratio >= 0.12 ? "warn" : "info",
    sampleRatio: Number(ratio.toFixed(4)),
    sampleCount: count
  });
}

function stats(values) {
  const filtered = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) {
    return { min: null, max: null, average: null };
  }
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    average: total / filtered.length
  };
}

function wheelStats(samples, wheelKeys, field) {
  return stats(
    samples.flatMap((sample) =>
      wheelKeys.map((key) => sample.wheels?.[key]?.[field]).filter((value) => typeof value === "number")
    )
  );
}

function averageWheelValue(sample, wheelKeys, field) {
  const values = wheelKeys
    .map((key) => sample.wheels?.[key]?.[field])
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxWheelValue(sample, wheelKeys, field) {
  const values = wheelKeys
    .map((key) => sample.wheels?.[key]?.[field])
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  return values.length === 0 ? null : Math.max(...values);
}

function nullableDelta(left, right) {
  return typeof left === "number" && typeof right === "number" ? left - right : null;
}

function durationBetween(startedAt, endedAt) {
  if (!startedAt || !endedAt) {
    return null;
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return Math.max(0, end - start);
}

module.exports = {
  averageWheelValue,
  createTelemetrySummary,
  stats
};
