#!/usr/bin/env bash
set -euo pipefail

echo "=== Handling SSL Certificates ==="
# Define a path in the node user's home directory
USER_CERT_PATH="$HOME/.npm-ca.crt"

if [[ -n "${CERT_PATH:-}" && -f "${CERT_PATH}" ]]; then
  echo "=== Copying cert to $USER_CERT_PATH ==="
  cp "${CERT_PATH}" "$USER_CERT_PATH"

  # Tell NPM to use this specific file for SSL verification
  npm config set cafile "$USER_CERT_PATH"

  # Optional: Tell Node.js runtime to trust this CA
  export NODE_EXTRA_CA_CERTS="$USER_CERT_PATH"
else
  echo "=== No optional cert supplied ==="
fi

echo "=== Installing npm dependencies (dev) ==="
npm ci
export PATH="$HOME/.local/bin:$PATH"
