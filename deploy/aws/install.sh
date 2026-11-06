#!/usr/bin/env bash
# One-time setup of the workspace on the Finlit AWS server (run as the "ubuntu" user, Finlit must already be running).
#
#   curl -fsSL https://raw.githubusercontent.com/pranshukesavmishra/workspace/main/deploy/aws/install.sh | WORKSPACE_DOMAIN=workspace.finlitventures.com bash
#
# WORKSPACE_DOMAIN: the address the team will open. Point a DNS "A" record for it at the server's Elastic IP first.
#   No domain yet? Leave it out: a free address like workspace.13-233-10-20.sslip.io is used (it always points at this server).
# Safe to run again (e.g. to change the domain): it keeps the data, the passcode and the settings.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/pranshukesavmishra/workspace.git}"
WS_HOME="${WS_HOME:-/opt/workspace}"
FINLIT_HOME="${FINLIT_HOME:-/opt/finlit}"
CADDY_EXTRA="$FINLIT_HOME/caddy-extra"
say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker is not installed. This script is meant for the Finlit server."
docker network inspect finlit_default >/dev/null 2>&1 || die "Finlit is not running here (Docker network finlit_default not found)."
CADDY="$(docker ps -q -f label=com.docker.compose.project=finlit -f label=com.docker.compose.service=caddy | head -n1)"
[ -n "$CADDY" ] || die "Finlit's caddy container is not running."
docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "$CADDY" | grep -q '/etc/caddy/extra' || die \
  "Finlit's Caddy does not load extra sites yet. Merge the Finlit change that adds 'import /etc/caddy/extra/*.caddy' and wait for its deploy, then run this again."

DOMAIN="${WORKSPACE_DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS --max-time 10 https://checkip.amazonaws.com | tr -d '[:space:]')"
  [ -n "$IP" ] || die "Could not find this server's public IP. Set WORKSPACE_DOMAIN."
  DOMAIN="workspace.${IP//./-}.sslip.io"
fi
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "WORKSPACE_DOMAIN looks wrong: $DOMAIN"

say "Folders in $WS_HOME"
sudo install -d -o "$(id -u)" -g "$(id -g)" "$WS_HOME"
sudo install -d -o 1000 -g 1000 "$WS_HOME/data"      # the container runs as uid 1000 (node)

if [ -d "$WS_HOME/src/.git" ]; then
  say "Updating the code"
  git -C "$WS_HOME/src" fetch -q origin main && git -C "$WS_HOME/src" reset -q --hard origin/main
else
  say "Downloading the code"
  git clone -q "$REPO_URL" "$WS_HOME/src"
fi

if [ ! -f "$WS_HOME/.env" ]; then
  PASS="$(tr -dc 'a-z0-9' </dev/urandom | head -c 8 || true)"
  cat > "$WS_HOME/.env" <<EOF
APP_NAME=Finlit Workspace
TEAM_PASSCODE=$PASS
MAX_UPLOAD_MB=25
# Optional: better voice-to-text (see .env.example in the repo)
# WHISPER_API_KEY=
# Optional: off-server copies in an S3 bucket (see .env.example)
# S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
# S3_REGION=ap-south-1
# S3_BUCKET=
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
EOF
  chmod 600 "$WS_HOME/.env"
  say "Created $WS_HOME/.env with a new team passcode"
fi

say "Building and starting the workspace container"
cd "$WS_HOME/src"
ENV_FILE="$WS_HOME/.env" docker compose -f deploy/aws/docker-compose.yml up -d --build
docker image prune -f >/dev/null

say "Adding https://$DOMAIN to Finlit's Caddy"
sudo install -d "$CADDY_EXTRA"
sudo tee "$CADDY_EXTRA/workspace.caddy" >/dev/null <<EOF
# Finlit Workspace (https://github.com/pranshukesavmishra/workspace), written by its install.sh
$DOMAIN {
	encode zstd gzip
	request_body {
		max_size 120MB
	}
	reverse_proxy finlit-workspace:3000
}
EOF
# Finlit's Caddyfile has "admin off", so a reload means a restart (a second or two).
docker restart "$CADDY" >/dev/null

say "Automatic updates (checks GitHub every 5 minutes)"
sudo tee /etc/systemd/system/finlit-workspace-update.service >/dev/null <<EOF
[Unit]
Description=Update Finlit Workspace from GitHub
After=docker.service
[Service]
Type=oneshot
User=$(id -un)
Environment=WS_HOME=$WS_HOME
ExecStart=/bin/bash $WS_HOME/src/deploy/aws/update.sh
EOF
sudo tee /etc/systemd/system/finlit-workspace-update.timer >/dev/null <<'EOF'
[Unit]
Description=Check for Finlit Workspace updates every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now finlit-workspace-update.timer >/dev/null

say "Waiting for the certificate…"
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$DOMAIN/api/ping" || true)"
  [ "$code" = 200 ] && break
  sleep 3
done

echo
echo "  Finlit Workspace:  https://$DOMAIN"
echo "  Team passcode:     $(grep -E '^TEAM_PASSCODE=' "$WS_HOME/.env" | cut -d= -f2-)"
echo "  Data:              $WS_HOME/data   (database + uploads, daily snapshots in $WS_HOME/data/backups)"
[ "${code:-}" = 200 ] || echo "  (Not answering on https yet. For a custom domain the DNS A record must point here. Check: docker logs $CADDY --tail 30)"
echo
echo "  The first person to open the link and add their name becomes the lead."
