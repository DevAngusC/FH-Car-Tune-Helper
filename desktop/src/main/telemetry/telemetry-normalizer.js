"use strict";

const G = 9.80665;

function clamp(value, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, value));
}

function percentFromByte(value) {
  if (typeof value !== "number") {
    return null;
  }
  return clamp((value / 255) * 100, 0, 100);
}

function steerPercent(value) {
  if (typeof value !== "number") {
    return null;
  }
  return clamp((value / 127) * 100, -100, 100);
}

function rpmPercent(engine) {
  if (!engine || !engine.maxRpm || engine.maxRpm <= 0) {
    return null;
  }
  return clamp((engine.rpm / engine.maxRpm) * 100, 0, 150);
}

function normalizeWheel(wheel) {
  return {
    suspensionTravelNormalized: numberOrNull(wheel.suspensionTravelNormalized),
    suspensionTravelMeters: numberOrNull(wheel.suspensionTravelMeters),
    slipRatio: numberOrNull(wheel.slipRatio),
    slipAngle: numberOrNull(wheel.slipAngle),
    combinedSlip: numberOrNull(wheel.combinedSlip),
    rotationSpeed: numberOrNull(wheel.rotationSpeed),
    tireTempC: numberOrNull(wheel.tireTempC),
    onRumbleStrip: wheel.onRumbleStrip === 1,
    puddleDepth: numberOrNull(wheel.puddleDepth),
    surfaceRumble: numberOrNull(wheel.surfaceRumble)
  };
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function vectorOrNull(vector) {
  if (!vector) {
    return null;
  }
  return {
    x: numberOrNull(vector.x),
    y: numberOrNull(vector.y),
    z: numberOrNull(vector.z)
  };
}

function normalizeForzaTelemetry(raw) {
  const speedMps = numberOrNull(raw.dash?.speedMps);
  const acceleration = vectorOrNull(raw.acceleration);

  return {
    schema: "fh6-tune-helper.telemetry.sample.v1",
    gameId: raw.gameId ?? "fh6",
    packetFormat: raw.packetFormat,
    packetLayout: raw.packetLayout ?? raw.packetFormat,
    packetLength: raw.packetLength,
    receivedAt: raw.receivedAt,
    source: raw.source ?? null,
    timestampMs: numberOrNull(raw.timestampMs),
    isRaceOn: Boolean(raw.isRaceOn),
    car: raw.car ?? null,
    engine: {
      rpm: numberOrNull(raw.engine?.rpm),
      maxRpm: numberOrNull(raw.engine?.maxRpm),
      idleRpm: numberOrNull(raw.engine?.idleRpm),
      rpmPct: rpmPercent(raw.engine)
    },
    motion: {
      speedMps,
      speedKph: speedMps === null ? null : speedMps * 3.6,
      acceleration,
      accelerationG: acceleration
        ? {
            x: acceleration.x === null ? null : acceleration.x / G,
            y: acceleration.y === null ? null : acceleration.y / G,
            z: acceleration.z === null ? null : acceleration.z / G
          }
        : null,
      velocity: vectorOrNull(raw.velocity),
      angularVelocity: vectorOrNull(raw.angularVelocity),
      orientation: raw.orientation ?? null,
      position: raw.position ?? null
    },
    inputs: raw.inputs
      ? {
          throttlePct: percentFromByte(raw.inputs.throttleRaw),
          brakePct: percentFromByte(raw.inputs.brakeRaw),
          clutchPct: percentFromByte(raw.inputs.clutchRaw),
          handbrakePct: percentFromByte(raw.inputs.handbrakeRaw),
          gear: raw.inputs.gear,
          steerPct: steerPercent(raw.inputs.steerRaw),
          normalizedDrivingLine: raw.inputs.normalizedDrivingLine,
          normalizedAIBrakeDifference: raw.inputs.normalizedAIBrakeDifference
        }
      : null,
    dash: raw.dash
      ? {
          powerW: numberOrNull(raw.dash.powerW),
          torqueNm: numberOrNull(raw.dash.torqueNm),
          boost: numberOrNull(raw.dash.boost),
          fuel: numberOrNull(raw.dash.fuel),
          distanceTraveledM: numberOrNull(raw.dash.distanceTraveledM),
          bestLapSeconds: numberOrNull(raw.dash.bestLapSeconds),
          lastLapSeconds: numberOrNull(raw.dash.lastLapSeconds),
          currentLapSeconds: numberOrNull(raw.dash.currentLapSeconds),
          currentRaceTimeSeconds: numberOrNull(raw.dash.currentRaceTimeSeconds),
          lapNumber: raw.dash.lapNumber,
          racePosition: raw.dash.racePosition
        }
      : null,
    wheels: Object.fromEntries(
      Object.entries(raw.wheels ?? {}).map(([key, wheel]) => [key, normalizeWheel(wheel)])
    )
  };
}

module.exports = {
  clamp,
  normalizeForzaTelemetry,
  numberOrNull,
  percentFromByte,
  steerPercent
};
