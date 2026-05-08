#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
NODE_BIN="$ROOT_DIR/.tools/node-v24.15.0-darwin-arm64/bin"

export PATH="$NODE_BIN:$PATH"
exec node "$@"
