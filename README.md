# Milesight Dashboard

<p align="center"><img src="docs/banner.svg" alt="Milesight Dashboard" width="100%"></p>

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-broker-660066?logo=mqtt&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)

A self-hosted platform for **Milesight IoT sensors** (LoRaWAN) connected through a Milesight gateway. It runs an MQTT broker, serves a live web dashboard and stores readings in Firebase Firestore, with no build step.

The services live in [milesight.js](./milesight.js), with a standalone Firebase setup page in [firebase-setup.html](./firebase-setup.html) and its server in [firebase-setup.js](./firebase-setup.js).

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

### One-command install (Linux)

```sh
curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main/install.sh | sh
```

The script installs Docker if it is missing, downloads the dashboard to `~/milesight-dashboard`, starts it, and prints the setup URL and token. Then:

1. Create a free [Firebase project](https://console.firebase.google.com/) and enable **Firestore** and **Authentication → Email/Password**.
2. Download a service-account key (Project settings → Service accounts → Generate new private key) and save it as `~/milesight-dashboard/data/serviceAccountKey.json`.
3. Open the printed `/setup` URL, enter the token, paste your Firebase web config, click **Test**, then **Save**.
4. Run `cd ~/milesight-dashboard && docker compose restart`, open `http://<server-ip>:8080` and register.
5. Point your Milesight gateway's MQTT settings at `<server-ip>` port `1883`.

All state lives in `~/milesight-dashboard/data`. To update, re-run the install command. To stop, run `docker compose down` in that folder.

### From source

Requires Node.js 18 or later and a Firebase project.

1. `npm install`
2. Optionally copy `.env.example` to `.env` to adjust ports and server settings.
3. Run `npm start`, then open `http://localhost:8080/setup`.
4. Enter the administrator setup token printed in the server console and click **Unlock & load settings**.
5. Enter your Firebase web configuration, or paste its JSON object. No Firebase project or key is bundled with the source.
6. Put your private service-account JSON file on the server (never commit it), and enter its file path. The default is `./serviceAccountKey.json`.
7. Click **Test Firebase connection**, review each result, then **Save configuration**.
8. Restart the server, deploy the Firestore rules below, then open the dashboard and register an account.

Missing or invalid Firebase configuration opens setup mode; the broker stays offline until Firebase is configured. To make later changes, use **Settings → Firebase → Configure Firebase & test connection**, or visit `/setup` directly. Use HTTPS when accessing setup on a remote server.

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
| `VITE_FIREBASE_*` | saved setup values | Override the Firebase web config |
| `FIREBASE_SETUP_TOKEN` | generated each startup | Administrator token for `/setup` |

## Firebase setup

Settings are saved to the ignored `firebase.local.json` in the server's working directory. Preserve this file and your service-account file across deployments. The private key remains in the service-account file and is never returned to the browser. `VITE_FIREBASE_*` and `FIREBASE_SERVICE_ACCOUNT_PATH` environment variables take precedence over saved values; the page lists active overrides. Set `FIREBASE_SETUP_TOKEN` in `.env` to keep the administrator token stable across restarts.

The connection test uses the values entered in the form. It checks Authentication API-key acceptance, service-account project matching, and Firestore write/read/delete access using a temporary `_setupProbes` document. Failed cleanup is reported as a failed test; remove any leftover probe in Firebase Console if necessary. Testing and saving do not change the running configuration until you restart.

The server test cannot verify browser security rules, enabled sign-in providers, authorized domains, or whether the web API key belongs to the entered project. Complete the checklist on the page and verify sign-in after restarting. See Firebase's [Admin SDK setup](https://firebase.google.com/docs/admin/setup) and [Authentication REST API](https://firebase.google.com/docs/reference/rest/auth) for the separate server credential and web key.

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
npm test        # dashboard, MQTT authorization and setup regression tests
```

Neither needs Firebase credentials or running services.
Setup regression tests simulate Google responses; live connection checks run from the setup page.

The Firestore authorization test runs only when `FIRESTORE_EMULATOR_HOST` is set. With Java and the Firebase CLI installed:

```sh
firebase emulators:exec --only firestore --project demo-milesight "npm test"
```

It checks owner access, cross-workspace denial, secret protection, verified email lookup and rejection of forged telemetry. It writes fixture documents, so use a dedicated local emulator. It never touches production. Run it before deploying rules.

## Notes

- History shows up to the latest 500 readings in the selected period. Switching sensor, metric or period discards earlier pending requests.
- The chart labels capped results, offers retry after a failed query, and enables CSV export only once readings have loaded.
- The running version, build date and full changelog are available in the dashboard's **About** panel and at `/health`.
