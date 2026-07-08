"use strict";

const api = window.fh6Telemetry;

const WHEEL_FIELDS = [
  ["tireTempC", "Surface", "C", 1],
  ["tirePressure", "Pressure", "", 1],
  ["tireTempInnerC", "Inner", "C", 1],
  ["tireTempMiddleC", "Middle", "C", 1],
  ["tireTempOuterC", "Outer", "C", 1],
  ["combinedSlip", "Grip Slip", "", 2],
  ["slipRatio", "Slip Ratio", "", 2],
  ["slipAngle", "Slip Angle", "", 2],
  ["suspensionTravelMeters", "Travel", "m", 3],
  ["suspensionTravelNormalized", "Travel Load", "", 2]
];

const MAP_METRICS = new Set(["speed", "throttle", "brake", "line"]);

const elements = {
  liveModeButton: document.querySelector("#liveModeButton"),
  reviewModeButton: document.querySelector("#reviewModeButton"),
  liveMode: document.querySelector("#liveMode"),
  reviewMode: document.querySelector("#reviewMode"),
  connectionStatus: document.querySelector("#connectionStatus"),
  portInput: document.querySelector("#portInput"),
  startListenerButton: document.querySelector("#startListenerButton"),
  stopListenerButton: document.querySelector("#stopListenerButton"),
  startSessionButton: document.querySelector("#startSessionButton"),
  stopSessionButton: document.querySelector("#stopSessionButton"),
  refreshSessionsButton: document.querySelector("#refreshSessionsButton"),
  reviewNameInput: document.querySelector("#reviewNameInput"),
  saveSessionNameButton: document.querySelector("#saveSessionNameButton"),
  sessionList: document.querySelector("#sessionList"),
  historyMeta: document.querySelector("#historyMeta"),
  loadedSessionMeta: document.querySelector("#loadedSessionMeta"),
  openFolderButton: document.querySelector("#openFolderButton"),
  packetsValue: document.querySelector("#packetsValue"),
  decodedValue: document.querySelector("#decodedValue"),
  errorsValue: document.querySelector("#errorsValue"),
  lastPacketValue: document.querySelector("#lastPacketValue"),
  speedValue: document.querySelector("#speedValue"),
  rpmValue: document.querySelector("#rpmValue"),
  rpmPctValue: document.querySelector("#rpmPctValue"),
  gearValue: document.querySelector("#gearValue"),
  throttleValue: document.querySelector("#throttleValue"),
  brakeValue: document.querySelector("#brakeValue"),
  handbrakeValue: document.querySelector("#handbrakeValue"),
  steerValue: document.querySelector("#steerValue"),
  powerValue: document.querySelector("#powerValue"),
  torqueValue: document.querySelector("#torqueValue"),
  boostValue: document.querySelector("#boostValue"),
  fuelValue: document.querySelector("#fuelValue"),
  latGValue: document.querySelector("#latGValue"),
  longGValue: document.querySelector("#longGValue"),
  yawValue: document.querySelector("#yawValue"),
  pitchRollValue: document.querySelector("#pitchRollValue"),
  recordingValue: document.querySelector("#recordingValue"),
  sampleCountValue: document.querySelector("#sampleCountValue"),
  folderValue: document.querySelector("#folderValue"),
  findingsList: document.querySelector("#findingsList"),
  replayMeta: document.querySelector("#replayMeta"),
  lapSelect: document.querySelector("#lapSelect"),
  replaySlider: document.querySelector("#replaySlider"),
  replayStartLabel: document.querySelector("#replayStartLabel"),
  replayEndLabel: document.querySelector("#replayEndLabel"),
  elevationCanvas: document.querySelector("#elevationCanvas"),
  elevationEmptyState: document.querySelector("#elevationEmptyState"),
  elevationValue: document.querySelector("#elevationValue"),
  slopeValue: document.querySelector("#slopeValue"),
  currentFrameLabel: document.querySelector("#currentFrameLabel"),
  dataPanelTitle: document.querySelector("#dataPanelTitle"),
  sourceModeLabel: document.querySelector("#sourceModeLabel"),
  mapTitle: document.querySelector("#mapTitle"),
  trackCanvas: document.querySelector("#trackCanvas"),
  mapMetricButtons: Array.from(document.querySelectorAll("[data-map-metric]")),
  routeEmptyState: document.querySelector("#routeEmptyState"),
  channelAvailability: document.querySelector("#channelAvailability"),
  messageLog: document.querySelector("#messageLog")
};

const wheelCards = Array.from(document.querySelectorAll(".wheel-card"));
const state = {
  mode: "live",
  recording: false,
  currentSessionId: null,
  currentSessionDirectory: null,
  sessions: [],
  loadedSessionId: null,
  replay: null,
  selectedLap: "all",
  selectedFrameIndex: 0,
  mapMetric: "speed",
  latestLiveFrame: null,
  liveFrames: []
};

buildWheelCards();
renderReplayEmpty();
refreshSessions();

elements.liveModeButton.addEventListener("click", () => setMode("live"));
elements.reviewModeButton.addEventListener("click", () => setMode("review"));
elements.refreshSessionsButton.addEventListener("click", refreshSessions);

elements.startListenerButton.addEventListener("click", async () => {
  try {
    const port = Number(elements.portInput.value || 5300);
    updateState(await api.startListener({ port }));
    log(`Listening on UDP ${port}.`);
  } catch (error) {
    log(error.message, true);
  }
});

elements.stopListenerButton.addEventListener("click", async () => {
  try {
    updateState(await api.stopListener());
    log("Listener stopped.");
  } catch (error) {
    log(error.message, true);
  }
});

elements.startSessionButton.addEventListener("click", async () => {
  try {
    state.liveFrames = [];
    state.latestLiveFrame = null;
    state.replay = null;
    state.selectedFrameIndex = 0;
    clearReplayControls();
    const session = await api.startSession({
      gameId: "fh6"
    });
    updateSession(session);
    renderFindings([]);
    setMode("live");
    log("Recording started.");
  } catch (error) {
    log(error.message, true);
  }
});

elements.stopSessionButton.addEventListener("click", async () => {
  try {
    const session = await api.stopSession();
    state.loadedSessionId = session?.id ?? state.loadedSessionId;
    updateSession(session);
    renderFindings(session?.summary?.findings ?? []);
    setReplay(session?.summary?.replay ?? null);
    await refreshSessions();
    setMode("review");
    log("Session stopped and loaded for review.");
  } catch (error) {
    log(error.message, true);
  }
});

elements.openFolderButton.addEventListener("click", () => {
  if (state.currentSessionDirectory) {
    api.openSessionFolder(state.currentSessionDirectory);
  }
});

elements.saveSessionNameButton.addEventListener("click", saveLoadedSessionName);

elements.replaySlider.addEventListener("input", () => {
  renderReplayFrame(Number(elements.replaySlider.value));
});

elements.lapSelect.addEventListener("change", () => {
  state.selectedLap = elements.lapSelect.value;
  updateTimelineRange();
  renderReplayFrame(Number(elements.replaySlider.min));
});

for (const button of elements.mapMetricButtons) {
  button.addEventListener("click", () => {
    setMapMetric(button.dataset.mapMetric);
  });
}

elements.elevationCanvas.addEventListener("pointerdown", handleElevationPointer);
elements.trackCanvas.addEventListener("pointerdown", handleTrackPointer);

api.onSample((sample) => {
  const frame = sampleToFrame(sample);
  state.latestLiveFrame = frame;
  rememberLiveFrame(frame);

  if (state.mode === "live") {
    renderFrame(frame, "Live");
    drawCurrentMap();
  }

  if (state.recording) {
    elements.sampleCountValue.textContent = String(Number(elements.sampleCountValue.textContent || "0") + 1);
  }
});

api.onStatus(updateState);
api.onSession(updateSession);
api.onError((message) => log(message, true));

api.getState().then(updateState).catch((error) => log(error.message, true));

setInterval(async () => {
  try {
    updateState(await api.getState());
  } catch (error) {
    log(error.message, true);
  }
}, 1000);

window.addEventListener("resize", () => {
  drawCurrentMap();
  drawCurrentElevation();
});

function setMode(mode) {
  state.mode = mode;
  const isLive = mode === "live";
  elements.liveMode.classList.toggle("is-active", isLive);
  elements.reviewMode.classList.toggle("is-active", !isLive);
  elements.liveModeButton.classList.toggle("is-active", isLive);
  elements.reviewModeButton.classList.toggle("is-active", !isLive);
  elements.liveModeButton.setAttribute("aria-selected", String(isLive));
  elements.reviewModeButton.setAttribute("aria-selected", String(!isLive));
  elements.dataPanelTitle.textContent = isLive ? "Realtime Vehicle Monitor" : "Race History Review";
  elements.sourceModeLabel.textContent = isLive ? "Live" : "Review";
  elements.mapTitle.textContent = isLive ? "Live Route" : "Lap Map";

  if (isLive) {
    renderFrame(state.latestLiveFrame ?? emptyFrame(), state.latestLiveFrame ? "Live" : "No live sample");
  } else if (state.replay?.frames?.length) {
    renderReplayFrame(state.selectedFrameIndex);
  } else {
    renderReplayEmpty();
  }
  drawCurrentMap();
  drawCurrentElevation();
}

function setMapMetric(metric) {
  if (!MAP_METRICS.has(metric)) {
    return;
  }

  state.mapMetric = metric;
  for (const button of elements.mapMetricButtons) {
    button.classList.toggle("is-active", button.dataset.mapMetric === metric);
  }
  drawCurrentMap();
}

function updateState(nextState) {
  if (!nextState) {
    return;
  }

  const listener = nextState.listener ?? nextState;
  state.recording = Boolean(nextState.recording);
  elements.connectionStatus.textContent = listener.listening ? "Listening" : "Idle";
  elements.connectionStatus.classList.toggle("is-on", Boolean(listener.listening));
  elements.packetsValue.textContent = String(listener.packetsReceived ?? 0);
  elements.decodedValue.textContent = String(listener.packetsDecoded ?? 0);
  elements.errorsValue.textContent = String(listener.decodeErrors ?? 0);
  elements.lastPacketValue.textContent = formatClock(listener.lastPacketAt);
  elements.recordingValue.textContent = state.recording ? "Yes" : "No";

  if (nextState.session) {
    updateSession(nextState.session);
  }

  if (nextState.lastSample) {
    const frame = sampleToFrame(nextState.lastSample);
    state.latestLiveFrame = frame;
    if (state.mode === "live") {
      renderFrame(frame, "Live");
      drawCurrentMap();
    }
  }
}

function updateSession(session) {
  if (!session) {
    elements.recordingValue.textContent = "No";
    elements.reviewNameInput.disabled = true;
    elements.saveSessionNameButton.disabled = true;
    return;
  }

  state.currentSessionId = session.id ?? state.currentSessionId;
  state.currentSessionDirectory = session.directory;
  const displayName = session.metadata?.name || session.metadata?.defaultName || session.id || "";
  elements.recordingValue.textContent = session.endedAt ? "No" : "Yes";
  elements.sampleCountValue.textContent = String(session.sampleCount ?? 0);
  elements.folderValue.textContent = session.directory ?? "-";
  elements.openFolderButton.disabled = !session.directory;
  elements.reviewNameInput.value = displayName;
  elements.reviewNameInput.disabled = !session.id;
  elements.saveSessionNameButton.disabled = !session.id;
  elements.loadedSessionMeta.textContent = session.id
    ? `${displayName} ${session.sampleCount ?? 0} samples`
    : "No session loaded.";
}

async function saveLoadedSessionName() {
  const sessionId = state.loadedSessionId ?? state.currentSessionId;
  if (!sessionId) {
    log("Load a session before saving a name.", true);
    return;
  }

  try {
    const session = await api.updateSessionName(sessionId, elements.reviewNameInput.value);
    state.loadedSessionId = session.id;
    updateSession(session);
    await refreshSessions();
    renderSessionList();
    log("Record name saved.");
  } catch (error) {
    log(error.message, true);
  }
}

async function refreshSessions() {
  try {
    state.sessions = await api.listSessions();
    renderSessionList();
  } catch (error) {
    log(error.message, true);
  }
}

function renderSessionList() {
  elements.sessionList.replaceChildren();
  elements.historyMeta.textContent = `${state.sessions.length} recorded sessions available.`;

  if (!state.sessions.length) {
    const empty = document.createElement("p");
    empty.textContent = "No recorded sessions yet.";
    elements.sessionList.append(empty);
    return;
  }

  for (const session of state.sessions) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "session-item";
    item.classList.toggle("is-active", session.id === state.loadedSessionId);
    item.dataset.sessionId = session.id;

    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const time = document.createElement("span");
    title.textContent = session.metadata?.name || session.id;
    meta.textContent = `${session.sampleCount ?? 0} samples ${session.hasSummary ? "summary ready" : "raw only"}`;
    time.textContent = `${formatDateTime(session.startedAt)} ${session.endedAt ? "completed" : "open"}`;
    item.append(title, meta, time);
    item.addEventListener("click", () => loadHistorySession(session.id));
    elements.sessionList.append(item);
  }
}

async function loadHistorySession(sessionId) {
  try {
    const session = await api.loadSession(sessionId);
    state.loadedSessionId = session.id;
    updateSession(session);
    renderFindings(session.summary?.findings ?? []);
    setReplay(session.summary?.replay ?? null);
    renderSessionList();
    setMode("review");
    log(`Loaded ${session.id}.`);
  } catch (error) {
    log(error.message, true);
  }
}

function setReplay(replay) {
  state.replay = replay;
  state.selectedLap = "all";
  state.selectedFrameIndex = 0;

  if (!replay || !replay.frames?.length) {
    renderReplayEmpty();
    return;
  }

  elements.lapSelect.replaceChildren();
  elements.lapSelect.append(new Option("Session", "all"));
  for (const [index, lap] of replay.laps.entries()) {
    elements.lapSelect.append(new Option(`${lap.label} ${formatLapDuration(lap)}`, String(index)));
  }
  elements.lapSelect.disabled = replay.laps.length === 0;

  renderChannelAvailability(replay.channels);
  updateTimelineRange();
  renderReplayFrame(0);
}

function renderReplayEmpty() {
  clearReplayControls();
  elements.replayMeta.textContent = "Waiting for recorded FH6 telemetry.";
  elements.currentFrameLabel.textContent = "Frame 0";
  if (state.mode === "review") {
    renderFrame(emptyFrame(), "No frame");
  }
  drawCurrentMap();
  drawCurrentElevation();
}

function clearReplayControls() {
  elements.replaySlider.disabled = true;
  elements.replaySlider.min = "0";
  elements.replaySlider.max = "0";
  elements.replaySlider.value = "0";
  elements.replayStartLabel.textContent = "0:00.000";
  elements.replayEndLabel.textContent = "0:00.000";
  elements.lapSelect.disabled = true;
  elements.lapSelect.replaceChildren(new Option("Session", "all"));
  elements.elevationValue.textContent = "-";
  elements.slopeValue.textContent = "No height data";
}

function updateTimelineRange() {
  if (!state.replay?.frames?.length) {
    clearReplayControls();
    return;
  }

  const { min, max } = selectedFrameRange();
  elements.replaySlider.disabled = false;
  elements.replaySlider.min = String(min);
  elements.replaySlider.max = String(max);
  elements.replaySlider.value = String(min);
  elements.replayStartLabel.textContent = formatDuration(state.replay.frames[min]?.elapsedMs ?? 0);
  elements.replayEndLabel.textContent = formatDuration(state.replay.frames[max]?.elapsedMs ?? 0);
  drawCurrentElevation();
}

function renderReplayFrame(frameIndex) {
  if (!state.replay?.frames?.length) {
    return;
  }

  const clampedIndex = clampFrame(frameIndex, selectedLap());
  const frame = state.replay.frames[clampedIndex];
  state.selectedFrameIndex = clampedIndex;
  elements.replaySlider.value = String(clampedIndex);
  elements.currentFrameLabel.textContent = `Frame ${frame.sourceIndex}`;
  elements.replayMeta.textContent = `${frame.lapNumber ? `Lap ${frame.lapNumber}` : "Session"} ${formatDuration(frame.elapsedMs)} ${formatLapTime(frame.lapTimeSeconds)}`;
  renderFrame(frame, "Review");
  drawCurrentMap();
  drawCurrentElevation();
}

function renderFrame(frame, modeLabel) {
  const safeFrame = frame ?? emptyFrame();
  setText(elements.speedValue, formatNumber(safeFrame.motion.speedKph, 1));
  setText(elements.gearValue, safeFrame.inputs.gear ?? "-");
  setText(elements.rpmValue, formatNumber(safeFrame.engine.rpm, 0));
  setText(elements.rpmPctValue, formatNumber(safeFrame.engine.rpmPct, 0));
  setText(elements.powerValue, formatNumber(safeFrame.engine.powerHp, 0));
  setText(elements.torqueValue, formatNumber(safeFrame.engine.torqueNm, 0));
  setText(elements.boostValue, formatOptional(safeFrame.engine.boost, 2));
  setText(elements.fuelValue, formatOptional(safeFrame.engine.fuel, 1));
  setText(elements.throttleValue, formatNumber(safeFrame.inputs.throttlePct, 0));
  setText(elements.brakeValue, formatNumber(safeFrame.inputs.brakePct, 0));
  setText(elements.handbrakeValue, formatNumber(safeFrame.inputs.handbrakePct, 0));
  setText(elements.steerValue, formatNumber(safeFrame.inputs.steerPct, 0));
  setText(elements.latGValue, formatOptional(safeFrame.motion.accelerationG?.x, 2));
  setText(elements.longGValue, formatOptional(safeFrame.motion.accelerationG?.z, 2));
  setText(elements.yawValue, formatDegrees(safeFrame.orientation.yaw));
  setText(elements.pitchRollValue, `${formatDegrees(safeFrame.orientation.pitch)} / ${formatDegrees(safeFrame.orientation.roll)}`);

  for (const card of wheelCards) {
    const wheelKey = card.dataset.wheel;
    const wheel = safeFrame.wheels[wheelKey] ?? {};
    for (const [key, , unit, digits] of WHEEL_FIELDS) {
      const valueNode = card.querySelector(`[data-wheel-field="${key}"]`);
      const value = wheel[key];
      valueNode.textContent = formatWheelValue(value, unit, digits);
      valueNode.classList.toggle("unavailable", value === null || value === undefined);
    }
  }

  elements.sourceModeLabel.textContent = modeLabel;
}

function buildWheelCards() {
  for (const card of wheelCards) {
    const list = card.querySelector("dl");
    list.replaceChildren();
    for (const [key, label] of WHEEL_FIELDS) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const value = document.createElement("dd");
      term.textContent = label;
      value.textContent = "-";
      value.dataset.wheelField = key;
      row.append(term, value);
      list.append(row);
    }
  }
}

function selectedLap() {
  if (!state.replay || state.selectedLap === "all") {
    return null;
  }
  return state.replay.laps[Number(state.selectedLap)] ?? null;
}

function selectedFrameRange() {
  if (!state.replay?.frames?.length) {
    return { min: 0, max: 0 };
  }

  const lap = selectedLap();
  if (lap) {
    return {
      min: Math.max(0, lap.startFrame),
      max: Math.min(state.replay.frames.length - 1, lap.endFrame)
    };
  }

  return {
    min: 0,
    max: state.replay.frames.length - 1
  };
}

function clampFrame(frameIndex, lap) {
  const max = state.replay.frames.length - 1;
  if (!lap) {
    return Math.max(0, Math.min(max, frameIndex));
  }
  return Math.max(lap.startFrame, Math.min(lap.endFrame, frameIndex));
}

function rememberLiveFrame(frame) {
  if (!hasPosition(frame.position)) {
    return;
  }
  state.liveFrames.push(frame);
  if (state.liveFrames.length > 3600) {
    state.liveFrames.shift();
  }
}

function handleElevationPointer(event) {
  if (state.mode !== "review" || !state.replay?.frames?.length || elements.replaySlider.disabled) {
    return;
  }

  const rect = elements.elevationCanvas.getBoundingClientRect();
  const pad = elevationPadding();
  const drawableWidth = Math.max(1, rect.width - pad.left - pad.right);
  const x = clamp(event.clientX - rect.left - pad.left, 0, drawableWidth);
  const range = selectedFrameRange();
  const ratio = x / drawableWidth;
  renderReplayFrame(Math.round(range.min + ratio * (range.max - range.min)));
}

function handleTrackPointer(event) {
  if (state.mode !== "review" || !state.replay?.frames?.length || !state.replay.bounds) {
    return;
  }

  const rect = elements.trackCanvas.getBoundingClientRect();
  const target = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  const range = selectedFrameRange();
  let nearestIndex = null;
  let nearestDistance = Infinity;

  for (let index = range.min; index <= range.max; index += 1) {
    const frame = state.replay.frames[index];
    if (!hasPosition(frame?.position)) {
      continue;
    }

    const point = mapPoint(frame.position, state.replay.bounds, elements.trackCanvas);
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  if (nearestIndex !== null) {
    renderReplayFrame(nearestIndex);
  }
}

function drawCurrentElevation() {
  if (state.mode !== "review" || !state.replay?.frames?.length) {
    drawEmptyElevation();
    return;
  }

  const range = selectedFrameRange();
  const items = elevationItems(range);
  if (items.length < 2) {
    drawEmptyElevation();
    return;
  }

  const selectedItem = selectedElevationItem(items, state.selectedFrameIndex);
  drawElevationProfile(items, range, selectedItem);
  updateElevationReadout(selectedItem, items);
}

function drawElevationProfile(items, range, selectedItem) {
  elements.elevationEmptyState.classList.add("is-hidden");
  const canvas = elements.elevationCanvas;
  const ctx = prepareCanvas(canvas);
  const bounds = elevationBounds(items);
  drawElevationGrid(ctx, canvas, bounds);
  drawElevationPath(ctx, canvas, items, bounds, range);

  if (selectedItem) {
    drawElevationCursor(ctx, canvas, selectedItem, bounds, range);
  }
}

function drawEmptyElevation() {
  const canvas = elements.elevationCanvas;
  const ctx = prepareCanvas(canvas);
  drawElevationGrid(ctx, canvas, null);
  elements.elevationEmptyState.classList.remove("is-hidden");
  elements.elevationValue.textContent = "-";
  elements.slopeValue.textContent = "No height data";
}

function elevationItems(range) {
  const items = [];
  for (let index = range.min; index <= range.max; index += 1) {
    const frame = state.replay.frames[index];
    if (hasElevation(frame?.position)) {
      items.push({
        index,
        frame,
        height: frame.position.y
      });
    }
  }
  return items;
}

function selectedElevationItem(items, frameIndex) {
  let selected = null;
  let smallestDistance = Infinity;

  for (const item of items) {
    const distance = Math.abs(item.index - frameIndex);
    if (distance < smallestDistance) {
      selected = item;
      smallestDistance = distance;
    }
  }

  return selected;
}

function elevationBounds(items) {
  const heights = items.map((item) => item.height);
  let minY = Math.min(...heights);
  let maxY = Math.max(...heights);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  return { minY, maxY, deltaM: maxY - minY };
}

function drawElevationGrid(ctx, canvas, bounds) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pad = elevationPadding();
  ctx.fillStyle = "#0c1013";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  ctx.lineWidth = 1;

  for (let row = 0; row <= 4; row += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 4) * row;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  if (bounds) {
    ctx.fillStyle = "rgba(152, 166, 174, 0.75)";
    ctx.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${bounds.maxY.toFixed(0)} m`, width - pad.right, pad.top + 10);
    ctx.fillText(`${bounds.minY.toFixed(0)} m`, width - pad.right, height - pad.bottom);
  }
}

function drawElevationPath(ctx, canvas, items, bounds, range) {
  const upColor = themeColor("--elevation-up", "#f2a23a");
  const downColor = themeColor("--elevation-down", "#55c8c0");
  const stableColor = themeColor("--accent-strong", "#7bd6e6");

  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    const start = elevationPoint(previous, bounds, range, canvas);
    const end = elevationPoint(current, bounds, range, canvas);
    const delta = current.height - previous.height;
    ctx.strokeStyle = delta > 0.25 ? upColor : delta < -0.25 ? downColor : stableColor;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

function drawElevationCursor(ctx, canvas, item, bounds, range) {
  const point = elevationPoint(item, bounds, range, canvas);
  const pad = elevationPadding();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.strokeStyle = "rgba(245, 247, 248, 0.48)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(point.x, pad.top);
  ctx.lineTo(point.x, height - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = themeColor("--elevation-cursor", "#f5f7f8");
  ctx.strokeStyle = "#061014";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 247, 248, 0.7)";
  ctx.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.textAlign = point.x > width - 90 ? "right" : "left";
  ctx.fillText(`${item.height.toFixed(1)} m`, point.x + (point.x > width - 90 ? -8 : 8), Math.max(14, point.y - 8));
}

function elevationPoint(item, bounds, range, canvas) {
  const pad = elevationPadding();
  const width = canvas.clientWidth - pad.left - pad.right;
  const height = canvas.clientHeight - pad.top - pad.bottom;
  const indexRange = Math.max(1, range.max - range.min);
  const heightRange = Math.max(1, bounds.maxY - bounds.minY);

  return {
    x: pad.left + ((item.index - range.min) / indexRange) * width,
    y: pad.top + (1 - (item.height - bounds.minY) / heightRange) * height
  };
}

function elevationPadding() {
  return { top: 16, right: 48, bottom: 18, left: 12 };
}

function updateElevationReadout(item, items) {
  if (!item) {
    elements.elevationValue.textContent = "-";
    elements.slopeValue.textContent = "No height data";
    return;
  }

  elements.elevationValue.textContent = `${item.height.toFixed(1)} m`;
  elements.slopeValue.textContent = formatSlope(slopeAroundItem(item, items));
}

function slopeAroundItem(item, items) {
  const offset = items.indexOf(item);
  const previous = offset > 0 ? items[offset - 1] : null;
  const next = offset < items.length - 1 ? items[offset + 1] : null;
  const reference = previous ?? next;

  if (!reference) {
    return null;
  }

  const deltaM = previous ? item.height - reference.height : reference.height - item.height;
  const distanceM = horizontalDistance(previous ? reference.frame.position : item.frame.position, previous ? item.frame.position : reference.frame.position);
  const percent = distanceM && distanceM > 0 ? (deltaM / distanceM) * 100 : null;
  return { deltaM, distanceM, percent };
}

function horizontalDistance(start, end) {
  if (!hasPosition(start) || !hasPosition(end)) {
    return null;
  }

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function drawCurrentMap() {
  if (state.mode === "review") {
    drawReplayMap();
  } else {
    drawLiveMap();
  }
}

function drawReplayMap() {
  const replay = state.replay;
  if (!replay?.frames?.length || !replay.bounds) {
    drawEmptyMap();
    return;
  }

  const allRoute = replay.frames.filter((frame) => hasPosition(frame.position));
  if (!allRoute.length) {
    drawEmptyMap();
    return;
  }

  const lap = selectedLap();
  const selectedRoute = lap
    ? replay.frames.slice(lap.startFrame, lap.endFrame + 1).filter((frame) => hasPosition(frame.position))
    : allRoute;
  const frame = replay.frames[state.selectedFrameIndex];
  drawRouteMap(allRoute, selectedRoute, replay.bounds, frame);
}

function drawLiveMap() {
  if (!state.liveFrames.length) {
    drawEmptyMap();
    return;
  }

  const bounds = routeBounds(state.liveFrames);
  drawRouteMap(state.liveFrames, state.liveFrames, bounds, state.latestLiveFrame);
}

function drawRouteMap(allRoute, selectedRoute, bounds, frame) {
  elements.routeEmptyState.classList.add("is-hidden");
  const canvas = elements.trackCanvas;
  const ctx = prepareCanvas(canvas);
  drawGrid(ctx, canvas);
  drawSolidPath(ctx, allRoute, bounds, "rgba(151, 166, 174, 0.24)", 2);
  drawMetricPath(ctx, selectedRoute, bounds, state.mapMetric);
  drawRouteEndpoints(ctx, selectedRoute, bounds);

  if (frame && hasPosition(frame.position)) {
    drawCarMarker(ctx, frame, bounds);
  }
}

function drawEmptyMap() {
  const canvas = elements.trackCanvas;
  const ctx = prepareCanvas(canvas);
  drawGrid(ctx, canvas);
  elements.routeEmptyState.classList.remove("is-hidden");
}

function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  return ctx;
}

function drawGrid(ctx, canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.fillStyle = "#0c1013";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawSolidPath(ctx, frames, bounds, color, lineWidth) {
  if (frames.length < 2) {
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  frames.forEach((frame, index) => {
    const point = mapPoint(frame.position, bounds, ctx.canvas);
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
}

function drawMetricPath(ctx, frames, bounds, metric) {
  if (frames.length < 2) {
    return;
  }

  if (metric === "line") {
    drawSolidPath(ctx, frames, bounds, "rgba(88, 183, 199, 0.96)", 3);
    return;
  }

  const range = metricRange(frames, metric);
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const start = mapPoint(previous.position, bounds, ctx.canvas);
    const end = mapPoint(current.position, bounds, ctx.canvas);
    ctx.strokeStyle = metricSegmentColor(metric, metricValue(current, metric), range);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

function drawRouteEndpoints(ctx, frames, bounds) {
  if (!frames.length) {
    return;
  }

  const first = frames.find((frame) => hasPosition(frame.position));
  const last = [...frames].reverse().find((frame) => hasPosition(frame.position));
  if (!first || !last) {
    return;
  }

  const start = mapPoint(first.position, bounds, ctx.canvas);
  const end = mapPoint(last.position, bounds, ctx.canvas);
  ctx.fillStyle = themeColor("--ok", "#7bd88f");
  ctx.beginPath();
  ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(245, 247, 248, 0.72)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4.5, 0, Math.PI * 2);
  ctx.stroke();
}

function metricRange(frames, metric) {
  if (metric === "throttle" || metric === "brake") {
    return { min: 0, max: 100 };
  }

  const values = frames.map((frame) => metricValue(frame, metric)).filter((value) => typeof value === "number");
  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? { min, max: min + 1 } : { min, max };
}

function metricValue(frame, metric) {
  if (metric === "speed") {
    return numberOrNull(frame.motion?.speedKph);
  }
  if (metric === "throttle") {
    return numberOrNull(frame.inputs?.throttlePct);
  }
  if (metric === "brake") {
    return numberOrNull(frame.inputs?.brakePct);
  }
  return null;
}

function metricSegmentColor(metric, value, range) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "rgba(88, 183, 199, 0.62)";
  }

  const ratio = clamp((value - range.min) / Math.max(1, range.max - range.min), 0, 1);
  if (metric === "brake") {
    return mixRgb([49, 86, 92], [249, 112, 102], ratio, 0.96);
  }
  if (metric === "throttle") {
    return mixRgb([49, 86, 92], [123, 216, 143], ratio, 0.96);
  }
  return mixRgb([242, 162, 58], [85, 200, 192], ratio, 0.96);
}

function drawCarMarker(ctx, frame, bounds) {
  const point = mapPoint(frame.position, bounds, ctx.canvas);
  ctx.fillStyle = "#7bd88f";
  ctx.strokeStyle = "#061014";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (typeof frame.orientation.yaw === "number") {
    const length = 18;
    const angle = frame.orientation.yaw;
    ctx.strokeStyle = "#7bd88f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + Math.sin(angle) * length, point.y - Math.cos(angle) * length);
    ctx.stroke();
  }
}

function mapPoint(position, bounds, canvas) {
  const padding = 34;
  const width = Math.max(1, canvas.clientWidth - padding * 2);
  const height = Math.max(1, canvas.clientHeight - padding * 2);
  const rangeX = Math.max(1, bounds.maxX - bounds.minX);
  const rangeZ = Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(width / rangeX, height / rangeZ);
  const routeWidth = rangeX * scale;
  const routeHeight = rangeZ * scale;
  const offsetX = (canvas.clientWidth - routeWidth) / 2;
  const offsetY = (canvas.clientHeight - routeHeight) / 2;
  return {
    x: offsetX + (position.x - bounds.minX) * scale,
    y: offsetY + (rangeZ - (position.z - bounds.minZ)) * scale
  };
}

function routeBounds(frames) {
  const xs = frames.map((frame) => frame.position.x);
  const zs = frames.map((frame) => frame.position.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
}

function renderFindings(findings) {
  elements.findingsList.replaceChildren();

  if (!findings.length) {
    const item = document.createElement("li");
    item.textContent = "No rule findings for this session.";
    elements.findingsList.append(item);
    return;
  }

  for (const finding of findings) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = finding.title;
    detail.textContent = `${finding.detail} Area: ${finding.suggestedArea}.`;
    item.append(title, detail);
    elements.findingsList.append(item);
  }
}

function renderChannelAvailability(channels = {}) {
  const missing = [];
  if (!channels.tirePressure) {
    missing.push("tire pressure");
  }
  if (!channels.tireInnerMiddleOuterTemps) {
    missing.push("inner middle outer tire temps");
  }

  const available = [
    channels.position ? "route" : null,
    channels.elevation ? "elevation" : null,
    channels.lapTiming ? "lap time" : null,
    channels.power ? "power" : null,
    channels.tireSurfaceTemp ? "surface tire temp" : null,
    channels.suspensionTravel ? "suspension travel" : null,
    channels.wheelSlip ? "wheel slip" : null
  ].filter(Boolean);

  const availableText = available.length ? available.join(", ") : "core speed and input channels";
  const missingText = missing.length ? ` Missing from Forza Data Out: ${missing.join(", ")}.` : "";
  elements.channelAvailability.textContent = `Available: ${availableText}.${missingText}`;
}

function sampleToFrame(sample) {
  const wheels = {};
  for (const key of ["frontLeft", "frontRight", "rearLeft", "rearRight"]) {
    const wheel = sample.wheels?.[key] ?? {};
    wheels[key] = {
      tireTempC: wheel.tireTempC ?? null,
      tirePressure: null,
      tireTempInnerC: null,
      tireTempMiddleC: null,
      tireTempOuterC: null,
      combinedSlip: wheel.combinedSlip ?? null,
      slipRatio: wheel.slipRatio ?? null,
      slipAngle: wheel.slipAngle ?? null,
      suspensionTravelMeters: wheel.suspensionTravelMeters ?? null,
      suspensionTravelNormalized: wheel.suspensionTravelNormalized ?? null
    };
  }

  return {
    sourceIndex: sample.timestampMs ?? 0,
    elapsedMs: 0,
    lapNumber: sample.dash?.lapNumber ?? null,
    lapTimeSeconds: sample.dash?.currentLapSeconds ?? null,
    position: sample.motion?.position ?? { x: null, y: null, z: null },
    orientation: sample.motion?.orientation ?? { yaw: null, pitch: null, roll: null },
    motion: {
      speedKph: sample.motion?.speedKph ?? null,
      accelerationG: sample.motion?.accelerationG ?? null
    },
    engine: {
      rpm: sample.engine?.rpm ?? null,
      rpmPct: sample.engine?.rpmPct ?? null,
      powerHp: wattsToHp(sample.dash?.powerW),
      torqueNm: sample.dash?.torqueNm ?? null,
      boost: sample.dash?.boost ?? null,
      fuel: sample.dash?.fuel ?? null
    },
    inputs: {
      throttlePct: sample.inputs?.throttlePct ?? null,
      brakePct: sample.inputs?.brakePct ?? null,
      handbrakePct: sample.inputs?.handbrakePct ?? null,
      steerPct: sample.inputs?.steerPct ?? null,
      gear: sample.inputs?.gear ?? null
    },
    wheels
  };
}

function emptyFrame() {
  return sampleToFrame({ wheels: {}, motion: {}, engine: {}, inputs: {}, dash: {} });
}

function hasPosition(position) {
  return (
    typeof position?.x === "number" &&
    Number.isFinite(position.x) &&
    typeof position?.z === "number" &&
    Number.isFinite(position.z)
  );
}

function hasElevation(position) {
  return typeof position?.y === "number" && Number.isFinite(position.y);
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function themeColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function mixRgb(from, to, ratio, alpha = 1) {
  const red = Math.round(from[0] + (to[0] - from[0]) * ratio);
  const green = Math.round(from[1] + (to[1] - from[1]) * ratio);
  const blue = Math.round(from[2] + (to[2] - from[2]) * ratio);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function setText(node, value) {
  node.textContent = value;
}

function formatNumber(value, digits) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatOptional(value, digits) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatWheelValue(value, unit, digits) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function formatClock(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatDuration(milliseconds) {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return "0:00.000";
  }
  const totalMs = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function formatLapTime(seconds) {
  return typeof seconds === "number" && Number.isFinite(seconds) ? `Lap time ${formatDuration(seconds * 1000)}` : "";
}

function formatLapDuration(lap) {
  return typeof lap.durationSeconds === "number" ? `(${formatDuration(lap.durationSeconds * 1000)})` : "";
}

function formatSlope(slope) {
  if (!slope || typeof slope.percent !== "number" || !Number.isFinite(slope.percent)) {
    return "Slope unavailable";
  }

  const grade = slope.percent;
  const deltaText = typeof slope.deltaM === "number" ? `${signedNumber(slope.deltaM, 1)} m` : "-";
  const distanceText = typeof slope.distanceM === "number" ? `${slope.distanceM.toFixed(0)} m` : "-";

  if (Math.abs(grade) < 0.35) {
    return `Level ${signedNumber(grade, 1)}% (${deltaText} / ${distanceText})`;
  }

  return `${grade > 0 ? "Uphill" : "Downhill"} ${signedNumber(grade, 1)}% (${deltaText} / ${distanceText})`;
}

function signedNumber(value, digits) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatDegrees(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${((value * 180) / Math.PI).toFixed(1)} deg`;
}

function wattsToHp(value) {
  return typeof value === "number" && Number.isFinite(value) ? value / 745.699872 : null;
}

function log(message, isError = false) {
  elements.messageLog.textContent = message;
  elements.messageLog.style.color = isError ? "var(--danger)" : "var(--muted)";
}
