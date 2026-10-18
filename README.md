<p align="center"><img src="docs/banner.svg" alt="Milesight Dashboard" width="100%"></p>

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-broker-660066?logo=mqtt&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)

A self-hosted, single-file platform for **Milesight IoT sensors** (LoRaWAN) connected through a Milesight gateway. It runs an MQTT broker, serves a live web dashboard and stores readings in Firebase Firestore, with no build step.

Everything lives in [milesight.js](./milesight.js).

## Features

- **Built-in MQTT broker** (port 1883, optional TLS on 8883). Each account gets its own credentials and topic namespace, checked on every connection and message.
- **Live web dashboard** (port 8080) with real-time updates, per-sensor history charts (latest 500 readings per period) and CSV export.
- **Automatic Milesight device recognition.** Models are detected from the gateway's device name, or from the payload shape when no name is given.
- **Built-in Milesight payload decoder.** It decodes the raw channel/type frames, including battery, temperature, humidity, CO₂, pressure and attributes such as firmware version.
- **Multi-user workspaces.** Owners add members by email, and invite links grant nothing on their own.
- **Telegram assistant.** Ask about your sensors in plain language (powered by Gemini). Sign-up and sign-in happen entirely from Telegram.
- **Storage quota management.** The oldest readings are pruned automatically before the 1 GB quota is reached.
- **Locked-down Firestore rules.** Secrets such as bot tokens, AI keys and broker passwords can never be read from the browser.

## Supported devices

| Model | Type | Metrics |
|-------|------|---------|
| EM300-TH | Temperature & humidity | temperature, humidity, battery |
| EM300-MCS | Door contact | magnet status, battery |
| AM300 | Ambient monitoring | temperature, humidity, CO₂, pressure, battery |
| WS523 | Smart plug | power, current, voltage, switch status |
| UC300 | Controller | DI 1/2, AI 1, battery |
| TS201 | Temperature probe | temperature, probe temperature, battery |
| VS121 | Workplace occupancy | people count, region counts (`region_1`…`region_16`) |

Unrecognised devices are still stored, under a generic `value` metric.

## Architecture

![Architecture](docs/architecture.svg)

## Quick start

Requires Node.js 18 or later and a Firebase project.

1. `npm install`
2. Copy `.env.example` to `.env` and adjust.
3. Put your Firebase service account key at the path in `FIREBASE_SERVICE_ACCOUNT_PATH` (never commit it).
4. `npm start`
5. Open `http://localhost:8080` and register an account.

### Connect your Milesight gateway

In the gateway's MQTT / data-transmission settings, point it at this server:

- **Host:** this machine's address (or `BROKER_DOMAIN`)
- **Port:** `1883` (or `8883` with TLS)
- **Username / password:** the broker credentials created in the dashboard

Uplinks published by the gateway are decoded, stored and shown live.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `MQTT_PORT` | `1883` | MQTT broker port |
| `WEB_PORT` | `8080` | Dashboard port |
| `BROKER_DOMAIN` | auto-detected | Hostname shown for gateway setup |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `./serviceAccountKey.json` | Admin SDK key |
| `TLS_CERT_PATH`, `TLS_KEY_PATH` | unset | Enable MQTT over TLS |
| `MQTT_TLS_PORT` | `8883` | TLS MQTT port |
| `VITE_FIREBASE_*` | built-in block | Override the Firebase web config |

## Firebase setup

Enable Email/Password authentication (plus any social providers you use) in Firebase Authentication, and add your dashboard hostname to the authorized domains.

The access rules in [firestore.rules](./firestore.rules) restrict dashboard data to its workspace owner. Members use the Telegram assistant and can look up only their own verified email membership. Server writes use the Admin SDK.

Deploy the rules to your project:

```sh
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

No composite indexes are needed. The empty [firestore.indexes.json](./firestore.indexes.json) records that.

## Testing

```sh
npm run check   # server syntax check
npm test        # dashboard regression tests
```

Neither needs Firebase credentials or running services.

The Firestore authorization test runs only when `FIRESTORE_EMULATOR_HOST` is set. With Java and the Firebase CLI installed:

```sh
firebase emulators:exec --only firestore --project demo-milesight "npm test"
```

It checks owner access, cross-workspace denial, secret protection, verified email lookup and rejection of forged telemetry. It writes fixture documents, so use a dedicated local emulator. It never touches production. Run it before deploying rules.

## Notes

- History shows up to the latest 500 readings in the selected period. Switching sensor, metric or period discards earlier pending requests.
- The chart labels capped results, offers retry after a failed query, and enables CSV export only once readings have loaded.
- The running version, build date and full changelog are available in the dashboard's **About** panel and at `/health`.
