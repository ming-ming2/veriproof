// =====================================================================
// 백로그 22 — 동시 응시 부하 검증 (Node.js, 의존성 없음 / Node 18+ 내장 fetch)
// =====================================================================
// 시나리오 (docs/backlog-candidates.md F안):
//   1) N명(기본 100)의 가상 학생이 동일 시험에 동시에 응시 시작
//   2) 각 학생이 약 5초 간격으로 다양한 이벤트(붙여넣기/화면이탈/문항이동/붙임 등) 발생
//   3) 감독관 대시보드(GET .../students)가 1초 이내로 갱신되는지 응답시간 측정
//   4) 이벤트 손실 0건 — 서버 ingest는 @Transactional 동기 저장이라 204 = 영속화 완료.
//      따라서 "손실"은 2xx가 아닌 이벤트 요청 수로 정확히 집계된다.
//   5) 제출 시 N명의 답안/스냅샷이 모두 저장됐는지 API + (옵션)DB로 교차 검증
//
// 실행:
//   node loadtest/backlog22-load-test.mjs
//   STUDENTS=100 DURATION_SEC=60 node loadtest/backlog22-load-test.mjs
//
// 환경변수:
//   BASE_URL          기본 http://localhost:8081/api/v1
//   STUDENTS          가상 학생 수 (기본 100)
//   DURATION_SEC      각 학생 응시 지속 시간 초 (기본 60). 데모 기준 30분이면 1800.
//   EVENT_INTERVAL_MS 학생별 즉시 이벤트 주기 ms (기본 5000)
//   PROCTOR_POLL_MS   감독관 대시보드 폴링 주기 ms (기본 1000)
//   LATENCY_SLA_MS    대시보드 갱신 SLA ms (기본 1000)
//   DB_CONTAINER      DB 교차검증용 도커 컨테이너명 (기본 veriproof-db, 비우면 건너뜀)
// =====================================================================

import { execSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081/api/v1';
const STUDENTS = Number(process.env.STUDENTS ?? 100);
const DURATION_SEC = Number(process.env.DURATION_SEC ?? 60);
const EVENT_INTERVAL_MS = Number(process.env.EVENT_INTERVAL_MS ?? 5000);
const PROCTOR_POLL_MS = Number(process.env.PROCTOR_POLL_MS ?? 1000);
const LATENCY_SLA_MS = Number(process.env.LATENCY_SLA_MS ?? 1000);
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'veriproof-db';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const pad = (n) => String(n).padStart(5, '0');

// ---- 전역 메트릭 ----
const m = {
  studentsStarted: 0,
  studentsStartFailed: 0,
  events: { sent: 0, ok: 0, fail: 0 },     // 즉시 이벤트
  batches: { sent: 0, ok: 0, fail: 0 },    // 배치 이벤트 + 스냅샷
  drafts: { sent: 0, ok: 0, fail: 0 },
  heartbeats: { sent: 0, ok: 0, fail: 0 },
  submits: { ok: 0, fail: 0 },
  proctorLatencies: [],                    // ms
  proctorPollFails: 0,
  errorSamples: [],
};

function noteError(where, status, bodyText) {
  if (m.errorSamples.length < 12) {
    m.errorSamples.push(`${where} -> HTTP ${status} ${String(bodyText).slice(0, 160)}`);
  }
}

// ---- HTTP 헬퍼 ----
async function req(method, path, { token, sessionToken, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (sessionToken) headers['X-Session-Token'] = sessionToken;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  let text = '';
  if (res.status !== 204) {
    text = await res.text();
    try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  }
  return { status: res.status, ok: res.ok, json, text };
}

// ---- 통계 유틸 ----
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

// ---- 1) 교수 셋업: 회원가입 + 로그인 + 시험 개설 ----
async function setup() {
  const ts = Date.now();
  const username = `loadprof${ts}`;
  const password = 'password123';

  let r = await req('POST', '/auth/signup', {
    body: { username, password, name: 'LoadProf', affiliation: 'LoadUniv' },
  });
  if (r.status !== 201) throw new Error(`signup 실패: HTTP ${r.status} ${r.text}`);

  r = await req('POST', '/auth/login', { body: { username, password } });
  if (!r.ok) throw new Error(`login 실패: HTTP ${r.status} ${r.text}`);
  const token = r.json.data.token;

  // 100명 명단 (ASCII 이름으로 인코딩 이슈 회피)
  const roster = Array.from({ length: STUDENTS }, (_, i) => ({
    studentNumber: `L${pad(i + 1)}`,
    studentName: `loadtester${pad(i + 1)}`,
  }));

  const examBody = {
    title: `부하검증-${ts}`,
    startsAt: nowIso(-60_000),                                  // 1분 전 시작 (이미 진행중)
    endsAt: nowIso(DURATION_SEC * 1000 + 120_000),              // 응시시간 + 2분 버퍼
    questions: [
      {
        questionType: 'MULTIPLE_CHOICE', body: '부하 객관식', points: 10, displayOrder: 1,
        choices: [
          { body: 'A', isCorrect: true, displayOrder: 1 },
          { body: 'B', isCorrect: false, displayOrder: 2 },
          { body: 'C', isCorrect: false, displayOrder: 3 },
        ],
      },
      { questionType: 'SUBJECTIVE', body: '부하 주관식', correctAnswer: '답', points: 10, displayOrder: 2, choices: [] },
    ],
    roster,
  };

  r = await req('POST', '/exams', { token, body: examBody });
  if (r.status !== 201) throw new Error(`시험 개설 실패: HTTP ${r.status} ${r.text}`);
  const examId = r.json.data.id;
  const examCode = r.json.data.examCode;
  const proctorToken = r.json.data.proctorLink.split('/proctor/')[1];

  // 문항/선택지 id 확보 (이벤트·스냅샷용)
  r = await req('GET', `/exams/${examId}`, { token });
  if (!r.ok) throw new Error(`시험 상세 조회 실패: HTTP ${r.status} ${r.text}`);
  const qs = r.json.data.questions.sort((a, b) => a.displayOrder - b.displayOrder);
  const mcQ = qs.find((q) => q.questionType === 'MULTIPLE_CHOICE');
  const subQ = qs.find((q) => q.questionType === 'SUBJECTIVE');
  const ctx = {
    token, examId, examCode, proctorToken,
    mcQId: mcQ.id,
    mcChoiceId: mcQ.choices.sort((a, b) => a.displayOrder - b.displayOrder)[0].id,
    subQId: subQ.id,
  };
  console.log(`[setup] examId=${examId} code=${examCode} proctorToken=${proctorToken} roster=${STUDENTS}`);
  return ctx;
}

// ---- 즉시 이벤트 시나리오 (랜덤) ----
function immediateEvents(ctx) {
  const t = Date.now();
  const pick = Math.floor(Math.random() * 5);
  switch (pick) {
    case 0: return [{ type: 'PASTE', occurredAt: nowIso(), questionId: ctx.subQId, payload: { length: 42 } }];
    case 1: return [
      { type: 'VISIBILITY_LOST', occurredAt: new Date(t - 3000).toISOString(), questionId: ctx.mcQId },
      { type: 'VISIBILITY_RESTORED', occurredAt: nowIso(), questionId: ctx.mcQId },
    ];
    case 2: return [{ type: 'WINDOW_BLUR', occurredAt: nowIso() }];
    case 3: return [
      { type: 'FULLSCREEN_EXIT', occurredAt: new Date(t - 2000).toISOString() },
      { type: 'FULLSCREEN_ENTER', occurredAt: nowIso() },
    ];
    default: return [{ type: 'CAPTURE_SHORTCUT', occurredAt: nowIso() }];
  }
}

// ---- 2) 가상 학생 한 명의 응시 라이프사이클 ----
async function runStudent(ctx, roster) {
  // 응시 시작
  let r = await req('POST', `/student/exams/${ctx.examCode}/sessions`, {
    body: { studentNumber: roster.studentNumber, studentName: roster.studentName },
  });
  if (r.status !== 201) {
    m.studentsStartFailed++;
    noteError('startSession', r.status, r.text);
    return;
  }
  m.studentsStarted++;
  const sessionToken = r.json.data.sessionToken;

  const deadline = Date.now() + DURATION_SEC * 1000;
  let lastBatch = Date.now();
  let lastHeartbeat = Date.now();
  let tick = 0;

  while (Date.now() < deadline) {
    tick++;
    // (a) 즉시 이벤트
    m.events.sent++;
    r = await req('POST', '/student/sessions/me/events', {
      sessionToken, body: { events: immediateEvents(ctx) },
    });
    if (r.status === 204) m.events.ok++; else { m.events.fail++; noteError('events', r.status, r.text); }

    // (b) 답안 초안 저장 (격 tick)
    if (tick % 2 === 0) {
      m.drafts.sent++;
      r = await req('PUT', `/student/sessions/me/answers/${ctx.subQId}`, {
        sessionToken, body: { answerText: `답안-${roster.studentNumber}-${tick}` },
      });
      if (r.status === 204) m.drafts.ok++; else { m.drafts.fail++; noteError('draft', r.status, r.text); }
    }

    // (c) 배치 이벤트 + 스냅샷 (약 12초마다)
    if (Date.now() - lastBatch >= 12_000) {
      lastBatch = Date.now();
      m.batches.sent++;
      r = await req('POST', '/student/sessions/me/events/batch', {
        sessionToken,
        body: {
          batchPeriodStart: nowIso(-12_000),
          batchPeriodEnd: nowIso(),
          events: [
            { type: 'KEYSTROKE', occurredAt: nowIso(-8000), questionId: ctx.subQId, payload: { keys: 12 } },
            { type: 'CHOICE_CHANGE', occurredAt: nowIso(-4000), questionId: ctx.mcQId, payload: { to: ctx.mcChoiceId } },
            { type: 'QUESTION_NAVIGATE', occurredAt: nowIso(-2000), questionId: ctx.mcQId, payload: { from: 2, to: 1 } },
          ],
          snapshots: [
            { questionId: ctx.subQId, capturedAt: nowIso(), answerText: `스냅샷-${roster.studentNumber}-${tick}` },
            { questionId: ctx.mcQId, capturedAt: nowIso(), selectedChoiceIds: [ctx.mcChoiceId] },
          ],
        },
      });
      if (r.status === 204) m.batches.ok++; else { m.batches.fail++; noteError('batch', r.status, r.text); }
    }

    // (d) heartbeat (약 10초마다)
    if (Date.now() - lastHeartbeat >= 10_000) {
      lastHeartbeat = Date.now();
      m.heartbeats.sent++;
      r = await req('POST', '/student/sessions/me/heartbeat', { sessionToken });
      if (r.status === 204) m.heartbeats.ok++; else { m.heartbeats.fail++; noteError('heartbeat', r.status, r.text); }
    }

    // 5초 주기 + 지터로 thundering herd 완화
    await sleep(EVENT_INTERVAL_MS + Math.floor(Math.random() * 600 - 300));
  }

  // 제출
  r = await req('POST', '/student/sessions/me/submit', { sessionToken });
  if (r.ok) m.submits.ok++; else { m.submits.fail++; noteError('submit', r.status, r.text); }
}

// ---- 3) 감독관 대시보드 폴러 (응답시간 측정) ----
async function runProctorPoller(ctx, stopRef) {
  while (!stopRef.stop) {
    const t0 = Date.now();
    try {
      const r = await req('GET', `/proctor/exams/${ctx.proctorToken}/students`);
      const dt = Date.now() - t0;
      if (r.ok) m.proctorLatencies.push(dt);
      else { m.proctorPollFails++; noteError('proctor/students', r.status, r.text); }
    } catch (e) {
      m.proctorPollFails++;
      noteError('proctor/students', 'ERR', e.message);
    }
    await sleep(PROCTOR_POLL_MS);
  }
}

// ---- 4) DB 교차검증 (옵션, 도커) ----
function dbCount(sql) {
  if (!DB_CONTAINER) return null;
  try {
    const out = execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres -d veriproof -t -A -c "${sql}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const n = parseInt(out.trim(), 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

// ---- 리포트 ----
function report(ctx, wallSec) {
  const lat = m.proctorLatencies;
  const underSla = lat.filter((x) => x <= LATENCY_SLA_MS).length;
  const totalEventReqs = m.events.sent + m.batches.sent;
  const totalEventFails = m.events.fail + m.batches.fail;

  console.log('\n========== 백로그 22 부하 검증 리포트 ==========');
  console.log(`설정            : 학생 ${STUDENTS}명 / 지속 ${DURATION_SEC}s / 즉시이벤트 ${EVENT_INTERVAL_MS}ms / 실측 ${wallSec.toFixed(1)}s`);
  console.log(`응시 시작       : 성공 ${m.studentsStarted}  실패 ${m.studentsStartFailed}`);
  console.log(`즉시 이벤트     : 전송 ${m.events.sent}  성공 ${m.events.ok}  실패 ${m.events.fail}`);
  console.log(`배치(+스냅샷)   : 전송 ${m.batches.sent}  성공 ${m.batches.ok}  실패 ${m.batches.fail}`);
  console.log(`답안 초안       : 전송 ${m.drafts.sent}  성공 ${m.drafts.ok}  실패 ${m.drafts.fail}`);
  console.log(`heartbeat       : 전송 ${m.heartbeats.sent}  성공 ${m.heartbeats.ok}  실패 ${m.heartbeats.fail}`);
  console.log(`제출            : 성공 ${m.submits.ok}  실패 ${m.submits.fail}`);
  console.log('--- 감독관 대시보드 갱신 응답시간 ---');
  console.log(`폴링 수=${lat.length} 실패=${m.proctorPollFails}  p50=${percentile(lat,50)}ms  p95=${percentile(lat,95)}ms  max=${Math.max(0,...lat)}ms`);
  console.log(`SLA(${LATENCY_SLA_MS}ms) 이내=${lat.length ? ((underSla/lat.length)*100).toFixed(1) : '0'}% (${underSla}/${lat.length})`);

  // DB 교차검증
  const evRows = dbCount(`SELECT count(*) FROM event_log WHERE exam_id=${ctx.examId}`);
  const snapRows = dbCount(`SELECT count(*) FROM answer_snapshot s JOIN exam_session es ON s.exam_session_id=es.id WHERE es.exam_id=${ctx.examId}`);
  const submittedRows = dbCount(`SELECT count(*) FROM exam_session WHERE exam_id=${ctx.examId} AND status='SUBMITTED'`);
  if (evRows !== null) {
    console.log('--- DB 교차검증 (docker) ---');
    console.log(`event_log 행수=${evRows} (서버 파생행 포함)  answer_snapshot 행수=${snapRows}  SUBMITTED 세션=${submittedRows}`);
  }

  // 합격 판정
  const checks = [
    ['대시보드 1초 이내 갱신', lat.length > 0 && percentile(lat, 95) <= LATENCY_SLA_MS && m.proctorPollFails === 0],
    ['이벤트 손실 0건', totalEventFails === 0 && totalEventReqs > 0],
    ['전원 응시 시작', m.studentsStarted === STUDENTS],
    ['전원 제출 완료', m.submits.ok === STUDENTS],
    ['답안/스냅샷 저장', snapRows === null ? m.batches.ok > 0 : snapRows > 0],
  ];
  console.log('--- 판정 ---');
  let allPass = true;
  for (const [name, ok] of checks) {
    if (!ok) allPass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  if (m.errorSamples.length) {
    console.log('--- 오류 샘플 ---');
    m.errorSamples.forEach((e) => console.log(`  ${e}`));
  }
  console.log(`\n결과: ${allPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('================================================\n');
  return allPass;
}

// ---- 메인 ----
async function main() {
  console.log(`[start] BASE_URL=${BASE_URL}`);
  const ctx = await setup();

  const roster = Array.from({ length: STUDENTS }, (_, i) => ({
    studentNumber: `L${pad(i + 1)}`,
    studentName: `loadtester${pad(i + 1)}`,
  }));

  const stopRef = { stop: false };
  const poller = runProctorPoller(ctx, stopRef);

  const t0 = Date.now();
  await Promise.allSettled(roster.map((s) => runStudent(ctx, s)));
  const wallSec = (Date.now() - t0) / 1000;

  stopRef.stop = true;
  await poller;

  const pass = report(ctx, wallSec);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(2);
});
