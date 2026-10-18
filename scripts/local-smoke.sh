#!/usr/bin/env bash
set -euo pipefail

pnpm dev --host 127.0.0.1 --port 5173 >/tmp/plan-do-see-vite.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5173/ >/tmp/plan-do-see-home.html; then
    break
  fi
  sleep 1
done

curl -fsS 'http://127.0.0.1:5173/api/data?sort=priority' >/tmp/plan-do-see-state.json
node -e '
const data = require("/tmp/plan-do-see-state.json");
const summary = {
  plans: data.plans?.length,
  selectedPlanId: data.selectedPlanId,
  visibleTasks: data.tasks?.length,
  review: data.review,
  sortLabel: data.sortLabel,
  today: data.today,
  firstTask: data.tasks?.[0]?.title,
};
if (summary.plans !== 7) throw new Error(`expected 7 plans, got ${summary.plans}`);
if (!summary.visibleTasks || summary.visibleTasks < 5) throw new Error("expected at least 5 tasks");
if (summary.sortLabel !== "우선순위 높은 순") throw new Error("server sort label mismatch");
console.log(JSON.stringify(summary, null, 2));
'
