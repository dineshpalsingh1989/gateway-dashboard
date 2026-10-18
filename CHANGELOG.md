# Changelog

## GitHub Pages demo — 2026-10-18

- Added a self-contained browser demo at https://dineshpalsingh1989.github.io/milesight-dashboard/ with all 24 devices, charts, CSV export, editable settings, and simulated commands/history.
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
