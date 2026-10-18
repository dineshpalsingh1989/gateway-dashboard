#!/usr/bin/env sh
# One-command installer for Linux:
#   curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main/install.sh | sh
set -eu

REPO_RAW="https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main"
DIR="${MILESIGHT_DIR:-$HOME/milesight-dashboard}"

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
curl -fsSL "https://github.com/dineshpalsingh1989/milesight-dashboard/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1

if [ ! -f data/.env ]; then
  TOKEN="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  umask 077
  printf 'FIREBASE_SETUP_TOKEN=%s\n' "$TOKEN" > data/.env
fi
TOKEN="$(sed -n 's/^FIREBASE_SETUP_TOKEN=//p' data/.env | head -n1)"

# Use the published image when available, otherwise build from the source just downloaded
if $DOCKER compose pull -q 2>/dev/null; then
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
