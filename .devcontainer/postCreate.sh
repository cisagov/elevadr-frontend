#!/usr/bin/env bash
set -euo pipefail

USER_CERT_PATH="$HOME/.npm-ca.crt"

if [[ -n "${SSL_CERT_FILE}" && -f "${SSL_CERT_FILE:-}" && -f "${SSL_CERT_FILE}" ]]; then
  cp "${SSL_CERT_FILE}" "$USER_CERT_PATH"

  pnpm config set cafile "$USER_CERT_PATH"
  pip config set global.cert "$USER_CERT_PATH"

  export NODE_EXTRA_CA_CERTS="$USER_CERT_PATH"
else
  echo "=== No optional cert supplied ==="
fi

git config core.fileMode false

echo "=== Installing pnpm dependencies (dev) ==="
pnpm install
pip install pre-commit
pre-commit install && pre-commit install-hooks
