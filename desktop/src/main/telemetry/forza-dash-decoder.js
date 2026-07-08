"use strict";

const SLED_PACKET_LENGTH = 232;
const DASH_MIN_PACKET_LENGTH = 311;

const WHEEL_KEYS = ["frontLeft", "frontRight", "rearLeft", "rearRight"];

class UnsupportedForzaPacketError extends Error {
  constructor(length) {
    super(`Unsupported Forza telemetry packet length: ${length}`);
    this.name = "UnsupportedForzaPacketError";
    this.length = length;
  }
}

function assertReadable(buffer, offset, bytes) {
  if (offset + bytes > buffer.length) {
    throw new UnsupportedForzaPacketError(buffer.length);
  }
}

function readInt32(buffer, offset) {
  assertReadable(buffer, offset, 4);
  return buffer.readInt32LE(offset);
}

function readUInt32(buffer, offset) {
  assertReadable(buffer, offset, 4);
  return buffer.readUInt32LE(offset);
}

function readFloat(buffer, offset) {
  assertReadable(buffer, offset, 4);
  return buffer.readFloatLE(offset);
}

function readUInt16(buffer, offset) {
  assertReadable(buffer, offset, 2);
  return buffer.readUInt16LE(offset);
}

function readUInt8(buffer, offset) {
  assertReadable(buffer, offset, 1);
  return buffer.readUInt8(offset);
}

function readInt8(buffer, offset) {
  assertReadable(buffer, offset, 1);
  return buffer.readInt8(offset);
}

function createWheelMap() {
  return Object.fromEntries(WHEEL_KEYS.map((key) => [key, {}]));
}

function readFloatVector(buffer, offset) {
  return {
    x: readFloat(buffer, offset),
    y: readFloat(buffer, offset + 4),
    z: readFloat(buffer, offset + 8)
  };
}

function readWheelFloats(buffer, offset, wheels, field) {
  for (let index = 0; index < WHEEL_KEYS.length; index += 1) {
    wheels[WHEEL_KEYS[index]][field] = readFloat(buffer, offset + index * 4);
  }
  return offset + WHEEL_KEYS.length * 4;
}

function readWheelInt32(buffer, offset, wheels, field) {
  for (let index = 0; index < WHEEL_KEYS.length; index += 1) {
    wheels[WHEEL_KEYS[index]][field] = readInt32(buffer, offset + index * 4);
  }
  return offset + WHEEL_KEYS.length * 4;
}

function decodeForzaPacket(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < SLED_PACKET_LENGTH) {
    throw new UnsupportedForzaPacketError(Buffer.isBuffer(buffer) ? buffer.length : 0);
  }

  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const wheels = createWheelMap();
  let offset = 0;

  const sample = {
    schema: "fh6-tune-helper.forza-data-out.raw.v1",
    gameId: options.gameId ?? "fh6",
    packetLength: buffer.length,
    packetFormat: buffer.length >= DASH_MIN_PACKET_LENGTH ? "dash" : "sled",
    receivedAt,
    source: options.source ?? null,
    isRaceOn: readInt32(buffer, offset) === 1
  };
  offset += 4;

  sample.timestampMs = readUInt32(buffer, offset);
  offset += 4;

  sample.engine = {
    maxRpm: readFloat(buffer, offset),
    idleRpm: readFloat(buffer, offset + 4),
    rpm: readFloat(buffer, offset + 8)
  };
  offset += 12;

  sample.acceleration = readFloatVector(buffer, offset);
  offset += 12;
  sample.velocity = readFloatVector(buffer, offset);
  offset += 12;
  sample.angularVelocity = readFloatVector(buffer, offset);
  offset += 12;

  sample.orientation = {
    yaw: readFloat(buffer, offset),
    pitch: readFloat(buffer, offset + 4),
    roll: readFloat(buffer, offset + 8)
  };
  offset += 12;

  offset = readWheelFloats(buffer, offset, wheels, "suspensionTravelNormalized");
  offset = readWheelFloats(buffer, offset, wheels, "slipRatio");
  offset = readWheelFloats(buffer, offset, wheels, "rotationSpeed");
  offset = readWheelInt32(buffer, offset, wheels, "onRumbleStrip");
  offset = readWheelFloats(buffer, offset, wheels, "puddleDepth");
  offset = readWheelFloats(buffer, offset, wheels, "surfaceRumble");
  offset = readWheelFloats(buffer, offset, wheels, "slipAngle");
  offset = readWheelFloats(buffer, offset, wheels, "combinedSlip");
  offset = readWheelFloats(buffer, offset, wheels, "suspensionTravelMeters");

  sample.car = {
    ordinal: readInt32(buffer, offset),
    class: readInt32(buffer, offset + 4),
    performanceIndex: readInt32(buffer, offset + 8),
    drivetrainType: readInt32(buffer, offset + 12),
    numCylinders: readInt32(buffer, offset + 16)
  };
  offset += 20;

  sample.wheels = wheels;

  if (buffer.length >= DASH_MIN_PACKET_LENGTH) {
    sample.position = readFloatVector(buffer, offset);
    offset += 12;

    sample.dash = {
      speedMps: readFloat(buffer, offset),
      powerW: readFloat(buffer, offset + 4),
      torqueNm: readFloat(buffer, offset + 8)
    };
    offset += 12;

    offset = readWheelFloats(buffer, offset, wheels, "tireTempC");
  }

  if (buffer.length >= DASH_MIN_PACKET_LENGTH) {
    sample.dash.boost = readFloat(buffer, offset);
    sample.dash.fuel = readFloat(buffer, offset + 4);
    sample.dash.distanceTraveledM = readFloat(buffer, offset + 8);
    sample.dash.bestLapSeconds = readFloat(buffer, offset + 12);
    sample.dash.lastLapSeconds = readFloat(buffer, offset + 16);
    sample.dash.currentLapSeconds = readFloat(buffer, offset + 20);
    sample.dash.currentRaceTimeSeconds = readFloat(buffer, offset + 24);
    offset += 28;

    sample.dash.lapNumber = readUInt16(buffer, offset);
    offset += 2;
    sample.dash.racePosition = readUInt8(buffer, offset);
    offset += 1;

    sample.inputs = {
      throttleRaw: readUInt8(buffer, offset),
      brakeRaw: readUInt8(buffer, offset + 1),
      clutchRaw: readUInt8(buffer, offset + 2),
      handbrakeRaw: readUInt8(buffer, offset + 3),
      gear: readUInt8(buffer, offset + 4),
      steerRaw: readInt8(buffer, offset + 5),
      normalizedDrivingLine: readInt8(buffer, offset + 6),
      normalizedAIBrakeDifference: readInt8(buffer, offset + 7)
    };
  } else {
    sample.inputs = null;
  }

  return sample;
}

module.exports = {
  DASH_MIN_PACKET_LENGTH,
  SLED_PACKET_LENGTH,
  WHEEL_KEYS,
  UnsupportedForzaPacketError,
  decodeForzaPacket
};
