# DP Sensor Hub v2.2.0

<p align="center"><img src="docs/banner.svg" alt="DP Sensor Hub" width="100%"></p>

[![CI](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/ci.yml)
[![Install test](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/install-test.yml/badge.svg)](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/install-test.yml)
[![Package build](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/package.yml/badge.svg)](https://github.com/dineshpalsingh1989/gateway-dashboard/actions/workflows/package.yml)

[Live demo](https://dineshpalsingh1989.github.io/gateway-dashboard/) · [Releases](https://github.com/dineshpalsingh1989/gateway-dashboard/releases) · [Report a bug](https://github.com/dineshpalsingh1989/gateway-dashboard/issues/new/choose) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

A self-hosted MQTT broker and live dashboard for **Milesight gateways and sensors**. Point your gateway at it, and every sensor appears on its own: live values, charts, power and energy, alerts in Telegram, and remote commands. Store data on your own server (DuckDB) or in the cloud (Firebase).

**DP Sensor Hub is an independent project, not affiliated with or endorsed by Milesight. Milesight is a trademark of its respective owner.**

The GitHub repository is `gateway-dashboard`; installation and demo links below use that address. Existing installation paths, database names, and environment variables remain supported.

## What's new in v2.2

<p align="center"><img src="docs/whats-new.svg" alt="Nine upgrades in v2.2: Telegram alerts, alert limits, full 30-day history, compare and zoom, daily energy and cost, weekly pattern, rooms and search, wall display, and a new look with live cues" width="100%"></p>

| Update | What you get |
| --- | --- |
| 🔔 **Telegram alerts** | Leaks, batteries under 20%, devices that stop reporting, and readings outside your limits message everyone signed in to the bot, plus a "back to normal" message when they clear. |
| 🌡️ **Alert limits** | Set "below" and "above" values under any chart. The chart draws the limits, rings every reading outside them, and shows the share of time outside. |
| 📅 **Full 30-day history** | The server keeps an hourly summary of every reading, so 7- and 30-day charts cover the whole period, with each hour's low-to-high band. |
| 🔍 **Compare and zoom** | Up to four lines on one chart (two units, left and right axes). 1-hour, 6-hour and custom date ranges. Drag across a chart to zoom. |
| ⚡ **Daily energy and cost** | kWh per day for smart plugs, priced with your electricity tariff. Live load, current draw and three-phase imbalance on the dashboard. |
| 🗓️ **Weekly pattern** | A weekday-by-hour heatmap: see when rooms fill up and when power peaks. |
| 🏠 **Rooms and search** | Group sensors by room, search by name, model or EUI, and filter to Reporting, Quiet, Silent or Alerts. |
| 📺 **Wall display** | Full screen, big type, no buttons, scrolls through the dashboard on its own. Open the dashboard with `#wall`. |
| 🌙 **New look, live cues** | A dark operations console (with a light theme toggle), a ticking **Live** badge, and a status stripe on every device card. |

Full details: [v2.2.0 release notes](docs/releases/v2.2.0.md) · [CHANGELOG.md](CHANGELOG.md)

### See it

| | |
| --- | --- |
| ![Dashboard with power and load overview, needs-attention list and live badge](docs/screenshots/dashboard.png) **Live dashboard.** Power and load, needs attention, live badge. | ![Light theme of the same dashboard](docs/screenshots/light.png) **Light theme.** One click on the sun/moon button. |
| ![Cold-storage temperature chart with an alert limit line and red rings on readings above it](docs/screenshots/chart-limits.png) **Alert limits.** Readings above −17.8 °C are ringed in red. | ![Three phase currents compared on one chart with solid, dashed and dotted lines](docs/screenshots/compare.png) **Compare.** Three phases on one chart. |
| ![Daily energy bars in kWh for a smart plug over 30 days](docs/screenshots/daily-energy.png) **Daily energy.** kWh per day, with cost from your tariff. | ![Weekday by hour heatmap of office temperature](docs/screenshots/pattern.png) **Weekly pattern.** Weekday × hour heatmap. |
| ![Wall display mode with large type and no controls](docs/screenshots/wall.png) **Wall display.** For a monitor in the control room. | **Try it yourself:** the [live demo](https://dineshpalsingh1989.github.io/gateway-dashboard/) has all 24 sample sensors and every feature above. |

## How an alert reaches you

![A freezer warms above its limit, the hub notices, your phone gets a Telegram message, and a back-to-normal message follows](docs/alert-flow.svg)

1. Connect a Telegram bot in **Settings → Telegram**, and sign in to it from your phone.
2. Open any reading's chart, enter **Below** and/or **Above**, and select **Save limits**.
3. That's it. Every uplink is checked against your limits, and silent devices are checked every 5 minutes. Leaks and batteries under 20% are checked automatically, without limits.

An alert is sent once when a problem starts and once when it clears. If it flaps back within 30 minutes, it stays quiet. Turn alerts off in **Settings → Alerts & energy**. Set your electricity price there too, to see cost on power charts.

## Supported sensors

![The 24 supported Milesight sensors as cartoon characters in six families](docs/sensor-family.svg)

Every sensor gets live values, sparklines, charts (trend, daily and pattern), compare, CSV export, alert limits, rooms and silent-device alerts. Sensors with a battery also get low-battery alerts. The last column lists what each one adds.

| Family | Model | What it is | Readings shown | Extras |
| --- | --- | --- | --- | --- |
| Air & climate | **EM300-TH** | Temperature & humidity | Temperature, humidity, battery | |
| | **AM300** | Indoor air quality | Temperature, humidity, CO₂, pressure, battery (TVOC and light when reported) | |
| | **TS201** | Temperature probe | Temperature, probe temperature, battery | Cold-room limits |
| | **TS301** | Temperature sensor | Temperature, battery | Cold-room limits |
| | **TS302** | Dual-probe temperature | Two temperatures, battery | Compare both probes |
| Power & energy | **WS523** | Smart plug | Power, current, voltage, switch status | Live load, daily kWh and cost |
| | **CT101**, **CT103** | Current transformer | Current | Current-draw bars |
| | **CT301** | Three-phase current | Phase 1, 2 and 3 current | Phase imbalance |
| Water & leaks | **EM300-SLD**, **EM300-ZLD**, **EM300-MLD** | Spot, zone and membrane leak | Leak status, battery | Leak alerts |
| | **EM300-DI** | Pulse counter (water/energy meters) | Pulse count, battery | |
| | **EM400-UDL** | Ultrasonic distance (tanks) | Distance, battery | |
| | **EM500-SWL** | Water level | Water level, battery | |
| | **EM500-PP** | Pipe pressure | Pressure (kPa), battery | |
| People & spaces | **VS121** | Workplace occupancy | People count, regions, dwell time | Weekly pattern |
| | **VS133**, **VS125** | People counting | Total entries and exits | |
| | **EM300-MCS** | Door / window contact | Open or closed, battery | |
| Outdoor & ground | **WTS506** | Weather station | Temperature, humidity, wind speed and direction, rainfall, pressure | |
| | **EM500-SMTC** | Soil | Temperature, moisture, conductivity, battery | |
| | **EM320-TILT** | Tilt | X, Y and Z angles, battery | |
| Control | **UC300** | IoT controller | Digital inputs, analog input, battery | Remote DO1/DO2 commands |

**Something else on your gateway?** Unknown devices still appear, with every numeric field they send. Pick the model by hand in **Settings → Devices** if detection guesses wrong.

### Payload requirements

Use Milesight's official per-model payload codec on the gateway and forward
decoded JSON fields at the top level or inside `object` / `objectJSON`.
Include `devEUI` to identify the device. Set `deviceProfileName` to the model,
include the model in `deviceName`, or select it manually in Settings.
The 17 newer profiles (everything except EM300-TH, EM300-MCS, AM300, WS523, UC300, TS201 and VS121) rely on gateway decoding and do not add model-specific raw decoding.
Field names and units should match [sensor-profiles.js](sensor-profiles.js); adapt gateway codec
output if required. The pipe-pressure profile uses kPa; ambient pressure uses hPa.

## Using the dashboard

- **Open any chart.** Select a reading on a device card, or **View history**. Switch between **Trend**, **Daily** and **Pattern**, pick a range, and use **+ Compare with…** to add lines.
- **Rooms and report intervals.** In **Settings → Devices**, give each device a room and say how often it reports. A device turns *Quiet* after 1.5 intervals and *Silent* after 3. Without an interval: 15 minutes and 2 hours.
- **Electricity price.** In **Settings → Alerts & energy**, enter your price per kWh and currency.
- **Wall display.** Select **Wall display** on the dashboard, or open `http://<server>:8080/#wall` on a kiosk screen. Press Esc to leave.
- **Theme.** The sun/moon button in the header switches between dark and light. Each browser remembers its choice.

## How it works

![Architecture](docs/architecture.svg)

The gateway sends readings to the workspace MQTT uplink topic. The server stores
them in local DuckDB or cloud Firestore, keeps an hourly summary for long charts, and checks alerts. The signed-in dashboard shows live data and history.
Owners can also send commands: dashboard → authenticated server endpoint → MQTT
broker → gateway → sensor.

| Mode | Data location | Sign-in |
| --- | --- | --- |
| Local (DuckDB) | Docker's mounted data folder on your server | Local email/password accounts; administrator token required for registration |
| Cloud (Firebase) | Your Firebase Firestore project | Firebase Authentication |

Select storage at **/setup**, save, and restart. Switching modes keeps their databases separate and does not migrate existing data. In local mode, Gemini still sends workspace summaries to Google if enabled; command buttons require no AI.

## What is included

| Feature | Available now |
| --- | --- |
| Live dashboard | Device cards with status, power and load overview, needs-attention list, search, filters, rooms, live badge, wall display, dark and light themes |
| Charts | Trend, daily and weekly-pattern views; 1 hour to 30 days or custom dates; compare up to four lines; zoom; limits; CSV export |
| Alerts | Telegram messages for leaks, low batteries, silent devices and broken limits, with clear messages |
| Energy | Live load, current draw, three-phase imbalance, daily kWh and cost |
| Sensor profiles | 24 Milesight models (see above), plus any unknown device's numeric fields |
| Two-way MQTT | Incoming readings and owner-authorized command publication through Milesight Embedded Network Server |
| Device commands | Hexadecimal/Base64 preview, configurable topic, FPort, confirmation option, and UC300 DO1/DO2 presets |
| Command history | Server-written attempts and publication status, readable only by the workspace owner |
| Storage options | Local DuckDB or cloud Firebase, selected in server setup |
| Telegram | Fixed command buttons without AI, or optional Gemini sensor questions |
| System status | Server disk capacity/free space, DuckDB file size, and memory usage |
| Local demo | 24 sample devices with every feature, simulated commands, no setup |

## Try the dashboard demo

**[Open the public dashboard demo](https://dineshpalsingh1989.github.io/gateway-dashboard/)**

The GitHub Pages demo runs entirely in your browser. Explore the sample sensors,
charts, CSV export, and simulated device controls without installing anything.
It connects to no real gateway or Firebase project. Reloading resets your changes.

To run the same demo locally:

Use Node.js 22 or 24:

```sh
git clone https://github.com/dineshpalsingh1989/gateway-dashboard.git
cd gateway-dashboard
npm ci
npm run demo
```

Open **http://localhost:8081**. No Firebase configuration or gateway is needed.
Explore the 24 sample devices, open a chart and try **Daily**, **Pattern** and
**+ Compare with…**, or select **Wall display**. In
**Settings → Send a device command**, choose **Pump room controller**, select a
UC300 output preset, review the MQTT preview, and select **Publish command**.
The command appears in **Recent commands** as simulated.

Demo readings and external services are simulated. Changes are temporary and no
radio commands or Telegram alerts are sent. Set `DEMO_PORT` to use a different local port.

### Publish with GitHub Pages

`npm run build:demo` creates a self-contained `dist/index.html`. The
**Dashboard demo** GitHub Actions workflow builds and publishes this artifact
after changes land on `main`. GitHub Pages must use **GitHub Actions** as its
publishing source. Only the generated static demo is uploaded; server credentials
and runtime files are excluded. GitHub Pages hosts the simulated demo, while real
sensor ingestion and commands require the self-hosted backend described below.

## Install on Linux

```sh
curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/gateway-dashboard/main/install.sh | sh
```

The installer installs Docker if needed, starts the dashboard, and prints the setup URL and administrator token. Files are installed under `~/milesight-dashboard`.

## Choose local or cloud storage

Open `/setup`, enter the administrator token, and use **Storage location** to choose **Firebase cloud** or **DuckDB local**. Save and restart the server. In Docker the local database is `~/milesight-dashboard/data/milesight.duckdb` on the host, mounted as `/data/milesight.duckdb`.

Local mode stores accounts, settings, credentials, devices, sensor readings, and command history on this server. Firebase configuration is unnecessary. Register with the administrator setup token and a password of at least ten characters. Local sessions last 24 hours and end on restart. Email password resets and Google/Microsoft sign-in require Firebase mode.

Choose **Command buttons (no AI)** or **Gemini AI** in Telegram Settings, independently of storage. Command mode needs only a Telegram bot token; no Gemini or Ollama is required. Use `/menu` for sensor commands. Owners can use `/system` privately to see server resources. Settings also has **Refresh system status** for disk, memory, and database size. Telegram requires internet, and Gemini mode sends workspace summaries to Google even with local storage.

Switching storage does not migrate data. Each mode retains its own accounts and records. Stop the application before backing up the DuckDB database and WAL, and run one backend process per database file. Existing approximate 1 GB workspace retention still applies. See [v2.1.1 release notes](docs/releases/v2.1.1.md).

## Configure Firebase

![Six-step Firebase setup: create, configure, test, save, deploy rules, and restart](docs/firebase-setup.svg)

1. Create a Firebase project and a Firestore database in Native mode.
2. Enable **Authentication > Email/Password**. Add your dashboard hostname to Authentication's authorized domains. Enable Google or Microsoft sign-in if you plan to use them.
3. Download a service-account JSON key from **Project settings > Service accounts**. Save it on the server as `~/milesight-dashboard/data/serviceAccountKey.json`. Keep it readable only by the container's runtime user; never commit it.
4. Open `http://<server-ip>:8080/setup`. Use HTTPS when accessing setup remotely.
5. Enter the administrator token printed by the installer, then select **Unlock & load settings**.
6. Enter or import the web configuration from **Project settings > General > Your apps**. For Docker, use `./serviceAccountKey.json` as the service-account path: this resolves inside the mounted `/data` directory.
7. Select **Test Firebase connection**, review the results, then **Save configuration**.
8. Deploy the repository's Firestore rules using an installed, signed-in Firebase CLI. Run this from the installation directory. **Upgrading to v2.2? Deploy them again**: limits, rooms, report intervals, the energy tariff and hourly charts need the new rules.

   ```sh
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

9. Restart the container:

   ```sh
   cd ~/milesight-dashboard
   docker compose restart
   ```

10. Open `http://<server-ip>:8080`, register an account, and create a workspace.

Before configuration is complete, setup remains available and MQTT stays offline. Connection tests check API-key acceptance, service-account project matching, and Firestore write/read/delete access. Browser sign-in, authorized domains, and security rules still need to be verified after restarting.

To change Firebase later, open **Settings > Firebase > Configure Firebase & test connection**, or visit `/setup`. Saving requires a restart to apply changes.

## Connect a Milesight gateway

![A reading travels from sensor through the gateway and broker to Firestore and the dashboard](docs/reading-journey.svg)

Copy the connection details from the dashboard's Settings into your gateway's MQTT settings:

| Setting | Value |
| --- | --- |
| Host | Your server address or configured broker domain |
| Port | `1883`, or `8883` when MQTT TLS is configured |
| Username and password | Credentials shown for your workspace |
| Uplink topic | The exact workspace topic shown in Settings, such as `your-workspace_db/uplink` |

Incoming readings appear automatically. Charts of 24 hours or less use every stored reading (up to 500 per line). 7-day, 30-day and custom ranges use hourly summaries, which start with the first uplink after upgrading to v2.2.

For Telegram, enter your bot token in Settings, run the test button, and save. Add members by email and issue their invitation codes from the same page. Everyone signed in to the bot receives alerts.

![Telegram question flow: ask, check access, prepare workspace context, and return an answer](docs/telegram-flow.svg)

## Workspace access

![Gateway, dashboard owner, and Telegram member access paths](docs/workspace-access.svg)

Each gateway uses its workspace MQTT credentials and topic. Owners use Firebase sign-in for dashboard access. Members added by email use the Telegram assistant; membership alone does not grant the owner's dashboard or broker credentials.

## Send commands over MQTT

This integration uses the gateway's **Embedded Network Server**. The gateway
subscribes to downlinks while continuing to publish readings to the uplink topic.

1. Connect the gateway using the workspace broker credentials shown in Settings.
2. Set its MQTT **Downlink Data** topic to `YOUR_WORKSPACE_db/downlink/$deveui`, replacing `YOUR_WORKSPACE_db` with your actual workspace label.
3. Open **Settings → Send a device command** and choose a registered device.
4. Match the downlink topic template, choose FPort (default `85`), and set whether to request LoRaWAN confirmation.
5. Choose a UC300 DO1/DO2 preset, or enter a hexadecimal command from the exact device model/firmware manual.
6. Review the topic and Base64 JSON preview, then select **Publish command**.
7. Check **Recent commands** for publication status and the gateway's packet log for radio delivery.

Custom templates must remain within the workspace namespace and contain
`$deveui`. The dashboard converts 1–51 bytes of
hexadecimal command data to Base64 and publishes non-retained MQTT JSON with
`confirmed`, `fport`, and `data`. Regional radio limits may require shorter commands.
UC300 DO1/DO2 presets follow [Milesight's MQTT control guide](https://support.milesight-iot.com/support/solutions/articles/73000514114-how-to-remotely-control-devices-via-mqtt-on-milesight-gateway).
Other devices use custom commands from their exact model/firmware manual.

Commands require a Firebase owner token and a device in that owner's workspace.
Deploy the updated Firestore rules to read the server-written command history.
`published` means accepted by the broker, **not** gateway receipt or sensor
execution. ACK/error notification correlation is not implemented. Class A
devices generally receive queued downlinks after their next uplink. External
network servers such as ChirpStack need a separate integration.

## Run directly with Node.js

Use Node.js 22 or 24, which are checked in CI.

```sh
git clone https://github.com/dineshpalsingh1989/gateway-dashboard.git
cd gateway-dashboard
npm ci
npm start
```

Open `http://localhost:8080/setup` and follow the Firebase steps above. Place the service-account file in this directory, deploy the rules, then restart with `npm start` after stopping the current process.

Optionally copy `.env.example` to `.env` before starting to customize the server.

## Configuration and saved files

![Docker storage layout: local runtime files are mounted into the container, while readings and user accounts live in Firebase](docs/docker-storage.svg)

For Docker installations, application files live in `data/`:

| File | Purpose |
| --- | --- |
| `data/firebase.local.json` | Saved Firebase setup values |
| `data/serviceAccountKey.json` | Private server credential |
| `data/.env` | Application environment variables and stable setup token |
| `.env` in the installation directory | Compose runtime user/group IDs |

When running directly with Node.js, application files live in the directory where you start the server instead.

Common environment variables:

| Variable | Purpose |
| --- | --- |
| `WEB_PORT`, `MQTT_PORT`, `MQTT_TLS_PORT` | Default ports: `8080`, `1883`, `8883` |
| `FIREBASE_SETUP_TOKEN` | Keep the administrator setup token stable across restarts |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Override the saved service-account path |
| `VITE_FIREBASE_*` | Override saved Firebase web configuration |
| `BROKER_DOMAIN` | Broker domain used for tenant hostnames |
| `TLS_CERT_PATH`, `TLS_KEY_PATH` | Enable MQTT TLS using certificate and key files |

Environment variables override saved settings. Changing container ports also requires updating the published ports in `docker-compose.yml`. TLS files must be accessible inside the container.

Containers run as a non-root user. For manual Compose installations, create `data/` first and set `MILESIGHT_UID` and `MILESIGHT_GID` in the installation directory's `.env` to its owner's non-root numeric IDs. The installer configures these automatically; root installations use UID/GID 1000. Service-account files added afterward must be readable by that runtime user.

## Update, logs, and backups

Run these commands from `~/milesight-dashboard`:

```sh
docker compose logs --tail 100 -f  # View logs; setup tokens may appear here
docker compose restart           # Apply saved configuration
docker compose down              # Stop the dashboard
```

To update, re-run the installation command. Back up `data/` and the installation directory's `.env` securely before updating. Sensor readings live in Firestore and require a separate Firestore backup or export.

The dashboard's About panel and `/health` report the running version and service status after setup is complete.
