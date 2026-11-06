#!/usr/bin/env bash
# Run by the systemd timer every 5 minutes (installed by install.sh): if GitHub "main" has a new commit,
# rebuild and restart the workspace container. Data in /opt/workspace/data is never touched.
#   bash update.sh        check now
#   bash update.sh logs   show the app's recent logs
# Everything is inside main() so bash has read the whole file before "git reset" replaces it.
set -uo pipefail
main() {
WS_HOME="${WS_HOME:-/opt/workspace}"
cd "$WS_HOME/src" || return 1
compose() { ENV_FILE="$WS_HOME/.env" docker compose -f deploy/aws/docker-compose.yml "$@"; }

if [ "${1:-}" = logs ]; then docker logs --tail 100 -f finlit-workspace; return; fi

git fetch -q origin main || { echo "git fetch failed"; return 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && return 0

echo "$(date '+%F %T') updating $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)"
git reset -q --hard origin/main
compose up -d --build && docker image prune -f >/dev/null
}
main "$@"; exit $?
