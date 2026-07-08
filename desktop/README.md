# FH6 Tune Lab Telemetry Desktop

Desktop MVP for reading Forza Horizon 6 UDP telemetry, recording test sessions,
and replaying vehicle state over a reconstructed route map. This app lives under
`desktop/` and is separate from the static web tuning helper in the repository
root.

## Run

```powershell
cd desktop
npm.cmd install
npm.cmd start
```

## Test Core Modules

```powershell
cd desktop
npm.cmd test
```

The tests do not require Electron. They cover packet decoding, normalization,
rule summaries, session file output, replay models, and history loading.

## Modes

- Live Monitor: Start the UDP listener, watch realtime vehicle data, and record
  a test session. New recordings are named with local system time by default.
- Race Review: Load a recorded session, choose a lap, scrub the timeline, and
  inspect the vehicle state at that point on the route. Session names can be
  edited after recording.

## Replay

- Route shape is rebuilt from recorded vehicle `x/z` positions.
- Elevation profile uses vehicle `y` position.
- Route color can show speed, throttle, brake, or a plain line.
- Timeline, route marker, elevation cursor, and vehicle data stay synchronized.

## Session Files

Each completed recording writes:

- `session.json`: metadata, local-time default name, editable display name, and
  file references.
- `samples.ndjson`: every decoded telemetry sample, one JSON object per line.
- `summary.json`: stats, rule findings, replay frames, lap/session grouping,
  route bounds, and elevation bounds.

## FH6 Data Out

Configure FH6 Data Out to send UDP packets to the desktop app host on port
`5300`. If the game and app run on the same PC, use `127.0.0.1`. If they run on
different machines, use the LAN IP of the machine running this app.

The decoder currently targets the Forza Data Out `Dash` packet shape used by
Horizon-style telemetry and accepts the shorter `Sled` shape for core vehicle
channels. AI/LM Studio analysis is intentionally not included in this phase.
