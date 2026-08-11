#!/usr/bin/env bash
# Generates a self-signed TLS cert for local LAN testing (camera access
# requires a secure context — HTTPS or localhost — and a phone on the LAN
# can't use localhost). Output goes to tls/cert.pem and tls/key.pem, both
# gitignored; only this script and tls/nginx.conf are tracked.
#
# Usage: scripts/gen-dev-cert.sh [LAN_IP]
# If LAN_IP is omitted, it's auto-detected from the host's first address.
set -euo pipefail

cd "$(dirname "$0")/.."

IP="${1:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
if [ -z "$IP" ]; then
  echo "Could not auto-detect a LAN IP; pass one explicitly:" >&2
  echo "  scripts/gen-dev-cert.sh 192.168.1.x" >&2
  exit 1
fi

mkdir -p tls
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout tls/key.pem -out tls/cert.pem \
  -subj "/CN=binventory.local" \
  -addext "subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost"

echo "Wrote tls/cert.pem and tls/key.pem for ${IP} (and localhost/127.0.0.1)."
echo "Bring up the TLS proxy with:"
echo "  docker compose --profile tls up -d --build"
echo "Then visit: https://${IP}"
