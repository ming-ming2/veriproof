# Sprint 3 — 실시간 이벤트 / 답안 재생 / 감독관 대시보드 스펙

범위: 백로그 13·14·15·16·17·18
관련 문서: [API_SPEC.md](./API_SPEC.md), [DB_SCHEMA.md](./DB_SCHEMA.md), [product-backlog.md](./product-backlog.md)

---

## 1. 백로그 매핑

| 백로그 | 영역 | 책임 |
|---|---|---|
| 13 | 학생 → 서버 즉시 이벤트 수집 (paste·visibility·fullscreen·capture) | 백엔드 |
| 14 | 학생 → 서버 배치 이벤트 + 답안 스냅샷 (keystroke·choice change·navigation) | 백엔드 |
| 15 | 종료된 시험 답안 재생 | 백엔드 + 프론트 |
| 16 | 감독관 대시보드 접속 (토큰 인증, 학생 카드 목록) | 백엔드 + 프론트 |
| 17 | 주목도 정렬 + 학생 상세 패널 (실시간 1초 갱신) | 백엔드 + 프론트 |
| 18 | 이벤트 피드 (전체 시험 이벤트 시간 역순) | 백엔드 + 프론트 |

---

## 2. 아키텍처

### 2.1 통신 채널

| 방향 | 채널 |
|---|---|
| 학생 → 서버 | HTTP POST |
| 서버 → 감독관 | Server-Sent Events (SSE) |

### 2.2 SSE 팬아웃

감독관 SSE 구독자는 인메모리 `Map<examId, List<SseEmitter>>`로 관리. `EventBroadcaster` 인터페이스를 통해 호출.

### 2.3 데이터 영속화

| 데이터 | 저장소 |
|---|---|
| 응시 활성 lock | Redis String |
| 작성 중 답안 (자동제출 백업·재접속 복구) | Redis Hash |
| 실시간 이벤트 | PostgreSQL `event_log` |
| 답안 스냅샷 (1분 단위) | PostgreSQL `answer_snapshot` |
| 주목도 점수 | Redis ZSET |
| 응시 중 학생 메타 | Redis Hash |
| 시그널별 누적 카운트 | Redis Hash |

`Redis draft`(매 변경마다 덮어쓰기)와 `answer_snapshot`(1분마다 append)은 별도 컨테이너로 유지.

---

## 3. 데이터 모델

### 3.1 DB 스키마 — Flyway V4

```sql
-- V4__realtime_events.sql

CREATE TABLE event_log (
    id                  BIGSERIAL PRIMARY KEY,
    exam_session_id     BIGINT NOT NULL REFERENCES exam_session(id) ON DELETE CASCADE,
    exam_id             BIGINT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    event_type          VARCHAR(40) NOT NULL,
    question_id         BIGINT REFERENCES question(id) ON DELETE SET NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms         INTEGER,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_event_session_time ON event_log(exam_session_id, occurred_at);
CREATE INDEX idx_event_exam_time    ON event_log(exam_id, occurred_at DESC);
CREATE INDEX idx_event_type         ON event_log(event_type);

CREATE TABLE answer_snapshot (
    id                  BIGSERIAL PRIMARY KEY,
    exam_session_id     BIGINT NOT NULL REFERENCES exam_session(id) ON DELETE CASCADE,
    question_id         BIGINT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    captured_at         TIMESTAMPTZ NOT NULL,
    answer_text         TEXT,
    selected_choice_ids BIGINT[]
);

CREATE INDEX idx_snapshot_session_q_time ON answer_snapshot(exam_session_id, question_id, captured_at);
```

- PK: `BIGSERIAL`
- `exam_id`는 `event_log`에 비정규화
- `duration_ms`는 visibility/fullscreen 페어링 결과를 RESTORED/ENTER row에 기록
- `payload`: JSONB

### 3.2 Redis 키

| 키 | 자료구조 | TTL | 백로그 |
|---|---|---|---|
| `exam:{examId}:active:{stuNo}` | String | 30s (heartbeat 갱신) | 19, 20 |
| `session:{uuid}:draft` | Hash | `endsAt + 10min` | 9, 21 |
| `exam:{examId}:attention` | ZSET | `endsAt + 1h` | 17 |
| `exam:{examId}:active_sessions` | Hash | `endsAt + 1h` | 16, 17 |
| `session:{uuid}:signals` | Hash | `endsAt + 1h` | 17 |

- `attention`: member = `sessionUuid`, score = 누적 시그널 수
- `active_sessions`: field = `sessionUuid`, value = JSON `{studentNumber, studentName, currentQuestionId, lastActivityAt}`
- `signals`: field = 시그널 타입(`paste`, `visibility_lost`, ...), value = 카운트

---

## 4. 이벤트 카탈로그

### 4.1 즉시 이벤트 (백로그 13)

| `event_type` | 발생 시점 | `payload` | 점수 |
|---|---|---|---|
| `PASTE` | 붙여넣기 감지 | `{length: int, preview: string(≤50자)}` | +1 |
| `VISIBILITY_LOST` | alt-tab, 최소화, 창 전환 | `{}` | 0 |
| `VISIBILITY_RESTORED` | 응시 화면 복귀 | `{pairedWith: "VISIBILITY_LOST"}` (서버에서 `duration_ms` 채움) | +1 |
| `FULLSCREEN_EXIT` | ESC, F11 등으로 전체화면 해제 | `{}` | 0 |
| `FULLSCREEN_ENTER` | 전체화면 재진입 | `{}` (서버에서 `duration_ms` 채움) | +1 |
| `CAPTURE_SHORTCUT` | PrtScn, Cmd+Shift+3/4 등 | `{key: string}` | +1 |
| `WINDOW_BLUR` | 창 포커스 상실 | `{}` | +1 |

### 4.2 배치 이벤트 (백로그 14)

매 60초마다 누적 후 전송. 답안 제출 시 잔여분 함께 flush.

| `event_type` | 의미 | `payload` | 점수 |
|---|---|---|---|
| `KEYSTROKE` | 키 입력 1회 | `{key: string, action: "insert"\|"delete"}` | 0 |
| `CHOICE_CHANGE` | 객관식 선택 변경 | `{from: [choiceId], to: [choiceId]}` | 0 |
| `QUESTION_NAVIGATE` | 문항 간 이동 | `{fromQuestionId, toQuestionId}` | 0 |

### 4.3 서버 파생 이벤트

서버가 패턴 매칭으로 생성하는 이벤트.

| `event_type` | 발생 조건 | `payload` | 점수 |
|---|---|---|---|
| `SUSPICIOUS_CHOICE_CHANGE` | `VISIBILITY_RESTORED` 또는 `FULLSCREEN_ENTER` 후 5초 이내 `CHOICE_CHANGE` 도착 | `{originalChoiceChangeId, restoredAt, deltaMs}` | +1 |

### 4.4 점수 정책

- 모든 의심 시그널 +1 균등.
- 점수 갱신은 이벤트 INSERT 후 `ZINCRBY exam:{examId}:attention 1 {sessionUuid}` + signals hash `HINCRBY +1` + 감독관 SSE push.

### 4.5 주목도 레벨 임계점

| 레벨 | 임계 점수 | UI 표시 |
|---|---|---|
| `HIGH` (강조) | ≥ 4 | 빨강 |
| `MID` (주의) | ≥ 2 | 주황 |
| `LOW` (보통) | ≥ 1 | 노랑 |
| `NORMAL` (평범) | 0 | 기본 |

---

## 5. API 명세

### 5.1 학생용 (백로그 13, 14)

base path: `/api/v1/student`, 모든 엔드포인트 `X-Session-Token` 헤더 필수.

#### `POST /sessions/me/events` — 즉시 이벤트

```json
// req
{
  "events": [
    {
      "type": "PASTE",
      "occurredAt": "2026-05-13T10:01:23.456Z",
      "questionId": 10,
      "payload": { "length": 142, "preview": "BFS는 너비 우선 탐색의 약자로..." }
    },
    {
      "type": "VISIBILITY_LOST",
      "occurredAt": "2026-05-13T10:02:00.000Z",
      "questionId": 10
    },
    {
      "type": "VISIBILITY_RESTORED",
      "occurredAt": "2026-05-13T10:02:08.000Z",
      "questionId": 10
    }
  ]
}
// res 204
```

서버 처리:
1. 각 이벤트를 `event_log` INSERT
2. `VISIBILITY_RESTORED` / `FULLSCREEN_ENTER` 도착 시 같은 세션의 가장 가까운 미페어링 LOST/EXIT을 찾아 `duration_ms` 계산 후 RESTORED row에 기록
3. 점수 부여 대상 이벤트는 `ZINCRBY` + signals hash 갱신
4. `EventBroadcaster.publish(examId, sseEvent)` 호출

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`, 400 `EXAM_ENDED`.

#### `POST /sessions/me/events/batch` — 배치 이벤트 + 답안 스냅샷

```json
// req
{
  "batchPeriodStart": "2026-05-13T10:00:00Z",
  "batchPeriodEnd":   "2026-05-13T10:01:00Z",
  "events": [
    { "type": "KEYSTROKE", "occurredAt": "...", "questionId": 10, "payload": {"key":"B","action":"insert"} },
    { "type": "CHOICE_CHANGE", "occurredAt": "...", "questionId": 11, "payload": {"from":[101],"to":[101,103]} },
    { "type": "QUESTION_NAVIGATE", "occurredAt": "...", "payload": {"fromQuestionId":10,"toQuestionId":11} }
  ],
  "snapshots": [
    { "questionId": 10, "capturedAt": "...", "answerText": "BFS는 너비 우선...", "selectedChoiceIds": null },
    { "questionId": 11, "capturedAt": "...", "answerText": null, "selectedChoiceIds": [101,103] }
  ]
}
// res 204
```

서버 처리:
- 모든 events → `event_log` 일괄 INSERT
- 모든 snapshots → `answer_snapshot` 일괄 INSERT
- `CHOICE_CHANGE` 도착 시 직전 5초 내 `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER`가 있으면 `SUSPICIOUS_CHOICE_CHANGE` 파생 row 추가 INSERT + 점수 +1

답안 제출(`POST /sessions/me/submit`) 시 클라이언트는 마지막 1분 미만 데이터를 이 페이로드로 함께 전송. 서버는 submit 처리 전 batch flush.

### 5.2 답안 재생 (백로그 15)

base path: `/api/v1/exams/{examId}/sessions/{sessionId}`, 교수 JWT 필수, 본인 시험만.

#### `GET /replay` — 재생 데이터 일괄

```json
// res 200
{
  "data": {
    "sessionId": 1,
    "studentNumber": "20230001",
    "studentName": "...",
    "examTitle": "...",
    "startedAt": "...",
    "submittedAt": "...",
    "questions": [
      { "id": 10, "questionType": "SUBJECTIVE", "body": "...", "displayOrder": 1, "points": 25 }
    ],
    "timeline": [
      { "t": 0,     "type": "QUESTION_NAVIGATE", "questionId": 10, "payload": {"toQuestionId":10} },
      { "t": 1234,  "type": "KEYSTROKE", "questionId": 10, "payload": {"key":"B","action":"insert"} },
      { "t": 5000,  "type": "PASTE", "questionId": 10, "payload": {"length":142,"preview":"..."} },
      { "t": 8000,  "type": "VISIBILITY_LOST", "questionId": 10 },
      { "t": 14000, "type": "VISIBILITY_RESTORED", "questionId": 10, "payload":{"durationMs":6000} },
      { "t": 14100, "type": "CHOICE_CHANGE", "questionId": 11, "payload":{"from":[],"to":[103]} },
      { "t": 14100, "type": "SUSPICIOUS_CHOICE_CHANGE", "questionId": 11, "payload":{"deltaMs":100} }
    ],
    "snapshots": [
      { "t": 60000, "questionId": 10, "answerText": "BFS는...", "selectedChoiceIds": null }
    ]
  }
}
```

- `t` = `startedAt`으로부터의 상대 ms
- timeline은 `occurred_at` 오름차순. `SUSPICIOUS_CHOICE_CHANGE`는 원본 `CHOICE_CHANGE`와 동일 timestamp로 함께 등장
- snapshots는 `captured_at` 오름차순. 임의 시점 점프 시 가장 가까운 snapshot 기준으로 초기 상태 복원 후 timeline forward 재생

에러: 404 `SESSION_NOT_FOUND`, 403 `FORBIDDEN`, 400 `SESSION_NOT_SUBMITTED`.

### 5.3 감독관용 (백로그 16, 17, 18)

base path: `/api/v1/proctor`. 인증은 URL의 `proctorToken`(UUID, `exam.proctor_token`과 직접 매칭).

#### `GET /exams/{proctorToken}` — 대시보드 메타 (백로그 16)

```json
// res 200
{
  "data": {
    "examId": 1,
    "title": "...",
    "startsAt": "...",
    "endsAt": "...",
    "rosterCount": 30,
    "activeCount": 28
  }
}
```

#### `GET /exams/{proctorToken}/students` — 학생 카드 목록 (16, 17)

쿼리: `?sort=attention|studentNumber` (기본 `attention`)

```json
// res 200
{
  "data": [
    {
      "sessionUuid": "...",
      "studentNumber": "20230001",
      "studentName": "...",
      "currentQuestionId": 10,
      "lastActivityAt": "...",
      "attentionScore": 7,
      "attentionLevel": "HIGH",
      "status": "IN_PROGRESS"
    }
  ]
}
```

데이터 소스: Redis `ZREVRANGE exam:{examId}:attention 0 -1 WITHSCORES` + `active_sessions` Hash JOIN.

#### `GET /exams/{proctorToken}/students/{sessionUuid}` — 학생 상세 (17)

```json
// res 200
{
  "data": {
    "studentNumber": "...",
    "studentName": "...",
    "attentionScore": 7,
    "attentionLevel": "HIGH",
    "signals": {
      "paste": 3,
      "visibilityLost": 2,
      "fullscreenExit": 1,
      "captureShortcut": 0,
      "suspiciousChoiceChange": 1
    },
    "avgVisibilityDurationMs": 4200,
    "recentEvents": [
      { "type": "PASTE", "occurredAt": "...", "questionId": 10, "payload": {...} }
    ],
    "currentAnswerPreview": {
      "questionId": 10,
      "answerText": "BFS는 너비 우선...",
      "selectedChoiceIds": null
    }
  }
}
```

데이터 소스:
- `signals.*`: Redis `signals` Hash
- `avgVisibilityDurationMs`: `event_log` 집계 (`AVG(duration_ms) WHERE event_type='VISIBILITY_RESTORED'`)
- `recentEvents`: `event_log` 최근 20건
- `currentAnswerPreview`: Redis `draft`에서 현재 문항만 read

#### `GET /exams/{proctorToken}/events` — 이벤트 피드 (18)

쿼리: `?since={iso}&limit=50`

```json
// res 200
{
  "data": [
    {
      "id": 12345,
      "sessionUuid": "...",
      "studentNumber": "20230001",
      "type": "VISIBILITY_RESTORED",
      "questionId": 10,
      "occurredAt": "...",
      "durationMs": 6000,
      "payload": {}
    }
  ]
}
```

SSE 초기 적재 + 재연결 시 갭 보충에 사용.

#### `GET /exams/{proctorToken}/stream` — SSE 실시간 채널 (17, 18)

```
GET /api/v1/proctor/exams/{proctorToken}/stream
Accept: text/event-stream
```

서버 push 이벤트:

```
event: student-event
data: {"id":12345,"sessionUuid":"...","studentNumber":"...","type":"PASTE","questionId":10,"occurredAt":"...","payload":{...}}

event: attention-update
data: {"sessionUuid":"...","score":7,"level":"HIGH","delta":1}

event: session-status
data: {"sessionUuid":"...","status":"SUBMITTED"}

event: heartbeat
data: {}
```

- 30초마다 `heartbeat` 송신
- `student-event`: 피드 prepend
- `attention-update`: 카드 색상/위치 갱신
- `session-status`: 카드 제거 또는 비활성화

---

## 6. 구현 컴포넌트

### 6.1 백엔드 패키지/파일

```
domain/event/
  controller/StudentEventController.java         # POST /sessions/me/events, /events/batch
  service/EventIngestService.java                # event_log INSERT + 페어링 + SUSPICIOUS 파생
  service/AttentionScoreService.java             # ZINCRBY + signals hash + 레벨 계산
  service/EventBroadcaster.java                  # 인터페이스
  service/InMemoryEventBroadcaster.java          # Map<examId, List<SseEmitter>> 구현체
  service/SnapshotService.java                   # answer_snapshot INSERT
  dto/EventRequest.java, EventBatchRequest.java
  entity/EventLog.java, AnswerSnapshot.java
  repository/EventLogRepository.java, AnswerSnapshotRepository.java

domain/replay/
  controller/ReplayController.java               # GET /exams/{id}/sessions/{sId}/replay
  service/ReplayService.java                     # timeline 가공
  dto/ReplayResponse.java

domain/proctor/
  controller/ProctorController.java              # GET /proctor/exams/...
  service/ProctorService.java
  service/ProctorSseService.java                 # SseEmitter 등록/해제
  dto/ProctorResponse.java

infra/redis/
  AttentionStore.java                            # ZINCRBY/ZREVRANGE wrapper
  ActiveSessionStore.java                        # active_sessions hash wrapper
  SignalCounterStore.java                        # signals hash wrapper
```

### 6.2 `EventBroadcaster` 인터페이스

```java
public interface EventBroadcaster {
    SseEmitter subscribe(Long examId);
    void publish(Long examId, SseEvent event);
}
```

### 6.3 페어링 로직

`VISIBILITY_RESTORED` 도착 시:
1. 같은 `exam_session_id`에서 `event_type='VISIBILITY_LOST'`이고 `duration_ms IS NULL`인 가장 최근 row 조회
2. `duration_ms = restored.occurredAt - lost.occurredAt` 계산하여 RESTORED row에 기록
3. 점수 +1

`FULLSCREEN_EXIT` / `FULLSCREEN_ENTER`도 동일 로직.

---

## 7. 작업 분담 / PR 순서

| PR | 산출물 | 의존 | 담당 |
|---|---|---|---|
| PR-1 | Flyway V4, 엔티티/Repo 스켈레톤, `EventBroadcaster` 인터페이스 | — | 13/14/15 백엔드 |
| PR-2 | 백로그 13 (`POST /sessions/me/events` + 페어링 + 점수 갱신 + broadcast) | PR-1 | 13/14/15 백엔드 |
| PR-3 | 백로그 14 (`POST /sessions/me/events/batch` + snapshot 저장 + SUSPICIOUS 파생) | PR-1 | 13/14/15 백엔드 |
| PR-4 | 백로그 15 (`GET /replay` + timeline 가공) | PR-1, PR-3 | 13/14/15 백엔드 |
| PR-5 | 백로그 16 (감독관 메타/카드 목록 + active_sessions hash) | PR-1, PR-2 | 16/17/18 백엔드 |
| PR-6 | 백로그 17 (학생 상세 + 주목도 정렬) | PR-2, PR-5 | 16/17/18 백엔드 |
| PR-7 | 백로그 18 (SSE stream + events 폴백 GET + `InMemoryEventBroadcaster`) | PR-2, PR-5 | 16/17/18 백엔드 |
| FE-A | 학생 응시 페이지 이벤트 수집 훅 + 60초 배치 타이머 | PR-2, PR-3 | 프론트 |
| FE-B | 감독관 대시보드 페이지 + SSE 구독 | PR-5~7 | 프론트 |
| FE-C | 답안 재생 페이지 (타임라인 바, 배속 컨트롤) | PR-4 | 프론트 |

---

## 8. 후속 문서

- `docs/API_SPEC.md` — Sprint 3 엔드포인트 섹션
- `docs/DB_SCHEMA.md` — V4 마이그레이션 + Redis 키 확장
- `docs/FEATURES.md` — 실시간 이벤트·재생·감독관 기능 정의
- `docs/sprint3-progress.md` — Sprint 3 개발 진행 누적 로그
