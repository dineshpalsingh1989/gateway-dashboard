#!/usr/bin/env sh
# One-command installer for Linux:
#   curl -fsSL https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main/install.sh | sh
set -eu

REPO_RAW="https://raw.githubusercontent.com/dineshpalsingh1989/milesight-dashboard/main"
DIR="${MILESIGHT_DIR:-$HOME/milesight-dashboard}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install it first:  curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
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
if docker compose pull -q 2>/dev/null; then
  docker compose up -d
else
  docker compose up -d --build
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
IP="${IP:-localhost}"
cat <<EOF

Milesight Dashboard is running.

  Dashboard / setup:  http://$IP:8080/setup
  Setup token:        $TOKEN
  MQTT broker:        $IP:1883

First run: copy your Firebase service-account JSON to
  $DIR/data/serviceAccountKey.json
then open the setup page, enter your Firebase web settings, test, save,
and run:  cd $DIR && docker compose restart

Update later by re-running the install command.
EOF
