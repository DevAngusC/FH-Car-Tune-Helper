"use strict";

const WHEEL_ORDER = ["frontLeft", "frontRight", "rearLeft", "rearRight"];
const WHEEL_LABELS = {
  frontLeft: "FL",
  frontRight: "FR",
  rearLeft: "RL",
  rearRight: "RR"
};

function createReplayModel(samples, options = {}) {
  const maxFrames = options.maxFrames ?? 7200;
  const sourceSamples = Array.isArray(samples) ? samples.filter(Boolean) : [];
  const stride = sourceSamples.length > maxFrames ? Math.ceil(sourceSamples.length / maxFrames) : 1;
  const baseTime = firstTime(sourceSamples);
  const frames = [];

  for (let index = 0; index < sourceSamples.length; index += stride) {
    frames.push(sampleToFrame(sourceSamples[index], index, baseTime));
  }

  const finalIndex = sourceSamples.length - 1;
  if (finalIndex >= 0 && frames.at(-1)?.sourceIndex !== finalIndex) {
    frames.push(sampleToFrame(sourceSamples[finalIndex], finalIndex, baseTime));
  }

  const routeFrames = frames.filter((frame) => hasPosition(frame.position));
  const elevationFrames = frames.filter((frame) => hasElevation(frame.position));
  const laps = createLapSegments(frames);

  return {
    schema: "fh6-tune-helper.telemetry.replay.v1",
    sourceSampleCount: sourceSamples.length,
    frameCount: frames.length,
    stride,
    durationMs: frames.length ? frames.at(-1).elapsedMs : 0,
    channels: detectChannels(sourceSamples),
    bounds: routeBounds(routeFrames),
    elevationBounds: elevationBounds(elevationFrames),
    laps,
    frames
  };
}

function sampleToFrame(sample, sourceIndex, baseTime) {
  const receivedTime = Date.parse(sample.receivedAt ?? "");
  const elapsedMs = Number.isFinite(receivedTime) && baseTime !== null ? Math.max(0, receivedTime - baseTime) : null;
  const wheels = {};

  for (const wheelKey of WHEEL_ORDER) {
    const wheel = sample.wheels?.[wheelKey] ?? {};
    wheels[wheelKey] = {
      label: WHEEL_LABELS[wheelKey],
      tireTempC: numberOrNull(wheel.tireTempC),
      slipRatio: numberOrNull(wheel.slipRatio),
      slipAngle: numberOrNull(wheel.slipAngle),
      combinedSlip: numberOrNull(wheel.combinedSlip),
      rotationSpeed: numberOrNull(wheel.rotationSpeed),
      suspensionTravelNormalized: numberOrNull(wheel.suspensionTravelNormalized),
      suspensionTravelMeters: numberOrNull(wheel.suspensionTravelMeters),
      onRumbleStrip: Boolean(wheel.onRumbleStrip),
      puddleDepth: numberOrNull(wheel.puddleDepth),
      surfaceRumble: numberOrNull(wheel.surfaceRumble)
    };
  }

  return {
    sourceIndex,
    receivedAt: sample.receivedAt ?? null,
    elapsedMs,
    car: sample.car ?? null,
    lapNumber: numberOrNull(sample.dash?.lapNumber),
    racePosition: numberOrNull(sample.dash?.racePosition),
    lapTimeSeconds: numberOrNull(sample.dash?.currentLapSeconds),
    bestLapSeconds: numberOrNull(sample.dash?.bestLapSeconds),
    lastLapSeconds: numberOrNull(sample.dash?.lastLapSeconds),
    raceTimeSeconds: numberOrNull(sample.dash?.currentRaceTimeSeconds),
    distanceM: numberOrNull(sample.dash?.distanceTraveledM),
    position: {
      x: numberOrNull(sample.motion?.position?.x),
      y: numberOrNull(sample.motion?.position?.y),
      z: numberOrNull(sample.motion?.position?.z)
    },
    orientation: {
      yaw: numberOrNull(sample.motion?.orientation?.yaw),
      pitch: numberOrNull(sample.motion?.orientation?.pitch),
      roll: numberOrNull(sample.motion?.orientation?.roll)
    },
    motion: {
      speedKph: numberOrNull(sample.motion?.speedKph),
      accelerationG: sample.motion?.accelerationG ?? null,
      velocity: sample.motion?.velocity ?? null,
      angularVelocity: sample.motion?.angularVelocity ?? null
    },
    engine: {
      rpm: numberOrNull(sample.engine?.rpm),
      maxRpm: numberOrNull(sample.engine?.maxRpm),
      idleRpm: numberOrNull(sample.engine?.idleRpm),
      rpmPct: numberOrNull(sample.engine?.rpmPct),
      powerKw: wattsToKw(sample.dash?.powerW),
      powerHp: wattsToHp(sample.dash?.powerW),
      torqueNm: numberOrNull(sample.dash?.torqueNm),
      boost: numberOrNull(sample.dash?.boost),
      fuel: numberOrNull(sample.dash?.fuel)
    },
    inputs: {
      throttlePct: numberOrNull(sample.inputs?.throttlePct),
      brakePct: numberOrNull(sample.inputs?.brakePct),
      clutchPct: numberOrNull(sample.inputs?.clutchPct),
      handbrakePct: numberOrNull(sample.inputs?.handbrakePct),
      steerPct: numberOrNull(sample.inputs?.steerPct),
      gear: sample.inputs?.gear ?? null,
      normalizedDrivingLine: numberOrNull(sample.inputs?.normalizedDrivingLine),
      normalizedAIBrakeDifference: numberOrNull(sample.inputs?.normalizedAIBrakeDifference)
    },
    wheels
  };
}

function createLapSegments(frames) {
  if (frames.length === 0) {
    return [];
  }

  const laps = [];
  let current = null;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const lapKey = lapIdentity(frame, index, current);

    if (!current || current.key !== lapKey) {
      if (current) {
        closeLap(current, frames[index - 1], index - 1);
        laps.push(current);
      }
      current = {
        key: lapKey,
        label: lapLabel(lapKey, laps.length),
        lapNumber: numericLap(lapKey),
        startFrame: index,
        endFrame: index,
        startElapsedMs: frame.elapsedMs,
        endElapsedMs: frame.elapsedMs,
        durationSeconds: null,
        distanceM: null
      };
    }
  }

  if (current) {
    closeLap(current, frames.at(-1), frames.length - 1);
    laps.push(current);
  }

  return laps.map(({ key, lastLapTimeSeconds, ...lap }) => lap);
}

function lapIdentity(frame, index, current) {
  const lapNumber = frame.lapNumber;
  if (typeof lapNumber === "number" && lapNumber > 0) {
    return String(lapNumber);
  }

  if (
    current &&
    frame.lapTimeSeconds !== null &&
    current.lastLapTimeSeconds !== null &&
    frame.lapTimeSeconds + 2 < current.lastLapTimeSeconds
  ) {
    return `detected-${index}`;
  }

  if (current) {
    current.lastLapTimeSeconds = frame.lapTimeSeconds;
  }

  return "session";
}

function lapLabel(lapKey, previousLapCount) {
  if (lapKey === "session") {
    return "Session";
  }
  if (lapKey.startsWith("detected-")) {
    return `Lap ${previousLapCount + 1}`;
  }
  return `Lap ${lapKey}`;
}

function numericLap(lapKey) {
  const lapNumber = Number(lapKey);
  return Number.isFinite(lapNumber) ? lapNumber : null;
}

function closeLap(lap, frame, frameIndex) {
  lap.endFrame = frameIndex;
  lap.endElapsedMs = frame?.elapsedMs ?? lap.startElapsedMs;
  lap.durationSeconds = durationSeconds(lap.startElapsedMs, lap.endElapsedMs);
  lap.distanceM = frame?.distanceM ?? null;
}

function detectChannels(samples) {
  return {
    position: samples.some((sample) => hasPosition(sample.motion?.position)),
    elevation: samples.some((sample) => hasElevation(sample.motion?.position)),
    lapTiming: samples.some((sample) => typeof sample.dash?.currentLapSeconds === "number"),
    racePosition: samples.some((sample) => typeof sample.dash?.racePosition === "number"),
    carInfo: samples.some((sample) => typeof sample.car?.performanceIndex === "number"),
    power: samples.some((sample) => typeof sample.dash?.powerW === "number"),
    torque: samples.some((sample) => typeof sample.dash?.torqueNm === "number"),
    boost: samples.some((sample) => typeof sample.dash?.boost === "number"),
    fuel: samples.some((sample) => typeof sample.dash?.fuel === "number"),
    inputs: samples.some((sample) => typeof sample.inputs?.throttlePct === "number"),
    tireSurfaceTemp: samples.some((sample) =>
      Object.values(sample.wheels ?? {}).some((wheel) => typeof wheel.tireTempC === "number")
    ),
    wheelRotation: samples.some((sample) =>
      Object.values(sample.wheels ?? {}).some((wheel) => typeof wheel.rotationSpeed === "number")
    ),
    wheelSurface: samples.some((sample) =>
      Object.values(sample.wheels ?? {}).some(
        (wheel) =>
          typeof wheel.onRumbleStrip === "boolean" ||
          typeof wheel.puddleDepth === "number" ||
          typeof wheel.surfaceRumble === "number"
      )
    ),
    suspensionTravel: samples.some((sample) =>
      Object.values(sample.wheels ?? {}).some((wheel) => typeof wheel.suspensionTravelMeters === "number")
    ),
    wheelSlip: samples.some((sample) =>
      Object.values(sample.wheels ?? {}).some((wheel) => typeof wheel.combinedSlip === "number")
    )
  };
}

function elevationBounds(frames) {
  if (frames.length === 0) {
    return null;
  }

  const heights = frames.map((frame) => frame.position.y);
  const minY = Math.min(...heights);
  const maxY = Math.max(...heights);
  return {
    minY,
    maxY,
    deltaM: maxY - minY
  };
}

function routeBounds(frames) {
  if (frames.length === 0) {
    return null;
  }

  const xs = frames.map((frame) => frame.position.x);
  const zs = frames.map((frame) => frame.position.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
}

function hasPosition(position) {
  return (
    position &&
    typeof position.x === "number" &&
    Number.isFinite(position.x) &&
    typeof position.z === "number" &&
    Number.isFinite(position.z)
  );
}

function hasElevation(position) {
  return position && typeof position.y === "number" && Number.isFinite(position.y);
}

function firstTime(samples) {
  for (const sample of samples) {
    const time = Date.parse(sample.receivedAt ?? "");
    if (Number.isFinite(time)) {
      return time;
    }
  }
  return null;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function wattsToKw(value) {
  return typeof value === "number" && Number.isFinite(value) ? value / 1000 : null;
}

function wattsToHp(value) {
  return typeof value === "number" && Number.isFinite(value) ? value / 745.699872 : null;
}

function durationSeconds(startMs, endMs) {
  if (typeof startMs !== "number" || typeof endMs !== "number") {
    return null;
  }
  return Math.max(0, (endMs - startMs) / 1000);
}

module.exports = {
  createReplayModel,
  sampleToFrame
};
