import { env } from "cloudflare:workers";
import { seedPlans, seedTasks } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function db() {
  if (!env.DB) {
    throw new Error("D1 binding DB를 찾을 수 없습니다.");
  }
  return env.DB;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function validId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function kstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validDate(value: unknown) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

function nextDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

// A request after KST midnight advances unfinished, newly planned work. The archived
// row becomes "carried" and remains visible on its original date. The unique origin
// key makes retries and concurrent page loads safe.
async function carryUnfinishedTasks() {
  const database = db();
  const today = kstToday();
  for (let pass = 0; pass < 32; pass += 1) {
    const pending = await database.prepare(
      `SELECT id, scheduled_date FROM tasks
       WHERE auto_carry = 1 AND status = 'todo' AND deleted_at IS NULL
         AND scheduled_date < ? ORDER BY scheduled_date, id LIMIT 200`
    ).bind(today).all<{ id: number; scheduled_date: string }>();
    if (!pending.results.length) break;
    for (const task of pending.results) {
      const tomorrow = nextDate(task.scheduled_date);
      // A long absence creates one continuation on the next visit, without
      // fabricating dozens of untouched daily records.
      const targetDate = pass === 31 ? today : tomorrow;
      const timestamp = nowIso();
      await database.batch([
        database.prepare(
          `UPDATE tasks SET status = 'carried', updated_at = ?
           WHERE id = ? AND status = 'todo' AND auto_carry = 1 AND deleted_at IS NULL`
        ).bind(timestamp, task.id),
        database.prepare(
          `INSERT OR IGNORE INTO tasks
             (plan_id, carried_from_task_id, title, due_date, scheduled_date, auto_carry,
              priority, tag, estimated_minutes, status, source_state, needs_review, created_at, updated_at)
           SELECT plan_id, id, title, due_date, ?, 1, priority, tag, estimated_minutes,
                  'todo', '전날 미완료 이월', needs_review, ?, ?
             FROM tasks WHERE id = ? AND status = 'carried' AND deleted_at IS NULL`
        ).bind(targetDate, timestamp, timestamp, task.id),
      ]);
    }
  }
}

async function ensureDailyPlan(date: string) {
  const database = db();
  const externalId = `PDS-DAY-${date}`;
  await database.prepare(
    `INSERT OR IGNORE INTO plans
      (external_id, title, period_start, period_end, priority, success_criteria,
       estimated_minutes, next_plan, source_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '보통', ?, 0, '', '하루 계획', ?, ?)`
  ).bind(externalId, `${date} 하루 계획`, date, date, "오늘 정한 할 일을 실행하고 회고한다.", nowIso(), nowIso()).run();
  const row = await database.prepare("SELECT id FROM plans WHERE external_id = ?")
    .bind(externalId).first<{ id: number }>();
  if (!row) throw new Error("하루 계획을 만들지 못했습니다.");
  return row.id;
}

async function ensureSeedData() {
  const database = db();
  const seeded = await database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .bind("notion-seed-v2")
    .first<{ value: string }>();

  if (seeded) return;

  const planStatements = seedPlans.map((plan) =>
    database
      .prepare(
        `INSERT OR IGNORE INTO plans
          (external_id, title, period_start, period_end, priority, success_criteria, estimated_minutes, next_plan, source_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        plan.externalId,
        plan.title,
        plan.periodStart,
        plan.periodEnd,
        plan.priority,
        plan.successCriteria,
        plan.estimatedMinutes,
        plan.nextPlan,
        plan.sourceNote,
        nowIso(),
        nowIso()
      )
  );
  await database.batch(planStatements);

  const planRows = await database
    .prepare("SELECT id, external_id FROM plans")
    .all<{ id: number; external_id: string }>();
  const planIds = new Map(planRows.results.map((row) => [row.external_id, row.id]));

  const taskStatements = seedTasks.flatMap((task) => {
    const planId = planIds.get(task.planExternalId);
    if (!planId) return [];
    return [
      database
        .prepare(
          `INSERT OR IGNORE INTO tasks
            (plan_id, seed_key, title, due_date, priority, tag, estimated_minutes, status, source_state, needs_review, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(
          planId,
          task.key,
          task.title,
          task.dueDate,
          task.priority ?? "보통",
          task.tag,
          task.estimatedMinutes ?? 30,
          task.status,
          "Notion PDF 이관",
          nowIso(),
          nowIso()
        ),
    ];
  });
  if (taskStatements.length) await database.batch(taskStatements);
  await database.batch(seedTasks.map((task) => database.prepare(
    "UPDATE tasks SET scheduled_date = ? WHERE seed_key = ? AND scheduled_date = ''"
  ).bind(task.scheduledDate, task.key)));
  await database.prepare("UPDATE tasks SET scheduled_date = due_date WHERE scheduled_date = ''").run();

  await database
    .prepare(
      "INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)"
    )
    .bind("notion-seed-v2", "원본 계획일과 마감일 분리", nowIso())
    .run();
}

async function exportAll() {
  const database = db();
  const [plans, tasks, executions, meta] = await Promise.all([
    database.prepare("SELECT * FROM plans ORDER BY period_start, id").all(),
    database.prepare("SELECT * FROM tasks ORDER BY plan_id, due_date, id").all(),
    database.prepare("SELECT * FROM executions ORDER BY started_at, id").all(),
    database.prepare("SELECT * FROM app_meta ORDER BY key").all(),
  ]);
  return {
    schemaVersion: "pds-schema-v2",
    exportedAt: nowIso(),
    durationUnit: "minutes",
    timezone: "Asia/Seoul",
    plans: plans.results,
    tasks: tasks.results,
    executions: executions.results,
    appMeta: meta.results,
  };
}

async function readState(url: URL) {
  const database = db();
  const plans = await database
    .prepare("SELECT * FROM plans ORDER BY period_start DESC, id DESC")
    .all();
  const requestedPlanId = validId(url.searchParams.get("planId"));
  const dateParam = text(url.searchParams.get("date"));
  const selectedDate = validDate(dateParam) || kstToday();
  const dailyPlan = plans.results.find((row) => row.external_id === `PDS-DAY-${selectedDate}`) ?? null;
  const previous = new Date(`${selectedDate}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDate = previous.toISOString().slice(0, 10);
  const previousPlan = plans.results.find((row) => row.external_id === `PDS-DAY-${previousDate}`);
  const previousNextPlan = previousPlan?.next_plan
    ? { date: previousDate, note: String(previousPlan.next_plan) }
    : null;
  const matchingPlan = plans.results.find((row) => String(row.period_start) <= selectedDate && String(row.period_end) >= selectedDate);
  const firstPlan = plans.results[0] as JsonRecord | undefined;
  const planId = requestedPlanId || Number(matchingPlan?.id ?? firstPlan?.id ?? 0);
  const query = text(url.searchParams.get("q"));
  const status = text(url.searchParams.get("status"), "all");
  const tag = text(url.searchParams.get("tag"), "all");
  const priority = text(url.searchParams.get("priority"), "all");
  const metric = text(url.searchParams.get("metric"), "all");
  const sort = text(url.searchParams.get("sort"), "due_asc");
  const today = kstToday();

  const where = ["t.scheduled_date = ?", "t.deleted_at IS NULL"];
  const binds: (string | number)[] = [selectedDate];
  if (query) {
    where.push("(t.title LIKE ? OR t.tag LIKE ?)");
    binds.push(`%${query}%`, `%${query}%`);
  }
  if (status !== "all") {
    where.push("t.status = ?");
    binds.push(status);
  }
  if (tag !== "all") {
    where.push("t.tag = ?");
    binds.push(tag);
  }
  if (priority !== "all") {
    where.push("t.priority = ?");
    binds.push(priority);
  }
  if (metric === "overdue") {
    where.push("t.status = 'todo' AND t.due_date < ?");
    binds.push(today);
  }
  if (metric === "blocked") {
    where.push("COALESCE(e.blocked_reason, '') <> ''");
  }

  const sorts: Record<string, { sql: string; label: string }> = {
    due_asc: { sql: "t.due_date ASC, t.id ASC", label: "마감일 빠른 순" },
    due_desc: { sql: "t.due_date DESC, t.id DESC", label: "마감일 늦은 순" },
    priority: {
      sql: "CASE t.priority WHEN '높음' THEN 1 WHEN '보통' THEN 2 WHEN '낮음' THEN 3 ELSE 4 END, t.due_date ASC",
      label: "우선순위 높은 순",
    },
    tag: { sql: "t.tag ASC, t.due_date ASC", label: "태그 가나다 순" },
  };
  const selectedSort = sorts[sort] ?? sorts.due_asc;
  const taskSql = `
    SELECT t.*, e.id AS execution_id, e.started_at, e.ended_at,
           e.actual_minutes, e.blocked_reason
      FROM tasks t
      LEFT JOIN executions e ON e.task_id = t.id
     WHERE ${where.join(" AND ")}
     ORDER BY ${selectedSort.sql}`;
  const tasks = await database.prepare(taskSql).bind(...binds).all();
  const planTasks = await database.prepare(
    `SELECT id, title, scheduled_date, due_date, status, priority, tag,
            estimated_minutes, needs_review, auto_carry, carried_from_task_id
     FROM tasks WHERE scheduled_date = ? AND deleted_at IS NULL
     ORDER BY CASE priority WHEN '높음' THEN 1 WHEN '보통' THEN 2 ELSE 3 END, id`
  ).bind(selectedDate).all();

  const review = await database
    .prepare(
      `SELECT
         COUNT(t.id) AS planned_count,
         SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
         SUM(CASE WHEN t.status = 'carried' THEN 1 ELSE 0 END) AS carried_count,
         SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) AS todo_count,
         SUM(CASE WHEN t.status = 'todo' AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue_count,
         SUM(CASE WHEN COALESCE(e.blocked_reason, '') <> '' THEN 1 ELSE 0 END) AS blocked_count,
         COALESCE(SUM(t.estimated_minutes), 0) AS estimated_total,
         COALESCE(SUM(e.actual_minutes), 0) AS actual_total,
         COUNT(e.id) AS execution_count
       FROM tasks t
       LEFT JOIN executions e ON e.task_id = t.id
       WHERE t.scheduled_date = ? AND t.deleted_at IS NULL`
    )
    .bind(today, selectedDate)
    .first();

  const tags = await database
    .prepare(
      "SELECT DISTINCT tag FROM tasks WHERE scheduled_date = ? AND deleted_at IS NULL ORDER BY tag"
    )
    .bind(selectedDate)
    .all<{ tag: string }>();

  const archive = await database.prepare(`SELECT t.scheduled_date AS date,
    COUNT(*) AS planned_count, SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN t.status = 'carried' THEN 1 ELSE 0 END) AS carried_count,
    COALESCE(SUM(e.actual_minutes), 0) AS actual_total, COUNT(e.id) AS execution_count
    FROM tasks t LEFT JOIN executions e ON e.task_id = t.id
    WHERE t.deleted_at IS NULL AND t.scheduled_date LIKE ?
    GROUP BY t.scheduled_date ORDER BY t.scheduled_date DESC`).bind(`${selectedDate.slice(0, 7)}-%`).all();
  return {
    selectedDate,
    archive: archive.results,
    planTasks: planTasks.results,
    plans: plans.results,
    dailyPlan,
    previousNextPlan,
    selectedPlanId: planId,
    tasks: tasks.results,
    review: review ?? {},
    tags: tags.results.map((row) => row.tag),
    sortLabel: selectedSort.label,
    today,
    storage: {
      database: "Cloudflare D1",
      timezone: "Asia/Seoul",
      durationUnit: "minutes",
      schema: "pds-schema-v2",
    },
  };
}

export async function GET(request: Request) {
  try {
    await ensureSeedData();
    await carryUnfinishedTasks();
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "export") {
      const payload = await exportAll();
      return new Response(JSON.stringify(payload, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="plan-do-see-${kstToday()}.json"`,
        },
      });
    }
    return Response.json(await readState(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터를 읽지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeedData();
    await carryUnfinishedTasks();
    const body = (await request.json()) as JsonRecord;
    const action = text(body.action);
    const database = db();
    const timestamp = nowIso();

    if (action === "update_daily_plan_field") {
      const date = validDate(body.date);
      const field = text(body.field);
      const value = field === "next_plan" ? text(body.value).replace(/\s*\r?\n\s*/g, " ") : text(body.value);
      if (!date || (field !== "success_criteria" && field !== "next_plan")) {
        return Response.json({ error: "날짜와 입력 항목을 확인해 주세요." }, { status: 400 });
      }
      const limit = field === "success_criteria" ? 500 : 300;
      if ((field === "success_criteria" && !value) || value.length > limit) {
        return Response.json({ error: `내용을 ${limit}자 이내로 입력해 주세요.` }, { status: 400 });
      }
      const id = await ensureDailyPlan(date);
      await database.prepare(`UPDATE plans SET ${field} = ?, updated_at = ? WHERE id = ?`)
        .bind(value, timestamp, id).run();
      return Response.json({ ok: true, id });
    }

    if (action === "update_plan") {
      const id = validId(body.id);
      if (!id) return Response.json({ error: "계획 ID가 필요합니다." }, { status: 400 });
      await database
        .prepare(
          `UPDATE plans SET title = ?, period_start = ?, period_end = ?, priority = ?,
           success_criteria = ?, estimated_minutes = ?, next_plan = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          text(body.title),
          text(body.periodStart),
          text(body.periodEnd),
          text(body.priority, "보통"),
          text(body.successCriteria),
          integer(body.estimatedMinutes),
          text(body.nextPlan),
          timestamp,
          id
        )
        .run();
      return Response.json({ ok: true, id });
    }

    if (action === "create_task") {
      const title = text(body.title);
      const scheduledDate = validDate(body.scheduledDate) || validDate(body.dueDate);
      const dueDate = validDate(body.dueDate);
      if (!title || !scheduledDate || !dueDate) {
        return Response.json({ error: "할 일, 계획일, 마감일을 확인해 주세요." }, { status: 400 });
      }
      const planId = await ensureDailyPlan(scheduledDate);
      const result = await database
        .prepare(
          `INSERT INTO tasks
            (plan_id, title, due_date, scheduled_date, auto_carry, priority, tag, estimated_minutes, status, source_state, needs_review, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', '사용자 입력', 0, ?, ?)`
        )
        .bind(
          planId,
          title,
          dueDate,
          scheduledDate,
          body.autoCarry === false ? 0 : 1,
          text(body.priority, "보통"),
          text(body.tag, "기타"),
          integer(body.estimatedMinutes, 30),
          timestamp,
          timestamp
        )
        .run();
      return Response.json({ ok: true, id: result.meta.last_row_id });
    }

    if (action === "update_task") {
      const id = validId(body.id);
      const scheduledDate = validDate(body.scheduledDate) || validDate(body.dueDate);
      const dueDate = validDate(body.dueDate);
      if (!id || !text(body.title) || !scheduledDate || !dueDate) {
        return Response.json({ error: "할 일과 날짜를 확인해 주세요." }, { status: 400 });
      }
      const result = await database
        .prepare(
          `UPDATE tasks SET title = ?, due_date = ?, scheduled_date = ?, auto_carry = ?, priority = ?, tag = ?,
           estimated_minutes = ?, needs_review = 0, updated_at = ?
           WHERE id = ? AND status <> 'carried' AND deleted_at IS NULL`
        )
        .bind(
          text(body.title),
          dueDate,
          scheduledDate,
          body.autoCarry === true ? 1 : 0,
          text(body.priority, "보통"),
          text(body.tag, "기타"),
          integer(body.estimatedMinutes, 30),
          timestamp,
          id
        )
        .run();
      if (!result.meta.changes) return Response.json({ error: "이월된 과거 기록은 수정할 수 없습니다. 이어진 날짜의 할 일을 수정하세요." }, { status: 409 });
      return Response.json({ ok: true, id });
    }

    if (action === "set_status") {
      const id = validId(body.id);
      const status = body.status === "completed" ? "completed" : "todo";
      const result = await database
        .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND status <> 'carried' AND deleted_at IS NULL")
        .bind(status, timestamp, id)
        .run();
      if (!result.meta.changes) return Response.json({ error: "이월된 기록입니다. 다음 날짜의 할 일에서 완료하세요." }, { status: 409 });
      return Response.json({ ok: true, id, status });
    }

    if (action === "delete_task") {
      const id = validId(body.id);
      await database
        .prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?")
        .bind(timestamp, timestamp, id)
        .run();
      return Response.json({ ok: true, id });
    }

    if (action === "finish_task") {
      const taskId = validId(body.taskId);
      const startedAt = text(body.startedAt);
      const endedAt = text(body.endedAt);
      const actualMinutes = integer(body.actualMinutes);
      if (!taskId || !startedAt || !endedAt) {
        return Response.json(
          { error: "할 일, 시작 시각, 종료 시각이 필요합니다." },
          { status: 400 }
        );
      }
      const candidate = await database.prepare(
        "SELECT status FROM tasks WHERE id = ? AND deleted_at IS NULL"
      ).bind(taskId).first<{ status: string }>();
      if (!candidate || candidate.status === "carried") return Response.json(
        { error: "이월된 과거 기록에는 실행을 입력할 수 없습니다. 이어진 날짜의 할 일을 선택하세요." },
        { status: 409 }
      );
      await database.batch([
        database
          .prepare(
            `INSERT INTO executions
              (task_id, started_at, ended_at, actual_minutes, blocked_reason, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(task_id) DO UPDATE SET
               started_at = excluded.started_at,
               ended_at = excluded.ended_at,
               actual_minutes = excluded.actual_minutes,
               blocked_reason = excluded.blocked_reason,
               updated_at = excluded.updated_at`
          )
          .bind(
            taskId,
            startedAt,
            endedAt,
            actualMinutes,
            text(body.blockedReason),
            timestamp,
            timestamp
          ),
        database
          .prepare("UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ? AND status <> 'carried' AND deleted_at IS NULL")
          .bind(timestamp, taskId),
      ]);
      const count = await database
        .prepare("SELECT COUNT(*) AS total FROM executions WHERE task_id = ?")
        .bind(taskId)
        .first<{ total: number }>();
      return Response.json({ ok: true, taskId, executionRowsForTask: count?.total ?? 0 });
    }

    if (action === "import") {
      const payload = body.payload as JsonRecord | undefined;
      const plans = Array.isArray(payload?.plans) ? payload.plans : null;
      const tasks = Array.isArray(payload?.tasks) ? payload.tasks : null;
      const executions = Array.isArray(payload?.executions) ? payload.executions : null;
      if (payload?.schemaVersion !== "pds-schema-v2" || !plans || !tasks || !executions) {
        return Response.json({ error: "pds-schema-v2 내보내기 파일이 아닙니다." }, { status: 400 });
      }
      const statements: D1PreparedStatement[] = [
        database.prepare("DELETE FROM executions"),
        database.prepare("DELETE FROM tasks"),
        database.prepare("DELETE FROM plans"),
        database.prepare("DELETE FROM app_meta"),
      ];
      for (const row of plans as JsonRecord[]) {
        statements.push(
          database
            .prepare(
              `INSERT INTO plans
                (id, external_id, title, period_start, period_end, priority, success_criteria,
                 estimated_minutes, next_plan, source_note, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              validId(row.id), text(row.external_id), text(row.title), text(row.period_start),
              text(row.period_end), text(row.priority), text(row.success_criteria),
              integer(row.estimated_minutes), text(row.next_plan), text(row.source_note),
              text(row.created_at, timestamp), text(row.updated_at, timestamp)
            )
        );
      }
      for (const row of tasks as JsonRecord[]) {
        statements.push(
          database
            .prepare(
              `INSERT INTO tasks
                (id, plan_id, seed_key, title, due_date, scheduled_date, auto_carry, carried_from_task_id,
                 priority, tag, estimated_minutes, status, source_state, needs_review, deleted_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              validId(row.id), validId(row.plan_id), text(row.seed_key) || null, text(row.title),
              text(row.due_date), text(row.scheduled_date, text(row.due_date)), Number(row.auto_carry) ? 1 : 0,
              validId(row.carried_from_task_id) || null, text(row.priority), text(row.tag), integer(row.estimated_minutes),
              text(row.status, "todo"), text(row.source_state), Number(row.needs_review) ? 1 : 0,
              text(row.deleted_at) || null, text(row.created_at, timestamp), text(row.updated_at, timestamp)
            )
        );
      }
      for (const row of executions as JsonRecord[]) {
        statements.push(
          database
            .prepare(
              `INSERT INTO executions
                (id, task_id, started_at, ended_at, actual_minutes, blocked_reason, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              validId(row.id), validId(row.task_id), text(row.started_at), text(row.ended_at),
              integer(row.actual_minutes), text(row.blocked_reason),
              text(row.created_at, timestamp), text(row.updated_at, timestamp)
            )
        );
      }
      statements.push(
        database
          .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
          .bind("notion-seed-v2", "가져오기 완료", timestamp)
      );
      await database.batch(statements);
      return Response.json({ ok: true, imported: { plans: plans.length, tasks: tasks.length, executions: executions.length } });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
