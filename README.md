# Milesight Dashboard V2.0

<p align="center"><img src="docs/banner.svg" alt="Milesight Dashboard" width="100%"></p>

[![CI](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/ci.yml)
[![Install test](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/install-test.yml/badge.svg)](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/install-test.yml)
[![Package build](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/package.yml/badge.svg)](https://github.com/dineshpalsingh1989/milesight-dashboard/actions/workflows/package.yml)

[Releases](https://github.com/dineshpalsingh1989/milesight-dashboard/releases) · [Report a bug](https://github.com/dineshpalsingh1989/milesight-dashboard/issues/new/choose) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

A self-hosted MQTT broker and live dashboard for Milesight gateways, with Firebase Firestore storage and an optional Telegram assistant.

![Architecture](docs/architecture.svg)

## Install on Linux

```sh
curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main/install.sh | sh
```

The installer installs Docker if needed, starts the dashboard, and prints the setup URL and administrator token. Files are installed under `~/milesight-dashboard`.

## Configure Firebase

![Six-step Firebase setup: create, configure, test, save, deploy rules, and restart](docs/firebase-setup.svg)

1. Create a Firebase project and a Firestore database in Native mode.
2. Enable **Authentication > Email/Password**. Add your dashboard hostname to Authentication's authorized domains. Enable Google or Microsoft sign-in if you plan to use them.
3. Download a service-account JSON key from **Project settings > Service accounts**. Save it on the server as `~/milesight-dashboard/data/serviceAccountKey.json`. Keep it readable only by the container's runtime user; never commit it.
4. Open `http://<server-ip>:8080/setup`. Use HTTPS when accessing setup remotely.
5. Enter the administrator token printed by the installer, then select **Unlock & load settings**.
6. Enter or import the web configuration from **Project settings > General > Your apps**. For Docker, use `./serviceAccountKey.json` as the service-account path: this resolves inside the mounted `/data` directory.
7. Select **Test Firebase connection**, review the results, then **Save configuration**.
8. Deploy the repository's Firestore rules using an installed, signed-in Firebase CLI. Run this from the installation directory:

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

Incoming readings appear automatically. Use **View history** to chart up to the latest 500 stored readings in a selected period and download CSV.

For Telegram, enter your bot token and Gemini API key in Settings, run their test buttons, and save. Add members by email and issue their invitation codes from the same page.

## Run directly with Node.js

Use Node.js 22 or 24, which are checked in CI.

```sh
git clone https://github.com/dineshpalsingh1989/milesight-dashboard.git
cd milesight-dashboard
npm ci
npm start
```

Open `http://localhost:8080/setup` and follow the Firebase steps above. Place the service-account file in this directory, deploy the rules, then restart with `npm start` after stopping the current process.

Optionally copy `.env.example` to `.env` before starting to customize the server.

## Configuration and saved files

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
