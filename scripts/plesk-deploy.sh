#!/usr/bin/env bash
# Plesk Git → post deployment actions (Node.js can stay DISABLED for the live site).
# This only needs the npm binary on the server to build into dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

find_npm() {
  if [ -n "${NPM:-}" ] && [ -x "$NPM" ]; then
    echo "$NPM"
    return 0
  fi
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi
  local candidate
  for candidate in /opt/plesk/node/*/bin/npm; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  for candidate in /usr/local/psa/var/modules/nodejs/node*/bin/npm; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

NPM="$(find_npm)" || {
  echo "Could not find npm. Set NPM in post-deploy, e.g.:"
  echo '  NPM=/opt/plesk/node/26/bin/npm bash scripts/plesk-deploy.sh'
  exit 127
}

echo "Using: $NPM"
echo "Installing dependencies (required before build)..."
"$NPM" ci
if [ ! -d node_modules/fflate ]; then
  echo "fflate missing after npm ci — check package-lock.json is committed and up to date."
  exit 1
fi
echo "Building..."
"$NPM" run build
echo "Done. Site document root should be: $(pwd)/dist"
