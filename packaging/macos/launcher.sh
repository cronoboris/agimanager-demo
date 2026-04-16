#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="$APP_ROOT/Resources/web"
TMP_BASE="${TMPDIR:-/tmp}"
PID_FILE="$TMP_BASE/agimanager-launcher.pid"
PORT_FILE="$TMP_BASE/agimanager-launcher.port"
LOG_FILE="$TMP_BASE/agimanager-launcher.log"
HOST="127.0.0.1"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"
CURL_BIN="${CURL_BIN:-/usr/bin/curl}"
OPEN_BIN="${OPEN_BIN:-/usr/bin/open}"

cleanup_previous() {
    if [[ -f "$PID_FILE" ]]; then
        local old_pid
        old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid" 2>/dev/null || true
            sleep 0.4
        fi
        rm -f "$PID_FILE"
    fi
}

pick_port() {
    if [[ -n "${AGI_MANAGER_PORT:-}" ]]; then
        printf '%s\n' "$AGI_MANAGER_PORT"
        return
    fi

    "$PYTHON_BIN" - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

wait_for_server() {
    local url="$1"
    for _ in $(seq 1 40); do
        if "$CURL_BIN" -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.25
    done
    return 1
}

cleanup_previous

if [[ ! -d "$WEB_ROOT" ]]; then
    osascript -e 'display alert "AGI Manager" message "웹 자산을 찾을 수 없습니다. build-release.mjs를 다시 실행해 주세요." as critical'
    exit 1
fi

PORT="$(pick_port)"
printf '%s\n' "$PORT" > "$PORT_FILE"

cd "$WEB_ROOT"
SERVER_PID="$(
AGI_MANAGER_WEB_ROOT="$WEB_ROOT" \
AGI_MANAGER_PORT_VALUE="$PORT" \
AGI_MANAGER_LOG_FILE="$LOG_FILE" \
AGI_MANAGER_PYTHON_BIN="$PYTHON_BIN" \
"$PYTHON_BIN" - <<'PY'
import os
import subprocess

with open(os.environ["AGI_MANAGER_LOG_FILE"], "ab", buffering=0) as log_file:
    process = subprocess.Popen(
        [
            os.environ["AGI_MANAGER_PYTHON_BIN"],
            "-m",
            "http.server",
            os.environ["AGI_MANAGER_PORT_VALUE"],
            "--bind",
            "127.0.0.1",
        ],
        cwd=os.environ["AGI_MANAGER_WEB_ROOT"],
        stdout=log_file,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
print(process.pid)
PY
)"
printf '%s\n' "$SERVER_PID" > "$PID_FILE"

URL="http://$HOST:$PORT/"
if ! wait_for_server "$URL"; then
    kill "$SERVER_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    osascript -e 'display alert "AGI Manager" message "로컬 서버를 시작하지 못했습니다. agimanager-launcher.log를 확인해 주세요." as critical'
    exit 1
fi

if [[ "${AGI_MANAGER_NO_OPEN:-0}" != "1" ]]; then
    "$OPEN_BIN" "$URL"
fi
