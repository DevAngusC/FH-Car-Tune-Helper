# FH6 Tune Lab

FH6 Tune Lab is an unofficial Forza Horizon 6 tuning helper. The repository now contains two independent tools:

- **Web tuning helper**: static HTML/CSS/JS in the repository root.
- **Telemetry desktop tool**: Electron app in `desktop/` for FH6 UDP telemetry recording and replay.

The two tools are intentionally separated. The root website does not import Electron, Node.js, or any desktop telemetry code, so the original web deployment path stays static and deployable.

## Release

Current release branch: `v1.01`

This release is also merged into `main`.

Base branch: `main`

## v1.01 Features

### Web Tuning Helper

- Keeps the existing static deploy model: `index.html`, `styles.css`, and `app.js`.
- Adds deeper tuning encyclopedia content for vehicle layout, engine type, part interactions, tire temperature reading, adjustment timing, and common mistakes.
- Keeps the web app independent from the desktop telemetry app.

### Telemetry Desktop Tool

- Adds a desktop Electron app under `desktop/`.
- Reads FH6 Forza Data Out UDP telemetry on port `5300` by default.
- Provides two modes:
  - `Live Monitor`: realtime vehicle data, UDP listener status, and manual session recording.
  - `Race Review`: recorded session browser, lap/session replay, timeline scrubber, route map, and elevation profile.
- Records raw telemetry samples to `samples.ndjson`.
- Writes session metadata to `session.json`.
- Writes deterministic summary and replay data to `summary.json`.
- Reconstructs the track shape from recorded vehicle `x/z` positions.
- Uses vehicle `y` position as elevation data for uphill/downhill review.
- Supports route coloring by speed, throttle, brake, or plain line.
- Auto-names new recordings with local system time, for example `20260708 19:34`.
- Allows post-session record naming in Race Review.
- Keeps AI/LM Studio analysis out of this phase until telemetry recording and replay are stable.

## Repository Layout

```text
.
├── index.html          # Static web tuning helper entry
├── styles.css          # Static web tuning helper styles
├── app.js              # Static web tuning helper logic
├── desktop/            # Electron telemetry desktop app
│   ├── package.json
│   ├── src/
│   └── test/
└── README.md
```

## Deploy Web Tuning Helper

Deploy the repository root as a static website. No build command is required.

Expected static files:

```text
index.html
styles.css
app.js
```

Do not use `desktop/` as the web publish directory. The desktop app has its own Node/Electron dependencies and is not required for the website.

## Run Telemetry Desktop Tool

```powershell
cd desktop
npm.cmd install
npm.cmd start
```

In FH6 Data Out settings, send UDP telemetry to the machine running the desktop app:

- Same PC: `127.0.0.1`
- Default UDP port: `5300`
- Different PC on LAN: use the desktop app machine's LAN IP

## Test

Root web syntax check:

```powershell
node --check app.js
```

Desktop telemetry tests:

```powershell
cd desktop
npm.cmd test
```

## Session Files

Recorded telemetry sessions are stored by the desktop app under Electron `userData` unless `FH6_TELEMETRY_SESSION_DIR` is set.

Each completed recording contains:

- `session.json`: session metadata and display name.
- `samples.ndjson`: full raw telemetry sample stream.
- `summary.json`: stats, rule findings, replay frames, lap grouping, route bounds, and elevation bounds.

## Notes

- FH6 telemetry does not provide an official race map image. The desktop app rebuilds route shape from recorded vehicle positions.
- Tire pressure and tire inner/middle/outer temperature fields are shown only if FH6 Data Out exposes them in the decoded telemetry packet.
- `co-driver-reference/` is a local research folder only and is ignored by git.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

FH6 Tune Lab is an unofficial fan-made tuning helper. Forza, Forza Horizon, Xbox, and Microsoft are trademarks or registered trademarks of their respective owners.
