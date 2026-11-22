#!/usr/bin/env sh
# One-command installer for Linux:
#   curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/gateway-dashboard/main/install.sh | sh
set -eu

banner() {
  if [ -t 1 ]; then G="$(printf '\033[1;32m')"; C="$(printf '\033[1;36m')"; R="$(printf '\033[0m')"; else G=""; C=""; R=""; fi
  printf '\n%s' "$G"
  cat <<'ART'
 ____   ____     ____                                    _   _         _
|  _ \ |  _ \   / ___|   ___  _ __   ___   ___   _ __   | | | | _   _ | |__
| | | || |_) |  \___ \  / _ \| '_ \ / __| / _ \ | '__|  | |_| || | | || '_ \
| |_| ||  __/    ___) ||  __/| | | |\__ \| (_) || |     |  _  || |_| || |_) |
|____/ |_|      |____/  \___||_| |_||___/ \___/ |_|     |_| |_| \__,_||_.__/
ART
  printf '%s\n%s  ////////////////////  by Dineshpal Singh  ////////////////////%s\n' "$R" "$C" "$R"
  printf '  Milesight IoT dashboard  -  github.com/dineshpalsingh1989/gateway-dashboard\n\n'
}
banner

# New installs store everything on this server (DuckDB): no cloud account needed.
# Set MILESIGHT_STORAGE=firebase to start with the Firebase setup page instead.
STORAGE="${MILESIGHT_STORAGE:-duckdb}"
case "$STORAGE" in duckdb|firebase) ;; *) echo "MILESIGHT_STORAGE must be duckdb or firebase." >&2; exit 1 ;; esac

DIR="${MILESIGHT_DIR:-$HOME/milesight-dashboard}"
SOURCE_DIR="${MILESIGHT_SOURCE_DIR:-}"
if [ -n "$SOURCE_DIR" ]; then SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"; fi

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found - installing it with the official script..."
  curl -fsSL https://get.docker.com | $SUDO sh
fi
if ! docker info >/dev/null 2>&1; then
  if $SUDO docker info >/dev/null 2>&1; then DOCKER="$SUDO docker"; else
    echo "Cannot reach the Docker daemon. Start it (e.g. 'sudo systemctl start docker') and re-run." >&2
    exit 1
  fi
else
  DOCKER="docker"
fi
if ! $DOCKER compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (the 'docker compose' command)." >&2
  exit 1
fi

mkdir -p "$DIR/data"
cd "$DIR"
if [ -n "$SOURCE_DIR" ]; then
  # Test the exact checkout without downloading main or pulling latest.
  for file in Dockerfile docker-compose.yml package.json package-lock.json milesight.js runtime.js sensor-profiles.js downlink.js local-store.js local-api.js local-sdk.js system-status.js telegram-menu.js firebase-setup.js firebase-setup.html firebase.json firestore.rules firestore.indexes.json; do
    cp "$SOURCE_DIR/$file" "$DIR/$file"
  done
else
  curl -fsSL "https://github.com/dineshpalsingh1989/gateway-dashboard/archive/refs/heads/main.tar.gz" \
    | tar -xz --strip-components=1
fi

RUNTIME_UID="$(id -u)"
RUNTIME_GID="$(id -g)"
if [ "$RUNTIME_UID" = "0" ]; then RUNTIME_UID=1000; RUNTIME_GID=1000; fi
if [ ! -f .env ]; then
  (umask 077; printf 'MILESIGHT_UID=%s\nMILESIGHT_GID=%s\n' "$RUNTIME_UID" "$RUNTIME_GID" > .env)
fi

if [ ! -f data/.env ]; then
  TOKEN="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  umask 077
  printf 'FIREBASE_SETUP_TOKEN=%s\n' "$TOKEN" > data/.env
fi
TOKEN="$(sed -n 's/^FIREBASE_SETUP_TOKEN=//p' data/.env | head -n1)"
# Only a fresh install gets a storage choice; an existing one keeps its own.
if [ ! -f data/storage.local.json ] && [ ! -f data/firebase.local.json ]; then
  printf '{"mode":"%s"}\n' "$STORAGE" > data/storage.local.json
fi
MODE="$(sed -n 's/.*"mode" *: *"\([a-z]*\)".*/\1/p' data/storage.local.json 2>/dev/null | head -n1)"
MODE="${MODE:-firebase}"
if [ "$(id -u)" = "0" ]; then
  chown "$RUNTIME_UID:$RUNTIME_GID" data
  for file in data/.env data/storage.local.json data/firebase.local.json data/serviceAccountKey.json; do
    if [ -f "$file" ]; then chown "$RUNTIME_UID:$RUNTIME_GID" "$file"; fi
  done
fi

# Use the published image when available, otherwise build from the source just downloaded
if [ -n "$SOURCE_DIR" ]; then
  $DOCKER compose up -d --build --pull never
elif $DOCKER compose pull -q 2>/dev/null; then
  $DOCKER compose up -d
else
  $DOCKER compose up -d --build
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
IP="${IP:-localhost}"
banner
if [ "$MODE" = "duckdb" ]; then
cat <<EOF
DP Sensor Hub is running. Your data stays on this server.

  Dashboard:     http://$IP:8080
  Setup token:   $TOKEN
  MQTT broker:   $IP:1883

Three steps:
  1. Open http://$IP:8080 and create your account (paste the setup token above).
  2. Create a workspace. Settings shows its MQTT username, password and topic.
  3. Enter those in your Milesight gateway's MQTT settings. Sensors appear on their own.

Prefer Firebase cloud storage? Open http://$IP:8080/setup.
Update later by re-running the install command.
EOF
exit 0
fi
cat <<EOF
DP Sensor Hub is running.

  Dashboard / setup:  http://$IP:8080/setup
  Setup token:        $TOKEN
  MQTT broker:        $IP:1883

Next steps (about 5 minutes):
  1. Copy your Firebase service-account JSON to
       $DIR/data/serviceAccountKey.json
  2. Open the setup page above, enter the token, paste your Firebase web
     config, click Test, then Save.
  3. Apply the changes:  cd $DIR && $DOCKER compose restart
  4. Open http://$IP:8080 and register your account.
  5. Point your Milesight gateway's MQTT settings at $IP port 1883.

Update later by re-running the install command.
EOF
