# Changelog

## v2.2.0 - 2026-11-22

- **Telegram alerts.** Leaks, batteries under 20%, devices that stop reporting, and readings outside limits you set send a Telegram message to everyone signed in to the bot, and another when the condition clears. A condition that flaps back within 30 minutes stays quiet. Turn alerts off in Settings → Alerts & energy.
- **Alert limits.** Set "below" and "above" limits per reading under its history chart. The chart draws the limits, circles every reading outside them, and shows the share of time outside; the dashboard's Needs attention panel lists broken limits.
- **Complete long ranges.** The broker now writes an hourly roll-up (count, average, low, high and watt-hours) alongside each reading. 7- and 30-day charts read these, so they cover the whole period instead of the newest 500 readings, and show each hour's low-to-high band. Charts fall back to raw readings for periods before the upgrade.
- **Chart tools.** Compare up to four lines (other readings of the device, or the same reading on other devices) in at most two units with left and right axes; 1-hour, 6-hour and custom date ranges; drag to zoom; CSV export of every line.
- **Daily and Pattern views.** Daily shows energy per day in kWh for power (with cost when a tariff is set in Settings) and daily average with low-to-high for other readings. Pattern is a weekday-by-hour heatmap.
- **Dashboard tools.** Search by name, model, EUI or room; filter by Reporting, Quiet, Silent or Alerts; cards group by room. Set each device's room and report interval in Settings → Devices; a device is quiet after 1.5 intervals and silent after 3.
- **Wall display.** Full screen, larger type, no controls, and scrolls through the dashboard every 15 seconds. Start it from the dashboard or open the dashboard URL with #wall.
- Redesigned the dashboard as a dark operations console: slate background, status-green accent, frosted panels, Fira Sans for text and Fira Code for numbers, and SVG icons. A header toggle switches to a light theme and is remembered per browser.
- Live cues: a header badge shows **Live** with a ticking "updated Xs ago", or **Stale** after 15 minutes without an uplink. Each device card shows a status stripe and dot (reporting, quiet after 15 minutes, silent after 2 hours), and a reading briefly highlights when a new uplink changes it. All motion stops under reduced-motion settings.
- Added a dashboard overview. **Power & load** totals live power (W/kW) and current draw (A), ranks every plug and current-sensor circuit in bar charts, and shows the worst three-phase imbalance. Select a bar to open its history.
- Added **Needs attention**: leaks, batteries under 20%, broken limits, and silent devices.
- History charts show a dashed average line. Power charts add energy in kWh, integrated from the plotted readings; gaps longer than 1 hour are not counted.
- Tests for energy integration, daily and pattern buckets, hourly roll-ups, alert de-duplication, the overview, and local-mode roll-ups and access rules.
- **Firebase mode: deploy the updated `firestore.rules`** for limits, report intervals, rooms, the energy setting and hourly roll-ups.

## v2.1.1 ? 2026-10-18

- Added administrator-selected Firebase cloud or DuckDB local storage. Local mode includes persistent accounts, settings, telemetry, history, and server-checked workspace access.
- Added Telegram command buttons without AI, with optional Gemini selectable independently of storage.
- Added authenticated disk, DuckDB file/WAL, and memory status in Settings and owner-only Telegram `/system`.
- Updated Docker packaging, installation, demo version, and release documentation.
- Storage changes require restart and do not migrate existing data. Local account creation requires the setup token; local mode has no email password reset or social sign-in.


## GitHub Pages demo — 2026-10-18

- Added a self-contained browser demo at https://dineshpalsingh1989.github.io/gateway-dashboard/ with all 24 devices, charts, CSV export, editable settings, and simulated commands/history.
- Added `npm run build:demo` and a GitHub Pages build/deployment workflow.
- Moved demo health checks, connection tests, debug events, and command handling into browser simulations so static hosting needs no Node.js server, Firebase credentials, or MQTT connection.
- Added checks that the generated page contains no unresolved configuration and that demo service operations make no backend requests.

## V2.0 maintenance update — 2026-10-18

### Added

- A local demo at `http://localhost:8081`, started with `npm run demo`, with 24 sample devices, history charts, CSV export, settings, and debug activity. No Firebase credentials are needed.
- Seventeen additional sensor profiles: EM300-SLD/ZLD/MLD/DI, EM400-UDL, EM500-SWL/SMTC/PP, CT101/103/301, VS133/125, TS301/302, EM320-TILT, and WTS506.
- Support for gateway-decoded readings inside `object` and `objectJSON`, plus model identification through `deviceProfileName`.
- A Settings command panel with a device selector, configurable workspace downlink topic, FPort, confirmed-message option, hexadecimal-to-Base64 preview, and UC300 DO1/DO2 presets.
- An authenticated `/downlink` endpoint that checks workspace/device ownership, validates commands, publishes non-retained MQTT messages, and records command attempts and publication status.
- Owner-only command-history reads in Firestore rules. Browser writes to command records remain blocked.
- Tests for command validation, endpoint authorization, publication failure handling, sensor identification, decoded payload wrappers, and demo device coverage.

### Changed

- Downlinks and gateway notification topics are excluded from sensor ingestion; readings use the workspace's `/uplink` topic.
- Additional profiles require an explicit model name or manual selection instead of ambiguous inference from shared metrics.
- UC50x devices are no longer identified as UC300, whose command bytes differ.
- Pipe pressure uses kPa in cards, charts, and CSV; ambient pressure remains in hPa.
- Docker packaging, the installer, and syntax checks include the new runtime modules.
- README documents the demo, sensor payload requirements, gateway configuration, and downlink limitations.

### Validation

- Syntax checks pass. Local tests: 24 passed; one Firestore emulator test skipped because the emulator was not running. CI runs emulator-backed authorization checks.
- Chrome browser check: all 24 cards rendered; a UC300 demo command appeared in history; a history chart opened with CSV export enabled; no JavaScript exceptions were reported.

### Deployment requirements and limits

- Deploy the updated `firestore.rules`, restart the application, and configure the gateway's Embedded Network Server MQTT Downlink Data topic to match `YOUR_WORKSPACE_db/downlink/$deveui`.
- New sensor profiles consume gateway-decoded JSON. They do not provide additional model-specific raw payload decoders; adapt field names and units to `sensor-profiles.js` when necessary.
- Demo readings and commands are simulated. Physical gateways, sensors, live Firebase, and radio delivery were not tested.
- `published` records MQTT broker acceptance, not gateway receipt or sensor execution. ACK/error correlation and external network-server integrations are not implemented.
- Existing release tags are unchanged. This entry describes the maintenance branch, not a new tagged release.
