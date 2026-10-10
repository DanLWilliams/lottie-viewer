#!/usr/bin/env bash
# Run from repo root on the server (e.g. Plesk Git → additional deploy actions).
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
npm run build

echo "Build finished. Document root must be: $(pwd)/dist"
