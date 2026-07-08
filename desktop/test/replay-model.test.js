"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createReplayModel } = require("../src/main/telemetry/replay-model");

test("creates replay frames, lap segments and route bounds", () => {
  const samples = [
    sample({ index: 0, lapNumber: 1, lapTime: 0, x: 0, y: 100, z: 0 }),
    sample({ index: 1, lapNumber: 1, lapTime: 10, x: 10, y: 108, z: 5 }),
    sample({ index: 2, lapNumber: 2, lapTime: 0.2, x: 2, y: 95, z: 1 }),
    sample({ index: 3, lapNumber: 2, lapTime: 11, x: 20, y: 112, z: 10 })
  ];

  const replay = createReplayModel(samples);

  assert.equal(replay.sourceSampleCount, 4);
  assert.equal(replay.frameCount, 4);
  assert.equal(replay.laps.length, 2);
  assert.equal(replay.laps[0].label, "Lap 1");
  assert.equal(replay.laps[0].startFrame, 0);
  assert.equal(replay.laps[0].endFrame, 1);
  assert.deepEqual(replay.bounds, { minX: 0, maxX: 20, minZ: 0, maxZ: 10 });
  assert.deepEqual(replay.elevationBounds, { minY: 95, maxY: 112, deltaM: 17 });
  assert.equal(replay.channels.position, true);
  assert.equal(replay.channels.elevation, true);
  assert.equal(replay.channels.tireSurfaceTemp, true);
  assert.equal(replay.channels.racePosition, true);
  assert.equal(replay.channels.carInfo, true);
  assert.equal(replay.channels.fuel, true);
  assert.equal(replay.channels.inputs, true);
  assert.equal(replay.channels.wheelRotation, true);
  assert.equal(replay.channels.wheelSurface, true);
  assert.equal(replay.frames[0].engine.powerHp > 100, true);
  assert.equal(replay.frames[0].racePosition, 2);
  assert.equal(replay.frames[0].inputs.normalizedDrivingLine, -1);
  assert.equal(replay.frames[0].wheels.frontLeft.onRumbleStrip, true);
});

function sample({ index, lapNumber, lapTime, x, y, z }) {
  return {
    receivedAt: new Date(Date.UTC(2026, 6, 8, 0, 0, index)).toISOString(),
    dash: {
      lapNumber,
      racePosition: 2,
      currentLapSeconds: lapTime,
      bestLapSeconds: 72,
      lastLapSeconds: 74,
      currentRaceTimeSeconds: 125,
      distanceTraveledM: index * 100,
      powerW: 120000,
      torqueNm: 360,
      boost: 1.2,
      fuel: 0.7
    },
    motion: {
      speedKph: 110,
      position: { x, y, z },
      orientation: { yaw: 0.4, pitch: 0.01, roll: 0.02 },
      accelerationG: { x: 0.5, y: 0, z: 0.2 },
      velocity: { x: 1, y: 0, z: 2 },
      angularVelocity: { x: 0, y: 0.1, z: 0 }
    },
    engine: { rpm: 6200, maxRpm: 8000, idleRpm: 900, rpmPct: 77.5 },
    car: { class: 4, performanceIndex: 900, drivetrainType: 2, numCylinders: 6 },
    inputs: {
      throttlePct: 80,
      brakePct: 0,
      clutchPct: 0,
      handbrakePct: 0,
      steerPct: 14,
      gear: 4,
      normalizedDrivingLine: -1,
      normalizedAIBrakeDifference: 0
    },
    wheels: {
      frontLeft: wheel(82),
      frontRight: wheel(83),
      rearLeft: wheel(78),
      rearRight: wheel(79)
    }
  };
}

function wheel(temp) {
  return {
    tireTempC: temp,
    slipRatio: 0.12,
    slipAngle: 2.1,
    combinedSlip: 0.34,
    rotationSpeed: 22,
    onRumbleStrip: true,
    puddleDepth: 0.1,
    surfaceRumble: 0.2,
    suspensionTravelNormalized: 0.45,
    suspensionTravelMeters: 0.04
  };
}
