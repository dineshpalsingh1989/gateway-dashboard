#!/usr/bin/env sh
# One-command installer for Linux:
#   curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main/install.sh | sh
set -eu

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
  for file in Dockerfile docker-compose.yml package.json package-lock.json milesight.js runtime.js firebase-setup.js firebase-setup.html firebase.json firestore.rules firestore.indexes.json; do
    cp "$SOURCE_DIR/$file" "$DIR/$file"
  done
else
  curl -fsSL "https://github.com/dineshpalsingh1989/milesight-dashboard/archive/refs/heads/main.tar.gz" \
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
if [ "$(id -u)" = "0" ]; then
  chown "$RUNTIME_UID:$RUNTIME_GID" data
  for file in data/.env data/firebase.local.json data/serviceAccountKey.json; do
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
cat <<EOF

Milesight Dashboard is running.

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
