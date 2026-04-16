#!/bin/bash
set -euo pipefail

TMP_BASE="${TMPDIR:-/tmp}"
PID_FILE="$TMP_BASE/agimanager-launcher.pid"
PORT_FILE="$TMP_BASE/agimanager-launcher.port"

if [[ -f "$PID_FILE" ]]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null || true
        sleep 0.3
    fi
    rm -f "$PID_FILE"
fi

rm -f "$PORT_FILE"
