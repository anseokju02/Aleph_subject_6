#!/usr/bin/env bash
set -euo pipefail

pnpm dev --host 127.0.0.1 --port 5173 >/tmp/plan-do-see-vite.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5173/ >/dev/null; then
    break
  fi
  sleep 1
done

node scripts/behavior-check.mjs
