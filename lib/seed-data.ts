export type SeedPlan = {
  externalId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  priority: string;
  successCriteria: string;
  estimatedMinutes: number;
  nextPlan: string;
  sourceNote: string;
};

export type SeedTask = {
  key: string;
  planExternalId: string;
  title: string;
  dueDate: string;
  scheduledDate: string;
  status: "todo" | "completed";
  tag: string;
  priority?: string;
  estimatedMinutes?: number;
};

const sourceNote =
  "Notion 주간 계획표 PDF에서 날짜·할 일·체크 상태를 이관했습니다. 우선순위와 예상 시간은 원본에 없어 임시값이며 사용자 검토가 필요합니다.";

export const seedPlans: SeedPlan[] = [
  {
    externalId: "PDS-2026-09-07",
    title: "9월 7일 - 9월 13일",
    periodStart: "2026-09-07",
    periodEnd: "2026-09-13",
    priority: "검토 필요",
    successCriteria: "원본 계획표의 체크 항목을 실행하고 완료 여부를 기록한다.",
    estimatedMinutes: 0,
    nextPlan: "미완료 항목은 다음 주 계획에서 우선순위를 다시 정한다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-09-14",
    title: "9월 14일 - 9월 20일",
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    priority: "검토 필요",
    successCriteria: "학업·취업·ALEPH 계획을 날짜별로 실행하고 완료 상태를 남긴다.",
    estimatedMinutes: 0,
    nextPlan: "완료한 루틴은 유지하고 미완료 학업 일정을 먼저 배치한다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-09-21",
    title: "9월 21일 - 9월 27일",
    periodStart: "2026-09-21",
    periodEnd: "2026-09-27",
    priority: "검토 필요",
    successCriteria: "과제와 강의를 기한 안에 처리하고 취업 준비 항목을 진전시킨다.",
    estimatedMinutes: 0,
    nextPlan: "남은 취업 준비와 학습법 워크를 다음 계획으로 이어간다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-09-28",
    title: "9월 28일 - 9월 30일",
    periodStart: "2026-09-28",
    periodEnd: "2026-09-30",
    priority: "검토 필요",
    successCriteria: "월말 할 일을 정리하고 다음 달로 넘길 항목을 확인한다.",
    estimatedMinutes: 0,
    nextPlan: "남은 지원·학습 항목을 10월 첫째 주 계획으로 이동한다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-10-03",
    title: "10월 3일 - 10월 4일",
    periodStart: "2026-10-03",
    periodEnd: "2026-10-04",
    priority: "검토 필요",
    successCriteria: "주말 핵심 과제와 학습 항목을 시작한다.",
    estimatedMinutes: 0,
    nextPlan: "끝내지 못한 항목을 10월 5일 주간 계획에 다시 배치한다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-10-05",
    title: "10월 5일 - 10월 11일",
    periodStart: "2026-10-05",
    periodEnd: "2026-10-11",
    priority: "검토 필요",
    successCriteria: "대학영어·파이썬·ALEPH·취업 준비를 날짜별로 실행한다.",
    estimatedMinutes: 0,
    nextPlan: "미완료 과제와 보고서를 다음 주 최우선 항목으로 이어간다.",
    sourceNote,
  },
  {
    externalId: "PDS-2026-10-12",
    title: "10월 12일 - 10월 18일",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-18",
    priority: "검토 필요",
    successCriteria: "매일 루틴을 지키고 학업·ALEPH·취업 준비의 완료 여부를 기록한다.",
    estimatedMinutes: 0,
    nextPlan: "미완료 항목은 기한과 중요도를 확인해 다음 주에 다시 배치한다.",
    sourceNote,
  },
];

const task = (
  key: string,
  planExternalId: string,
  title: string,
  dueDate: string,
  status: "todo" | "completed",
  tag: string,
  estimatedMinutes = tag === "리추얼" ? 20 : 60
): SeedTask => ({
  key,
  planExternalId,
  title,
  dueDate,
  scheduledDate: `2026-${key.slice(0, 2)}-${key.slice(2, 4)}`,
  status,
  tag,
  priority: "보통",
  estimatedMinutes,
});

export const seedTasks: SeedTask[] = [
  task("0907-01", "PDS-2026-09-07", "대학영어 과제 2", "2026-09-07", "completed", "학업"),
  task("0907-02", "PDS-2026-09-07", "ALEPH 강의 듣기", "2026-09-07", "completed", "ALEPH"),
  task("0907-03", "PDS-2026-09-07", "대학영어 필기 정리", "2026-09-07", "completed", "학업"),
  task("0907-04", "PDS-2026-09-07", "캡스톤 필기 정리", "2026-09-07", "completed", "학업"),
  task("0908-01", "PDS-2026-09-07", "진료 확인서 학원 제출", "2026-09-08", "completed", "생활"),
  task("0908-02", "PDS-2026-09-07", "대영 과제 3 제출", "2026-09-08", "completed", "학업"),
  task("0910-01", "PDS-2026-09-07", "ALEPH 과제 1 마무리", "2026-09-10", "todo", "ALEPH"),
  task("0910-02", "PDS-2026-09-07", "메이플 리프 하기", "2026-09-10", "todo", "여가", 30),
  task("0911-01", "PDS-2026-09-07", "파이썬 Zoom 수업 참여", "2026-09-11", "completed", "학업"),
  task("0913-01", "PDS-2026-09-07", "리추얼 과제 2", "2026-09-13", "todo", "ALEPH"),

  task("0914-01", "PDS-2026-09-14", "기사 하나 읽기", "2026-09-14", "completed", "자기계발", 20),
  task("0914-02", "PDS-2026-09-14", "리추얼 과제 2 마무리", "2026-09-14", "completed", "ALEPH"),
  task("0914-03", "PDS-2026-09-14", "채용 공고 하나 보기", "2026-09-14", "completed", "취업", 30),
  task("0914-04", "PDS-2026-09-14", "AWS 강의 영상 보기", "2026-09-14", "completed", "학업"),
  task("0915-01", "PDS-2026-09-14", "대학영어 출석", "2026-09-15", "completed", "학업"),
  task("0915-02", "PDS-2026-09-14", "파이썬 프로그래밍 강의 수강", "2026-09-15", "completed", "학업"),
  task("0915-03", "PDS-2026-09-14", "ALEPH AWS 강의 듣기", "2026-09-15", "completed", "ALEPH"),
  task("0916-01", "PDS-2026-09-14", "꿈모아 마일리지 자격증 제출", "2026-09-16", "completed", "생활"),
  task("0916-02", "PDS-2026-09-14", "학교 폭력예방교육 듣고 설문 참여", "2026-09-16", "completed", "학업"),
  task("0917-01", "PDS-2026-09-14", "프로젝트 토폴로지 구성", "2026-09-17", "completed", "ALEPH"),

  task("0921-01", "PDS-2026-09-21", "대영 과제 6", "2026-09-22", "completed", "학업"),
  task("0921-02", "PDS-2026-09-21", "수세 과제", "2026-09-24", "completed", "학업"),
  task("0921-03", "PDS-2026-09-21", "증권계좌 개설", "2026-09-25", "todo", "생활"),
  task("0921-04", "PDS-2026-09-21", "LG유플러스 자소서 작성", "2026-09-27", "todo", "취업", 90),
  task("0921-05", "PDS-2026-09-21", "오픽 공부 방법 찾기", "2026-09-27", "todo", "자기계발", 30),
  task("0922-01", "PDS-2026-09-21", "취창 강의 듣기", "2026-09-22", "completed", "학업"),
  task("0922-02", "PDS-2026-09-21", "파이썬 강의 듣기", "2026-09-22", "completed", "학업"),
  task("0922-03", "PDS-2026-09-21", "CNU with U 학습법 워크", "2026-09-30", "todo", "학업"),

  task("0928-01", "PDS-2026-09-28", "아침 리추얼", "2026-09-28", "completed", "리추얼"),
  task("0928-02", "PDS-2026-09-28", "마무리 리추얼", "2026-09-28", "completed", "리추얼"),
  task("0928-03", "PDS-2026-09-28", "주식 영상 찾아보기", "2026-09-30", "todo", "자기계발", 30),
  task("0928-04", "PDS-2026-09-28", "CNU with U 학습법 워크", "2026-09-30", "todo", "학업"),
  task("0928-05", "PDS-2026-09-28", "CJ올리브네트웍스 지원하기", "2026-09-30", "todo", "취업", 90),
  task("0928-06", "PDS-2026-09-28", "대학영어 24일 강의 영상 보기", "2026-09-30", "todo", "학업"),
  task("0928-07", "PDS-2026-09-28", "가계부 작성", "2026-09-30", "todo", "생활", 20),

  task("1003-01", "PDS-2026-10-03", "ALEPH 과제", "2026-10-03", "todo", "ALEPH"),
  task("1003-02", "PDS-2026-10-03", "캡스톤 공부", "2026-10-03", "todo", "학업"),
  task("1003-03", "PDS-2026-10-03", "토익 공부", "2026-10-03", "todo", "자기계발"),
  task("1003-04", "PDS-2026-10-03", "파이썬 보고서 작성", "2026-10-31", "todo", "학업", 120),
  task("1003-05", "PDS-2026-10-03", "대학영어 강의 듣기", "2026-10-06", "todo", "학업"),
  task("1003-06", "PDS-2026-10-03", "대학영어 과제 8", "2026-10-06", "todo", "학업"),

  task("1006-01", "PDS-2026-10-05", "대학영어 강의 듣기", "2026-10-06", "completed", "학업"),
  task("1006-02", "PDS-2026-10-05", "대학영어 과제 8·9", "2026-10-06", "completed", "학업"),
  task("1006-03", "PDS-2026-10-05", "대학영어 과제 11", "2026-10-07", "completed", "학업"),
  task("1006-04", "PDS-2026-10-05", "ALEPH 과제", "2026-10-06", "todo", "ALEPH"),
  task("1006-05", "PDS-2026-10-05", "캡스톤 공부", "2026-10-06", "todo", "학업"),
  task("1007-01", "PDS-2026-10-05", "취업과 창업 Zoom 참여", "2026-10-07", "completed", "학업"),
  task("1007-02", "PDS-2026-10-05", "파이썬 강의 듣기", "2026-10-07", "completed", "학업"),
  task("1007-03", "PDS-2026-10-05", "파이썬 과제 하기", "2026-10-07", "completed", "학업"),
  task("1008-01", "PDS-2026-10-05", "대학영어 과제 12", "2026-10-08", "todo", "학업"),
  task("1008-02", "PDS-2026-10-05", "SK브로드밴드 지원", "2026-10-08", "todo", "취업", 90),
  task("1011-01", "PDS-2026-10-05", "기업 공고 보고 지원하기", "2026-10-11", "todo", "취업", 90),
  task("1011-02", "PDS-2026-10-05", "파이썬 보고서 작성", "2026-10-31", "todo", "학업", 120),

  task("1012-01", "PDS-2026-10-12", "아침 리추얼", "2026-10-12", "completed", "리추얼"),
  task("1012-02", "PDS-2026-10-12", "마무리 리추얼", "2026-10-12", "completed", "리추얼"),
  task("1012-03", "PDS-2026-10-12", "대학영어 과제 12 제출", "2026-10-12", "todo", "학업"),
  task("1012-04", "PDS-2026-10-12", "파이썬 강의 듣기", "2026-10-12", "todo", "학업"),
  task("1012-05", "PDS-2026-10-12", "캡스톤 공부", "2026-10-12", "todo", "학업"),
  task("1012-06", "PDS-2026-10-12", "ALEPH 밀린 강의 듣기", "2026-10-12", "todo", "ALEPH"),
  task("1012-07", "PDS-2026-10-12", "ALEPH 과제", "2026-10-12", "todo", "ALEPH"),
  task("1012-08", "PDS-2026-10-12", "파이썬 보고서 작성 (31일까지)", "2026-10-31", "todo", "학업", 120),
  task("1012-09", "PDS-2026-10-12", "기업 공고 보고 지원하기", "2026-10-12", "todo", "취업", 90),
  task("1013-01", "PDS-2026-10-12", "아침 리추얼", "2026-10-13", "completed", "리추얼"),
  task("1013-02", "PDS-2026-10-12", "마무리 리추얼", "2026-10-13", "completed", "리추얼"),
  task("1013-03", "PDS-2026-10-12", "파이썬 강의 수강", "2026-10-13", "completed", "학업"),
  task("1013-04", "PDS-2026-10-12", "취업과 창업 강의 수강", "2026-10-13", "completed", "학업"),
  task("1013-05", "PDS-2026-10-12", "캡스톤 5주차 공부", "2026-10-13", "completed", "학업"),
  task("1013-06", "PDS-2026-10-12", "대학영어 과제 12 제출", "2026-10-13", "completed", "학업"),
  task("1013-07", "PDS-2026-10-12", "대학영어 과제 13 제출", "2026-10-13", "completed", "학업"),
  task("1013-08", "PDS-2026-10-12", "ALEPH 방어전 7단계 하기", "2026-10-13", "completed", "ALEPH"),
  task("1014-01", "PDS-2026-10-12", "아침 리추얼", "2026-10-14", "completed", "리추얼"),
  task("1014-02", "PDS-2026-10-12", "마무리 리추얼", "2026-10-14", "completed", "리추얼"),
  task("1014-03", "PDS-2026-10-12", "ALEPH 방어전 8단계 하기", "2026-10-14", "completed", "ALEPH"),
  task("1014-04", "PDS-2026-10-12", "ALEPH 방어전 9단계 하기", "2026-10-14", "completed", "ALEPH"),
  task("1014-05", "PDS-2026-10-12", "ALEPH 방어전 10단계 하기", "2026-10-14", "completed", "ALEPH"),
  task("1014-06", "PDS-2026-10-12", "ALEPH 방어전 11단계 하기", "2026-10-14", "completed", "ALEPH"),
  task("1014-07", "PDS-2026-10-12", "ALEPH 방어전 12단계 하기", "2026-10-14", "completed", "ALEPH"),
  task("1015-01", "PDS-2026-10-12", "아침 리추얼", "2026-10-15", "completed", "리추얼"),
  task("1015-02", "PDS-2026-10-12", "마무리 리추얼", "2026-10-15", "completed", "리추얼"),
  task("1015-03", "PDS-2026-10-12", "ALEPH 방어전 보너스 작전", "2026-10-15", "todo", "ALEPH"),
  task("1015-04", "PDS-2026-10-12", "ALEPH 밀린 강의 듣기", "2026-10-15", "todo", "ALEPH"),
  task("1015-05", "PDS-2026-10-12", "ALEPH 과제", "2026-10-15", "todo", "ALEPH"),
  task("1016-01", "PDS-2026-10-12", "아침 리추얼", "2026-10-16", "completed", "리추얼"),
  task("1016-02", "PDS-2026-10-12", "마무리 리추얼", "2026-10-16", "completed", "리추얼"),
  task("1016-03", "PDS-2026-10-12", "파이썬 Zoom 수업 참여", "2026-10-16", "completed", "학업"),
  task("1016-04", "PDS-2026-10-12", "ALEPH 방어전 보너스 작전", "2026-10-16", "completed", "ALEPH"),
  task("1017-01", "PDS-2026-10-12", "ALEPH 밀린 강의 듣기", "2026-10-17", "todo", "ALEPH"),
  task("1017-02", "PDS-2026-10-12", "ALEPH 과제", "2026-10-17", "todo", "ALEPH"),
  task("1017-03", "PDS-2026-10-12", "파이썬 보고서 작성 (31일까지)", "2026-10-31", "todo", "학업", 120),
  task("1017-04", "PDS-2026-10-12", "기업 공고 보고 지원하기", "2026-10-17", "todo", "취업", 90),
  task("1017-05", "PDS-2026-10-12", "ALEPH 10/6 보충강의 듣기", "2026-10-17", "todo", "ALEPH"),
  task("1017-06", "PDS-2026-10-12", "대학영어 1차 공부하기", "2026-10-17", "todo", "학업"),
  task("1017-07", "PDS-2026-10-12", "파이썬 1차 공부하기", "2026-10-17", "todo", "학업"),
  task("1017-08", "PDS-2026-10-12", "취업과 창업 1차 공부", "2026-10-17", "todo", "학업"),
  task("1018-safe", "PDS-2026-10-12", "안전 표시 확인: <script>alert('test')</script>", "2026-10-18", "todo", "안전검사", 5),
];
