#!/usr/bin/env bash
# Run from repo root on the server (Plesk Git → post deployment actions).
set -euo pipefail
cd "$(dirname "$0")/.."

ensure_npm() {
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  # Plesk Node.js extension (version dirs vary by host)
  for bin in /opt/plesk/node/*/bin; do
    if [ -x "${bin}/npm" ]; then
      export PATH="${bin}:${PATH}"
      return 0
    fi
  done

  # Some Plesk installs
  for bin in /usr/local/psa/var/modules/nodejs/node*/bin; do
    if [ -x "${bin}/npm" ]; then
      export PATH="${bin}:${PATH}"
      return 0
    fi
  done

  # nodenv next to the site (seen on some subscriptions)
  if [ -x "./nodenv/bin/nodenv" ]; then
    export PATH="$(pwd)/nodenv/bin:${PATH}"
    # shellcheck disable=SC1090
    eval "$(nodenv init -)"
  elif [ -x "${HOME}/nodenv/bin/nodenv" ]; then
    export PATH="${HOME}/nodenv/bin:${PATH}"
    # shellcheck disable=SC1090
    eval "$(nodenv init -)"
  fi

  if [ -f .node-version ] && command -v nodenv >/dev/null 2>&1; then
    nodenv install -s 2>/dev/null || true
  fi

  command -v npm >/dev/null 2>&1
}

if ! ensure_npm; then
  echo "npm not found in PATH."
  echo "In Plesk post-deploy, prepend (adjust version if needed):"
  echo '  export PATH="/opt/plesk/node/26/bin:$PATH"'
  exit 127
fi

echo "Using npm: $(command -v npm)"
npm ci
npm run build
echo "Build finished. Document root should be: $(pwd)/dist"
