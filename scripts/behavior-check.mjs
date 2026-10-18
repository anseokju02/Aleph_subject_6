const origin = "http://127.0.0.1:5173";

async function json(path, options) {
  const response = await fetch(`${origin}${path}`, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error ?? response.status}`);
  return payload;
}

async function post(payload) {
  return json("/api/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const initial = await json("/api/data");
const planId = initial.selectedPlanId;
const baseline = {
  planned: Number(initial.review.planned_count),
  completed: Number(initial.review.completed_count),
  executions: Number(initial.review.execution_count),
};

const originalPlan = initial.plans.find((plan) => plan.id === planId);
await post({
  action: "update_plan",
  id: planId,
  title: originalPlan.title,
  periodStart: originalPlan.period_start,
  periodEnd: originalPlan.period_end,
  priority: originalPlan.priority,
  successCriteria: originalPlan.success_criteria,
  estimatedMinutes: originalPlan.estimated_minutes,
  nextPlan: `${originalPlan.next_plan} [동일 ID 검사]`,
});
const afterPlanEdit = await json(`/api/data?planId=${planId}`);
const editedPlan = afterPlanEdit.plans.find((plan) => plan.id === planId);
if (!editedPlan || editedPlan.external_id !== originalPlan.external_id || !editedPlan.next_plan.includes("동일 ID 검사")) {
  throw new Error("plan edit did not preserve the same ID");
}
await post({
  action: "update_plan",
  id: planId,
  title: originalPlan.title,
  periodStart: originalPlan.period_start,
  periodEnd: originalPlan.period_end,
  priority: originalPlan.priority,
  successCriteria: originalPlan.success_criteria,
  estimatedMinutes: originalPlan.estimated_minutes,
  nextPlan: originalPlan.next_plan,
});

const created = await post({
  action: "create_task",
  planId,
  title: "기능 검사 <script>alert('x')</script>",
  dueDate: initial.today,
  priority: "보통",
  tag: "자동검사",
  estimatedMinutes: 15,
});
const taskId = Number(created.id);
if (!taskId) throw new Error("task create did not return an id");

const searched = await json(`/api/data?planId=${planId}&q=${encodeURIComponent("기능 검사")}&sort=tag`);
if (searched.tasks.length !== 1 || !searched.tasks[0].title.includes("<script>")) {
  throw new Error("script-shaped text was not stored literally");
}

await post({
  action: "update_task",
  id: taskId,
  title: "수정된 기능 검사 <script>alert('x')</script>",
  dueDate: initial.today,
  priority: "높음",
  tag: "자동검사",
  estimatedMinutes: 20,
});

const execution = {
  action: "finish_task",
  taskId,
  startedAt: `${initial.today}T09:00:00+09:00`,
  endedAt: `${initial.today}T09:20:00+09:00`,
  actualMinutes: 20,
  blockedReason: "자동 검사 기록",
};
const firstFinish = await post(execution);
const secondFinish = await post(execution);
if (firstFinish.executionRowsForTask !== 1 || secondFinish.executionRowsForTask !== 1) {
  throw new Error("duplicate finish created more than one execution row");
}

const afterFinish = await json(`/api/data?planId=${planId}`);
if (Number(afterFinish.review.completed_count) !== baseline.completed + 1) {
  throw new Error("completion count did not increase exactly once");
}
if (Number(afterFinish.review.execution_count) !== baseline.executions + 1) {
  throw new Error("execution count did not increase exactly once");
}

await post({ action: "set_status", id: taskId, status: "todo" });
const afterReopen = await json(`/api/data?planId=${planId}`);
if (Number(afterReopen.review.completed_count) !== baseline.completed) {
  throw new Error("reopen did not restore completion count");
}

await post({ action: "delete_task", id: taskId });
const afterDelete = await json(`/api/data?planId=${planId}`);
if (Number(afterDelete.review.planned_count) !== baseline.planned) {
  throw new Error("soft delete did not remove task from review count");
}

const exportResponse = await fetch(`${origin}/api/data?format=export`);
const exported = await exportResponse.json();
if (exported.schemaVersion !== "pds-schema-v2" || exported.durationUnit !== "minutes") {
  throw new Error("export contract mismatch");
}
const imported = await post({ action: "import", payload: exported });

console.log(JSON.stringify({
  planCount: initial.plans.length,
  planEditSameId: originalPlan.external_id,
  currentPlanTaskCount: baseline.planned,
  serverSort: searched.sortLabel,
  literalScriptText: true,
  duplicateFinishRows: secondFinish.executionRowsForTask,
  completionIncrement: 1,
  reopen: "passed",
  delete: "passed",
  exportSchema: exported.schemaVersion,
  imported: imported.imported,
}, null, 2));
