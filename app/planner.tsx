"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Database,
  Download,
  FileUp,
  Filter,
  Flag,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type Plan = {
  id: number;
  external_id: string;
  title: string;
  period_start: string;
  period_end: string;
  priority: string;
  success_criteria: string;
  estimated_minutes: number;
  next_plan: string;
  source_note: string;
  updated_at: string;
};

type Task = {
  id: number;
  plan_id: number;
  title: string;
  due_date: string;
  scheduled_date: string;
  auto_carry: number;
  carried_from_task_id: number | null;
  priority: string;
  tag: string;
  estimated_minutes: number;
  status: string;
  source_state: string;
  needs_review: number;
  execution_id: number | null;
  started_at: string | null;
  ended_at: string | null;
  actual_minutes: number | null;
  blocked_reason: string | null;
};

type PlanTask = Pick<Task, "id" | "title" | "scheduled_date" | "due_date" | "priority" | "tag" | "estimated_minutes" | "status" | "needs_review" | "auto_carry" | "carried_from_task_id">;

type Review = {
  planned_count?: number;
  completed_count?: number;
  carried_count?: number;
  todo_count?: number;
  overdue_count?: number;
  blocked_count?: number;
  estimated_total?: number;
  actual_total?: number;
  execution_count?: number;
};

type State = {
  selectedDate: string;
  archive: {date: string; planned_count: number; completed_count: number; carried_count: number; actual_total: number; execution_count: number}[];
  planTasks: PlanTask[];
  plans: Plan[];
  dailyPlan: Plan | null;
  previousNextPlan: { date: string; note: string } | null;
  selectedPlanId: number;
  tasks: Task[];
  review: Review;
  tags: string[];
  sortLabel: string;
  today: string;
  storage: {
    database: string;
    timezone: string;
    durationUnit: string;
    schema: string;
  };
};

type TaskEditor = { mode: "new" } | { mode: "edit"; task: PlanTask } | null;

const emptyState: State = {
  selectedDate: "",
  archive: [],
  planTasks: [],
  plans: [],
  dailyPlan: null,
  previousNextPlan: null,
  selectedPlanId: 0,
  tasks: [],
  review: {},
  tags: [],
  sortLabel: "마감일 빠른 순",
  today: "",
  storage: {
    database: "Cloudflare D1",
    timezone: "Asia/Seoul",
    durationUnit: "minutes",
    schema: "pds-schema-v2",
  },
};

function count(value: number | undefined | null) {
  return Number(value ?? 0);
}

function minutes(value: number | undefined | null) {
  const total = count(value);
  const sign = total < 0 ? "−" : "";
  const absolute = Math.abs(total);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  if (!hours) return `${sign}${mins}분`;
  if (!mins) return `${sign}${hours}시간`;
  return `${sign}${hours}시간 ${mins}분`;
}

function dateLabel(value: string) {
  if (!value) return "날짜 미정";
  const [, month, day] = value.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function kstInput(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PLAN · DO · SEE</p>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Planner() {
  const [data, setData] = useState<State>(emptyState);
  const [selectedDate, setSelectedDate] = useState(() => kstInput().slice(0, 10));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [priority, setPriority] = useState("all");
  const [metric, setMetric] = useState("all");
  const [sort, setSort] = useState("due_asc");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskEditor, setTaskEditor] = useState<TaskEditor>(null);
  const [planNoteEditor, setPlanNoteEditor] = useState<"success" | "next" | null>(null);
  const [executionTask, setExecutionTask] = useState<Task | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const difference = count(data.review.actual_total) - count(data.review.estimated_total);
  const completionRate = count(data.review.planned_count)
    ? Math.round((count(data.review.completed_count) / count(data.review.planned_count)) * 100)
    : 0;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: query,
          status,
          tag,
          priority,
          metric,
          sort,
          date: selectedDate,
        });
        const response = await fetch(`/api/data?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as State & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "데이터를 불러오지 못했습니다.");
        setData(payload);
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          setError(caught instanceof Error ? caught.message : "데이터를 불러오지 못했습니다.");
        }
      } finally {
        setLoading(false);
      }
    }, query ? 280 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedDate, query, status, tag, priority, metric, sort, reload]);

  useEffect(() => {
    const checkKstDay = () => {
      const today = kstInput().slice(0, 10);
      setSelectedDate((previous) => {
        // Follow the clock only while the user was viewing the previous "today".
        const yesterday = new Date(`${today}T12:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        return previous === yesterday.toISOString().slice(0, 10) ? today : previous;
      });
      setReload((value) => value + 1);
    };
    const interval = window.setInterval(() => {
      if (kstInput().slice(0, 10) !== data.today) checkKstDay();
    }, 60_000);
    document.addEventListener("visibilitychange", checkKstDay);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", checkKstDay); };
  }, [data.today]);

  function chooseDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSelectedDate(date);
    setQuery(""); setStatus("all"); setTag("all"); setPriority("all"); setMetric("all");
  }

  function moveDay(delta: number) {
    const date = new Date(`${selectedDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    chooseDate(date.toISOString().slice(0, 10));
  }

  async function mutate(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; executionRowsForTask?: number };
      if (!response.ok) throw new Error(result.error ?? "저장하지 못했습니다.");
      const idempotent = result.executionRowsForTask
        ? ` 같은 할 일의 실행 행은 ${result.executionRowsForTask}건입니다.`
        : "";
      setNotice(`${message}${idempotent}`);
      setReload((value) => value + 1);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function resetFilters(nextMetric = "all", nextStatus = "all") {
    setQuery("");
    setTag("all");
    setPriority("all");
    setStatus(nextStatus);
    setMetric(nextMetric);
    window.setTimeout(() => document.querySelector("#tasks")?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  async function handleImport(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      if (!window.confirm("현재 서버 DB 내용을 이 파일로 교체할까요? 내보내기 파일이 맞는지 확인하세요.")) {
        return;
      }
      const ok = await mutate({ action: "import", payload }, "전체 데이터를 가져왔습니다.");
      if (ok) {
        resetFilters();
      }
    } catch {
      setError("JSON 파일을 읽지 못했습니다.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Plan Do See Diary 처음으로">
          <span className="brand-mark"><Check size={18} strokeWidth={3} /></span>
          <span>Plan Do See</span>
        </a>
        <nav aria-label="주요 영역">
          <a href="#plan">Plan</a>
          <a href="#tasks">Do</a>
          <a href="#review">See</a>
        </nav>
        <span className="db-chip"><Database size={14} /> Server DB</span>
      </header>

      <div id="top" className="page-shell">
        <section className="public-warning" aria-label="공개 범위 안내">
          <div className="warning-icon"><AlertTriangle size={20} /></div>
          <div>
            <strong>로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다.</strong>
            <p>남이 봐도 괜찮은 내용만 넣으세요.</p>
          </div>
          <span>PUBLIC</span>
        </section>

        <section className="hero">
          <div>
            <p className="eyebrow"><Sparkles size={14} /> 안석주의 실제 계획 기록</p>
            <h1>계획을 세우고,<br />실행으로 확인합니다.</h1>
            <p className="hero-copy">
              오늘은 오늘의 할 일에 집중하세요. 월과 날짜를 선택하면
              지난날의 계획, 실행과 회고를 다시 확인할 수 있습니다.
            </p>
          </div>
          <div className="hero-summary">
            <div className="summary-ring" style={{ "--progress": `${completionRate * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{completionRate}%</strong><span>완료율</span></div>
            </div>
            <div>
              <strong>{count(data.review.completed_count)} / {count(data.review.planned_count)}</strong>
              <span>{dateLabel(selectedDate)} 하루 완료 상태</span>
            </div>
          </div>
        </section>

        {error && <div className="message error-message" role="alert">{error}</div>}
        {notice && <div className="message success-message" role="status">{notice}</div>}

        <section className="section-block daily-picker" aria-label="날짜 선택">
          <div><p className="step-label">MY DAILY DIARY</p><h2>{dateLabel(selectedDate)}의 Plan · Do · See</h2><p>월을 고르고 날짜를 눌러 하루의 기록을 열어보세요. 기준 시간대는 한국입니다.</p></div>
          <div className="date-controls">
            <label>월 선택<input aria-label="월 선택" type="month" value={selectedDate.slice(0, 7)} onChange={(event) => { if(event.target.value) chooseDate(`${event.target.value}-01`); }} /></label>
            <label>날짜 선택<input aria-label="날짜 선택" type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} /></label>
            <button className="secondary-button" type="button" onClick={() => moveDay(-1)}>← 전날</button>
            <button className="secondary-button" type="button" onClick={() => chooseDate(kstInput().slice(0, 10))}>오늘</button>
            <button className="secondary-button" type="button" onClick={() => moveDay(1)}>다음 날 →</button>
          </div>
          <div className="month-records">
            {data.archive.map((day) => <button type="button" key={day.date} aria-pressed={day.date === selectedDate} className={`day-record ${day.date === selectedDate ? "selected" : ""}`} onClick={() => chooseDate(day.date)}>
              <strong>{dateLabel(day.date)}{day.date === data.today ? " · 오늘" : ""}</strong>
              <span>Plan {day.planned_count}개 · Do 완료 {day.completed_count}개</span>
              <small>See 실행 {day.execution_count}건 · 이월 {count(day.carried_count)}개 · 실제 {minutes(day.actual_total)}</small>
            </button>)}
            {!loading && !data.archive.length && <p>이 달에는 아직 기록이 없습니다. 날짜를 선택하고 할 일을 추가하세요.</p>}
          </div>
        </section>

        <section id="plan" className="section-block">
          <div className="section-heading">
            <div>
              <p className="step-label">01 · PLAN</p>
              <h2>{dateLabel(selectedDate)}에 할 일 정하기</h2>
              <p>할 일, 우선순위, 예상 시간을 계획하면 아래 Do에 바로 나타납니다.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setTaskEditor({ mode: "new" })}>
              <Plus size={17} /> 오늘 할 일 계획
            </button>
          </div>
          <div className="plan-day-summary">계획 {data.planTasks.length}개 · 예상 {minutes(data.planTasks.reduce((sum, item) => sum + count(item.estimated_minutes), 0))} · 미완료 자동 이월은 새 계획에 적용됩니다.</div>
          {data.previousNextPlan && (
            <div className="day-note previous-plan-note">
              <div>
                <span>{dateLabel(data.previousNextPlan.date)} See에서 넘긴 한 줄</span>
                <p>{data.previousNextPlan.note}</p>
              </div>
            </div>
          )}
          <div className="day-note">
            <div>
              <span>이날의 성공 기준</span>
              <p>{data.dailyPlan?.success_criteria || "무엇을 하면 이 계획이 성공인지 정해 보세요."}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setPlanNoteEditor("success")}>
              <Pencil size={14} /> 성공 기준 {data.dailyPlan?.success_criteria ? "수정" : "입력"}
            </button>
          </div>
          <div className="plan-day-list">
            {data.planTasks.map((task) => <div className="plan-day-item" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p><span>우선순위 {task.priority}</span><span>예상 {minutes(task.estimated_minutes)}</span><span>마감 {dateLabel(task.due_date)}</span></p>
                {task.carried_from_task_id && <small>이전 날짜에서 이어진 할 일 · </small>}
                {task.status === "carried" ? <small className="carry-label">못 끝내 다음 날로 이월됨</small> : task.status === "completed" ? <small>완료됨</small> : task.auto_carry ? <small>미완료 시 다음 날 자동 이월</small> : <small>원본 기록 · 자동 이월 꺼짐</small>}
              </div>
              {task.status !== "carried" && <button className="secondary-button" type="button" onClick={() => setTaskEditor({ mode: "edit", task })}><Pencil size={14} /> 계획 수정</button>}
            </div>)}
            {!loading && !data.planTasks.length && <div className="empty-card">이 날의 계획이 없습니다. 할 일을 하나 정해보세요.</div>}
          </div>
        </section>

        <section id="tasks" className="section-block">
          <div className="section-heading task-heading">
            <div>
              <p className="step-label">02 · DO</p>
              <h2>{dateLabel(selectedDate)} 할 일과 실행</h2>
              <p>Plan에서 정한 일을 실행하고 실제 시간과 막힌 이유를 기록합니다. 현재 정렬은 <strong>{data.sortLabel}</strong>입니다.</p>
            </div>
            <a className="secondary-button" href="#plan">Plan에서 할 일 정하기</a>
          </div>

          <div className="filter-bar">
            <label className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="할 일 또는 태그 검색" />
            </label>
            <label><Filter size={15} /><select value={status} onChange={(event) => { setStatus(event.target.value); setMetric("all"); }}>
              <option value="all">모든 상태</option><option value="todo">미완료</option><option value="completed">완료</option><option value="carried">다음날 이월</option>
            </select></label>
            <label><Flag size={15} /><select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="all">모든 우선순위</option><option value="높음">높음</option><option value="보통">보통</option><option value="낮음">낮음</option>
            </select></label>
            <label><span>#</span><select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">모든 태그</option>{data.tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
            <label><ChevronRight size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="due_asc">마감일 빠른 순</option><option value="due_desc">마감일 늦은 순</option><option value="priority">우선순위 높은 순</option><option value="tag">태그 가나다 순</option>
            </select></label>
          </div>

          {metric !== "all" && (
            <div className="active-filter">
              회고 숫자에서 이동한 필터: <strong>{metric === "overdue" ? "기한 지남" : "막힘 있음"}</strong>
              <button type="button" onClick={() => setMetric("all")}><X size={14} /> 해제</button>
            </div>
          )}

          <div className="task-list" aria-live="polite">
            {loading && !data.tasks.length ? (
              <div className="empty-card">서버 DB에서 할 일을 불러오는 중입니다.</div>
            ) : data.tasks.length ? data.tasks.map((task) => (
              <article className={`task-row ${task.status === "completed" ? "is-complete" : task.status === "carried" ? "is-carried" : ""}`} key={task.id}>
                <button
                  className="check-button"
                  type="button"
                  disabled={task.status === "carried"}
                  title={task.status === "carried" ? "다음 날짜로 이월된 기록" : task.status === "completed" ? "다시 열기" : "완료 처리"}
                  onClick={() => mutate({ action: "set_status", id: task.id, status: task.status === "completed" ? "todo" : "completed" }, task.status === "completed" ? "할 일을 다시 열었습니다." : "할 일을 완료했습니다.")}
                >
                  {task.status === "completed" ? <CheckCircle2 size={23} /> : <Circle size={23} />}
                </button>
                <div className="task-content">
                  <div className="task-title-row">
                    <h3>{task.title}</h3>
                    {Boolean(task.needs_review) && <span className="review-badge">임시값 · 검토 필요</span>}
                    {task.execution_id && <span className="execution-badge">실행 기록 있음</span>}
                    {task.status === "carried" && <span className="carry-badge">다음날 이월</span>}
                    {task.carried_from_task_id && <span className="carry-badge">이전 날짜에서 이어짐</span>}
                  </div>
                  <div className="task-meta">
                    <span><CalendarDays size={14} /> 계획 {dateLabel(task.scheduled_date)}</span>
                    <span>마감 {dateLabel(task.due_date)}</span>
                    <span><Flag size={14} /> {task.priority}</span>
                    <span className="tag-badge">#{task.tag}</span>
                    <span><Clock3 size={14} /> 예상 {minutes(task.estimated_minutes)}</span>
                    {task.actual_minutes !== null && <span>실제 {minutes(task.actual_minutes)}</span>}
                  </div>
                  {task.blocked_reason && <p className="blocked-note"><AlertTriangle size={14} /> 막힌 이유: {task.blocked_reason}</p>}
                </div>
                <div className="task-actions">
                  {task.status !== "carried" && <button type="button" onClick={() => setExecutionTask(task)}><Clock3 size={15} /> 실행 기록</button>}
                  {task.status !== "carried" && <button type="button" onClick={() => setTaskEditor({ mode: "edit", task })}><Pencil size={15} /> 수정</button>}
                  {task.status !== "carried" && <button className="danger-action" type="button" onClick={() => {
                    if (window.confirm("이 할 일을 삭제할까요? 회고 숫자에서도 제외됩니다.")) {
                      mutate({ action: "delete_task", id: task.id }, "할 일을 삭제했습니다.");
                    }
                  }}><Trash2 size={15} /> 삭제</button>}
                </div>
              </article>
            )) : (
              <div className="empty-card">
                <ListChecks size={28} />
                <strong>조건에 맞는 할 일이 없습니다.</strong>
                <button className="text-button" type="button" onClick={() => resetFilters()}>필터 초기화</button>
              </div>
            )}
          </div>
        </section>

        <section id="review" className="section-block">
          <div className="section-heading">
            <div>
              <p className="step-label">03 · SEE</p>
              <h2>{dateLabel(selectedDate)} 하루 회고</h2>
              <p>카드를 누르면 해당 숫자를 만든 실제 할 일 목록으로 이동합니다.</p>
            </div>
            <span className="today-chip">KST 오늘 {data.today || "확인 중"}</span>
          </div>

          <div className="metric-grid">
            <button type="button" className="metric-card mint" onClick={() => resetFilters("all", "all")}>
              <span>계획한 할 일</span><strong>{count(data.review.planned_count)}</strong><small>삭제 항목 제외</small>
            </button>
            <button type="button" className="metric-card blue" onClick={() => resetFilters("all", "completed")}>
              <span>완료</span><strong>{count(data.review.completed_count)}</strong><small>체크 완료</small>
            </button>
            <button type="button" className="metric-card coral" onClick={() => resetFilters("overdue", "all")}>
              <span>기한 지남</span><strong>{count(data.review.overdue_count)}</strong><small>완료와 중복 제외</small>
            </button>
            <button type="button" className="metric-card amber" onClick={() => resetFilters("blocked", "all")}>
              <span>막힘</span><strong>{count(data.review.blocked_count)}</strong><small>이유가 있는 기록</small>
            </button>
            <button type="button" className="metric-card sand" onClick={() => resetFilters("all", "carried")}>
              <span>다음 날로 이월</span><strong>{count(data.review.carried_count)}</strong><small>이날 못 끝낸 기록</small>
            </button>
          </div>

          <div className="time-review">
            <div><span>예상 합계</span><strong>{minutes(data.review.estimated_total)}</strong></div>
            <ChevronRight size={22} />
            <div><span>실제 합계</span><strong>{minutes(data.review.actual_total)}</strong></div>
            <div className={difference > 0 ? "difference over" : "difference"}>
              <span>차이 (실제 − 예상)</span>
              <strong>{difference > 0 ? "+" : ""}{minutes(difference)}</strong>
            </div>
          </div>

          <div className="review-footer">
            <div>
              <p className="eyebrow">하루의 결과</p>
              <strong>완료 {count(data.review.completed_count)}개 · 아직 미완료 {count(data.review.todo_count)}개 · 다음 날 이월 {count(data.review.carried_count)}개</strong>
            </div>
            <div className="evidence-status">
              <span>실행 기록 {count(data.review.execution_count)}건</span>
              <span>선택한 날짜 기준</span>
            </div>
          </div>
          <div className="day-note next-plan-note">
            <div>
              <span>다음 계획으로 넘길 한 줄</span>
              <p>{data.dailyPlan?.next_plan || "오늘의 결과를 보고 다음 날 무엇을 할지 한 줄로 남겨 보세요."}</p>
              <small>미완료 할 일의 자동 이월과 별도로 저장됩니다.</small>
            </div>
            <button className="secondary-button" type="button" onClick={() => setPlanNoteEditor("next")}>
              <Pencil size={14} /> 다음 계획 {data.dailyPlan?.next_plan ? "수정" : "입력"}
            </button>
          </div>
        </section>

        <section className="data-tools section-block">
          <div>
            <p className="step-label">DATA SAFETY</p>
            <h2>전체 데이터 백업</h2>
            <p>날짜·시각은 ISO 형식, 시간 길이는 분(minutes) 단위로 저장합니다.</p>
          </div>
          <div className="tool-buttons">
            <a className="secondary-button" href="/api/data?format=export" download>
              <Download size={17} /> 전체 JSON 내보내기
            </a>
            <button className="secondary-button" type="button" onClick={() => importRef.current?.click()}>
              <FileUp size={17} /> JSON 가져오기
            </button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImport(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <dl className="storage-contract">
            <div><dt>저장소</dt><dd>{data.storage.database}</dd></div>
            <div><dt>기준 시간대</dt><dd>{data.storage.timezone}</dd></div>
            <div><dt>기간 단위</dt><dd>{data.storage.durationUnit}</dd></div>
            <div><dt>계약 파일</dt><dd><a href="/contracts/pds-schema-v2.json" target="_blank">{data.storage.schema}</a></dd></div>
          </dl>
        </section>
      </div>

      <footer>
        <span>Plan Do See Diary</span>
        <span>공개용 · 로그인 없음 · 서버 DB 저장</span>
      </footer>

      {planNoteEditor && (
        <Modal
          title={planNoteEditor === "success" ? `${dateLabel(selectedDate)} 성공 기준` : `${dateLabel(selectedDate)} 다음 계획`}
          description={planNoteEditor === "success" ? "이날 무엇을 하면 성공인지 직접 정해 주세요." : "회고를 바탕으로 다음 계획에 반영할 내용을 한 줄로 남겨 주세요."}
          onClose={() => setPlanNoteEditor(null)}
        >
          <form className="editor-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const ok = await mutate({
              action: "update_daily_plan_field",
              date: selectedDate,
              field: planNoteEditor === "success" ? "success_criteria" : "next_plan",
              value: form.get("content"),
            }, planNoteEditor === "success" ? "성공 기준을 저장했습니다." : "다음 계획 한 줄을 저장했습니다.");
            if (ok) setPlanNoteEditor(null);
          }}>
            <label className="full">
              <span>{planNoteEditor === "success" ? "성공 기준" : "다음 계획 한 줄"}</span>
              {planNoteEditor === "success" ? (
                <textarea name="content" required maxLength={500} defaultValue={data.dailyPlan?.success_criteria ?? ""} placeholder="예: 오늘 정한 일 5개 중 3개를 실제로 마친다." />
              ) : (
                <input name="content" type="text" maxLength={300} defaultValue={data.dailyPlan?.next_plan ?? ""} placeholder="예: 내일은 먼저 보고서 개요를 작성한다." />
              )}
            </label>
            <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setPlanNoteEditor(null)}>취소</button><button className="primary-button" disabled={busy}>저장</button></div>
          </form>
        </Modal>
      )}

      {taskEditor && (
        <Modal
          title={taskEditor.mode === "new" ? "하루 계획 추가" : "하루 계획 수정"}
          description="Plan에서 정한 할 일은 Do에도 바로 나타납니다. 미완료 항목은 다음 날로 이어집니다."
          onClose={() => setTaskEditor(null)}
        >
          <form className="editor-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const editing = taskEditor.mode === "edit" ? taskEditor.task : null;
            const ok = await mutate({
              action: editing ? "update_task" : "create_task",
              id: editing?.id,
              title: form.get("title"),
              dueDate: form.get("dueDate"),
              scheduledDate: form.get("scheduledDate"),
              autoCarry: form.get("autoCarry") === "on",
              priority: form.get("priority"),
              tag: form.get("tag"),
              estimatedMinutes: form.get("estimatedMinutes"),
            }, editing ? "할 일을 수정했습니다." : "새 할 일을 추가했습니다.");
            if (ok) setTaskEditor(null);
          }}>
            <label className="full"><span>할 일</span><input name="title" required defaultValue={taskEditor.mode === "edit" ? taskEditor.task.title : ""} placeholder="예: 과제 6 제출" /></label>
            <label><span>계획일 (하루 목록에 표시할 날짜)</span><input name="scheduledDate" type="date" required defaultValue={taskEditor.mode === "edit" ? taskEditor.task.scheduled_date : selectedDate} /></label>
            <label><span>마감일</span><input name="dueDate" type="date" required defaultValue={taskEditor.mode === "edit" ? taskEditor.task.due_date : selectedDate} /></label>
            <label><span>우선순위</span><select name="priority" defaultValue={taskEditor.mode === "edit" ? taskEditor.task.priority : "보통"}><option>높음</option><option>보통</option><option>낮음</option></select></label>
            <label><span>태그</span><input name="tag" required defaultValue={taskEditor.mode === "edit" ? taskEditor.task.tag : "학업"} /></label>
            <label><span>예상 시간(분)</span><input name="estimatedMinutes" type="number" min="0" required defaultValue={taskEditor.mode === "edit" ? taskEditor.task.estimated_minutes : 60} /></label>
            <label className="carry-option full"><input name="autoCarry" type="checkbox" defaultChecked={taskEditor.mode === "edit" ? Boolean(taskEditor.task.auto_carry) : selectedDate >= (data.today || kstInput().slice(0, 10))} /><span>끝내지 못하면 다음 날로 자동 이월</span></label>
            <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setTaskEditor(null)}>취소</button><button className="primary-button" disabled={busy}>{taskEditor.mode === "edit" ? "계획 저장" : "계획 추가"}</button></div>
          </form>
        </Modal>
      )}

      {executionTask && (
        <Modal title="실행 기록" description="같은 할 일을 두 번 저장해도 실행 행은 1건만 유지됩니다." onClose={() => setExecutionTask(null)}>
          <form className="editor-form" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const started = String(form.get("startedAt") ?? "");
            const ended = String(form.get("endedAt") ?? "");
            const ok = await mutate({
              action: "finish_task",
              taskId: executionTask.id,
              startedAt: `${started}:00+09:00`,
              endedAt: `${ended}:00+09:00`,
              actualMinutes: form.get("actualMinutes"),
              blockedReason: form.get("blockedReason"),
            }, "실행 기록을 저장하고 할 일을 완료했습니다.");
            if (ok) setExecutionTask(null);
          }}>
            <div className="selected-task"><span>선택한 할 일</span><strong>{executionTask.title}</strong></div>
            <label><span>시작 시각 (KST)</span><input name="startedAt" type="datetime-local" required defaultValue={executionTask.started_at?.slice(0, 16) || kstInput(-60)} /></label>
            <label><span>종료 시각 (KST)</span><input name="endedAt" type="datetime-local" required defaultValue={executionTask.ended_at?.slice(0, 16) || kstInput()} /></label>
            <label className="full"><span>실제 시간(분)</span><input name="actualMinutes" type="number" min="0" required defaultValue={executionTask.actual_minutes ?? 60} /></label>
            <label className="full"><span>막힌 이유 (없으면 비움)</span><textarea name="blockedReason" defaultValue={executionTask.blocked_reason ?? ""} placeholder="예: 자료를 찾는 데 시간이 오래 걸림" /></label>
            <p className="form-note">PDF에는 실제 시각이 없으므로 자동으로 만들지 않았습니다. 실제로 기억하는 값만 입력하세요.</p>
            <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setExecutionTask(null)}>취소</button><button className="primary-button" disabled={busy}>완료 기록 저장</button></div>
          </form>
        </Modal>
      )}
    </main>
  );
}
