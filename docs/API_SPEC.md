# API Spec

## 공통

### Base URL

```
http://localhost:8081/api/v1
```

### 응답

성공:

```json
{ "data": {...}, "timestamp": "2026-05-02T10:30:00Z" }
```

에러:

```json
{
  "error": { "code": "EXAM_NOT_FOUND", "message": "..." },
  "timestamp": "..."
}
```

`null` 필드는 응답에서 제외 (`@JsonInclude(NON_NULL)`).

### 인증

- 교수: `Authorization: Bearer {jwt}` (1-2에서 발급)
- 학생: `X-Session-Token: {sessionUuid}` (POST `/student/exams/{examCode}/sessions`에서 발급)
- 감독관: URL path의 `proctorToken` (UUID, `exam.proctor_token`과 직접 매칭). SSE EventSource가 커스텀 헤더를 지원하지 않아 path 매칭 채택.

### 시간

ISO 8601 UTC. `2026-05-02T10:30:00Z`

---

## Sprint 1 엔드포인트 (인증/교수 시험 관리)

### POST /auth/signup

```json
// req
{ "username": "testadmin", "password": "...", "name": "...", "affiliation": "..." }
// res 201
{ "data": { "id": 1, "username": "testadmin", "name": "..." } }
```

검증: `username` 영문/숫자 4~50자, `password` 8자 이상, `name` 1~100자, `affiliation` 1~200자.
에러: 409 `USERNAME_ALREADY_EXISTS`, 400 `VALIDATION_FAILED`.

### POST /auth/login

```json
// req
{ "username": "testadmin", "password": "..." }
// res 200
{ "data": { "token": "eyJ...", "professor": { "id": 1, "username": "testadmin", "name": "..." } } }
```

에러: 401 `INVALID_CREDENTIALS`.

### GET /exams [auth]

교수 자신의 시험 목록. 최신 순.

```json
// res 200
{
  "data": [
    {
      "id": 1,
      "title": "...",
      "examCode": "ABC123",
      "startsAt": "...",
      "endsAt": "...",
      "questionCount": 5,
      "rosterCount": 30,
      "takerCount": 28
    }
  ]
}
```

### POST /exams [auth]

```json
// req
{
  "title": "...",
  "startsAt": "...",
  "endsAt": "...",
  "questions": [
    {
      "questionType": "SUBJECTIVE",
      "body": "...",
      "correctAnswer": "실시간 시험 감독 보조",
      "points": 20,
      "displayOrder": 1
    },
    {
      "questionType": "MULTIPLE_CHOICE",
      "body": "...",
      "points": 10,
      "displayOrder": 2,
      "choices": [
        { "body": "...", "isCorrect": false, "displayOrder": 1 },
        { "body": "...", "isCorrect": true,  "displayOrder": 2 }
      ]
    }
  ],
  "roster": [
    { "studentNumber": "20230001", "studentName": "김철수" },
    { "studentNumber": "20230002", "studentName": "이영희" }
  ]
}
// res 201
{
  "data": {
    "id": 1, "examCode": "ABC123",
    "proctorLink": "...",
    "questionCount": 2
  }
}
```

검증: `title` 1~200자, `startsAt < endsAt`, questions 1+개, roster 1+명, `MULTIPLE_CHOICE`는 choices 2+개 + 정답 선택지 1+개.
에러: 400 `EXAM_TIME_INVALID` / `ROSTER_EMPTY` / `MULTIPLE_CHOICE_NO_CHOICES` / `MULTIPLE_CHOICE_NO_CORRECT`.

### POST /exams/{examId}/questions/{questionId}/images [auth]

multipart/form-data, `file`. PNG/JPEG/GIF/WEBP, 5MB 이하.

```json
// res 201
{
  "data": {
    "imageId": 1,
    "fileUrl": "/api/v1/files/images/abc123.png",
    "originalName": "...",
    "sizeBytes": 102400
  }
}
```

에러: 400 `INVALID_FILE` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `QUESTION_NOT_IN_EXAM`, 404 `EXAM_NOT_FOUND` / `QUESTION_NOT_FOUND`, 403 `FORBIDDEN`.

### GET /exams/{examId} [auth]

시험 상세 (정보 + 문항 + 응시 명단 + 응시 학생 세션 목록). 교수는 정답 데이터(`correctAnswer`, `isCorrect`)도 조회 가능.

```json
// res 200
{
  "data": {
    "id": 1,
    "title": "...",
    "examCode": "...",
    "startsAt": "...",
    "endsAt": "...",
    "proctorLink": "...",
    "questions": [
      {
        "id": 10,
        "questionType": "...",
        "body": "...",
        "points": 20,
        "correctAnswer": "실시간 시험 감독 보조",
        "displayOrder": 1,
        "images": [{ "id": 1, "fileUrl": "..." }],
        "choices": [
          { "id": 100, "body": "...", "isCorrect": true, "displayOrder": 1 }
        ]
      }
    ],
    "roster": [
      { "id": 1, "studentNumber": "20230001", "studentName": "김철수" }
    ],
    "sessions": [
      {
        "sessionUuid": "...",
        "studentNumber": "...",
        "studentName": "...",
        "status": "SUBMITTED",
        "totalScore": 30,
        "startedAt": "...",
        "submittedAt": "..."
      }
    ]
  }
}
```

에러: 404 `EXAM_NOT_FOUND`, 403 `FORBIDDEN`.

### PUT /exams/{examId} [auth]

시험 정보·문항·응시 명단을 일괄 갱신. 응시 세션이 1건이라도 존재하면 차단(409).
요청 바디: 생성과 동일 (`POST /exams`).
응답: 200 + `ExamDetailResponse` (상세 조회와 동일).

`examCode`, `proctorToken`은 유지. 기존 문항/명단은 전체 교체. 첨부 이미지의 물리 파일도 함께 정리.

에러: 404 `EXAM_NOT_FOUND`, 403 `FORBIDDEN`, 409 `EXAM_HAS_SESSIONS`, 400 (생성과 동일한 검증 에러).

### DELETE /exams/{examId} [auth]

시험과 모든 하위 데이터(문항/선택지/이미지/명단) 삭제. 응시자 있으면 409.
응답: 204 No Content.

에러: 404 `EXAM_NOT_FOUND`, 403 `FORBIDDEN`, 409 `EXAM_HAS_SESSIONS`.

---

## Sprint 2 엔드포인트 (학생 응시 흐름)

base path: `/api/v1/student`. 인증은 `X-Session-Token` 헤더 (sessionUuid raw 문자열).
lookup·세션 시작은 무인증, 그 외 학생 엔드포인트는 모두 토큰 필수.

### GET /student/exams/lookup?code={code}

6자리 시험 코드로 시험 메타 조회.

```json
// res 200
{
  "data": {
    "examId": 1,
    "title": "...",
    "startsAt": "...",
    "endsAt": "...",
    "questionCount": 5
  }
}
```

검증: `code`는 영문 대문자/숫자 6자리.
에러: 404 `EXAM_CODE_NOT_FOUND`.

### POST /student/exams/{examCode}/sessions

응시 시작 + 동시접속 lock 획득.

```json
// req
{ "studentNumber": "20231234", "studentName": "..." }
// res 201
{
  "data": {
    "sessionToken": "<uuid>",
    "examTitle": "...",
    "startsAt": "...",
    "endsAt": "...",
    "questions": [
      {
        "id": 10,
        "questionType": "MULTIPLE_CHOICE",
        "body": "...",
        "points": 10,
        "displayOrder": 1,
        "images": [{ "id": 1, "fileUrl": "..." }],
        "choices": [
          { "id": 100, "body": "...", "displayOrder": 1 }
        ]
      }
    ]
  }
}
```

응답에서 정답 정보(`correctAnswer`, `isCorrect`)는 의도적으로 제외.
`sessionToken`을 후속 요청의 `X-Session-Token` 헤더에 그대로 사용.

검증 흐름: 코드 → 시간 → 명단 → 세션 상태 → Redis lock.

에러:
- 404 `EXAM_CODE_NOT_FOUND`
- 400 `EXAM_NOT_STARTED` / `EXAM_ENDED`
- 403 `STUDENT_NOT_IN_ROSTER` (학번 미등록 + 이름 불일치 통합)
- 409 `CONCURRENT_SESSION` (다른 기기 점유 중)
- 409 `SESSION_ALREADY_SUBMITTED`
- 503 `LOCK_UNAVAILABLE` (Redis fail-close)

### GET /student/sessions/me [session]

재접속 시 호출. 세션 메타 + 문항 + Redis 답안 초안 일괄 반환.

```json
// res 200
{
  "data": {
    "sessionToken": "...",
    "examId": 1,
    "examTitle": "...",
    "startsAt": "...",
    "endsAt": "...",
    "status": "IN_PROGRESS",
    "questions": [...],
    "drafts": [
      {
        "questionId": 10,
        "answerText": null,
        "selectedChoiceIds": [101, 102]
      }
    ]
  }
}
```

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`.

### PUT /student/sessions/me/answers/{questionId} [session]

단일 문항 답안 초안 저장. Redis hash. 매 변경마다 호출 (프론트 1초 디바운스 권장).

```json
// req
{
  "answerText": "...",
  "selectedChoiceIds": [101, 102]
}
// res 204
```

객관식: `selectedChoiceIds` (다중 허용). 주관식: `answerText`. 둘 다 비우면 답안을 비웠다는 의미.

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`, 400 `EXAM_ENDED` / `QUESTION_NOT_IN_EXAM`.

### POST /student/sessions/me/submit [session]

답안 일괄 제출. Redis 초안 → DB `submission_answer` flush + 객관식 자동채점 + lock 해제. **request body 없음**.

```json
// res 200
{
  "data": {
    "sessionToken": "...",
    "status": "SUBMITTED",
    "totalScore": 30,
    "submittedAt": "..."
  }
}
```

자동채점 정책:
- `MULTIPLE_CHOICE`: 정답 선택지 id 집합과 학생이 선택한 id 집합이 **완전 일치** 시 만점, 아니면 0점 (부분 점수 없음).
- `SUBJECTIVE`: 0점으로 저장 (교수 채점 대기, Sprint 3 백로그 11).

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`.

### POST /student/sessions/me/heartbeat [session]

응시 활성 lock TTL 갱신. 클라이언트 약 10초 주기 호출.

```
// res 204
```

동작:
- 본인 lock이면 TTL을 30초로 갱신
- lock 만료 후 비어있으면 본인 sessionUuid로 재획득
- 다른 기기가 점유 중이면 409

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `CONCURRENT_SESSION` / `SESSION_ALREADY_SUBMITTED`, 503 `LOCK_UNAVAILABLE`.

---

## Sprint 3 엔드포인트 (실시간 이벤트 / 답안 재생 / 감독관)

상세 설계 근거: [sprint3-realtime-spec.md](./sprint3-realtime-spec.md).

### 학생 — 이벤트 수집

base path: `/api/v1/student`, `X-Session-Token` 헤더 필수.

#### POST /student/sessions/me/events [session]

즉시 이벤트 (백로그 13). 발생 즉시 단건 또는 묶음 전송.

```json
// req
{
  "events": [
    {
      "type": "PASTE",
      "occurredAt": "2026-05-13T10:01:23.456Z",
      "questionId": 10,
      "payload": { "length": 142, "preview": "BFS는 너비 우선..." }
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

지원 `type`: `PASTE`, `VISIBILITY_LOST`, `VISIBILITY_RESTORED`, `FULLSCREEN_EXIT`, `FULLSCREEN_ENTER`, `CAPTURE_SHORTCUT`, `WINDOW_BLUR`.

서버가 `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER` 수신 시 가장 가까운 미페어링 LOST/EXIT을 찾아 `duration_ms`를 RESTORED row에 기록. 점수 부여(+1) 후 감독관 SSE에 broadcast.

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`, 400 `EXAM_ENDED` / `EVENT_TYPE_INVALID`.

#### POST /student/sessions/me/events/batch [session]

배치 이벤트 + 답안 스냅샷 (백로그 14). 클라이언트가 60초 단위로 누적해 전송. 제출 직전에 잔여분 flush 권장.

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
    { "questionId": 10, "capturedAt": "...", "answerText": "BFS는...", "selectedChoiceIds": null },
    { "questionId": 11, "capturedAt": "...", "answerText": null, "selectedChoiceIds": [101,103] }
  ]
}
// res 204
```

지원 `type`: `KEYSTROKE`, `CHOICE_CHANGE`, `QUESTION_NAVIGATE`.

`CHOICE_CHANGE` 도착 시 직전 5초 내 `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER`가 있으면 `SUSPICIOUS_CHOICE_CHANGE` 파생 row를 추가 INSERT + 점수 +1.

에러: 401 `INVALID_SESSION_TOKEN`, 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_SUBMITTED`, 400 `EXAM_ENDED` / `BATCH_PERIOD_INVALID`.

### 교수 — 답안 재생

#### GET /exams/{examId}/sessions/{sessionId}/replay [auth]

종료된 학생 세션의 재생 데이터 (백로그 15). 시험 종료 후, 본인이 개설한 시험만.

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
      { "t": 14000, "type": "VISIBILITY_RESTORED", "questionId": 10, "payload": {"durationMs":6000} },
      { "t": 14100, "type": "CHOICE_CHANGE", "questionId": 11, "payload": {"from":[],"to":[103]} },
      { "t": 14100, "type": "SUSPICIOUS_CHOICE_CHANGE", "questionId": 11, "payload": {"deltaMs":100} }
    ],
    "snapshots": [
      { "t": 60000, "questionId": 10, "answerText": "BFS는...", "selectedChoiceIds": null }
    ]
  }
}
```

`t`: `startedAt` 기준 상대 ms. `timeline`/`snapshots` 모두 `t` 오름차순. 프론트는 임의 시점 점프 시 가장 가까운 snapshot을 초기 상태로 두고 timeline forward 재생.

에러: 404 `SESSION_NOT_FOUND` / `EXAM_NOT_FOUND`, 403 `FORBIDDEN`, 400 `SESSION_NOT_SUBMITTED`.

### 감독관

base path: `/api/v1/proctor`. URL path의 `proctorToken` UUID로 인증. 별도 헤더 없음.

#### GET /proctor/exams/{proctorToken}

대시보드 메타 (백로그 16).

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

에러: 401 `PROCTOR_TOKEN_INVALID`.

#### GET /proctor/exams/{proctorToken}/students

학생 카드 목록 (백로그 16, 17). 쿼리: `?sort=attention|studentNumber` (기본 `attention`).

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

`attentionLevel`: 점수 임계 기반 — `HIGH ≥ 4`, `MID ≥ 2`, `LOW ≥ 1`, `NORMAL = 0`.

#### GET /proctor/exams/{proctorToken}/students/{sessionUuid}

학생 상세 패널 (백로그 17).

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

에러: 401 `PROCTOR_TOKEN_INVALID`, 404 `SESSION_NOT_FOUND`.

#### GET /proctor/exams/{proctorToken}/events

이벤트 피드 폴백 (백로그 18). 시간 역순. 쿼리: `?since={iso}&limit=50` (기본 50, 최대 200).

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

SSE 초기 적재용 + 재연결 시 갭 보충용.

#### GET /proctor/exams/{proctorToken}/stream

SSE 실시간 채널 (백로그 17, 18).

```
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

30초마다 `heartbeat` 송신으로 연결 유지. 프론트는 `student-event` 수신 시 피드 prepend, `attention-update` 수신 시 카드 색상/위치 갱신, `session-status` 수신 시 카드 제거/비활성화.

에러: 401 `PROCTOR_TOKEN_INVALID`.

---

## 에러 코드

| 코드 | HTTP | 비고 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `@Valid` 실패 |
| `EXAM_NOT_STARTED` | 400 | 시험 시작 시각 이전 |
| `EXAM_ENDED` | 400 | 시험 종료 시각 이후 |
| `EXAM_TIME_INVALID` | 400 | `endsAt ≤ startsAt` |
| `ROSTER_EMPTY` | 400 | 명단 0명 |
| `MULTIPLE_CHOICE_NO_CHOICES` | 400 | 객관식 선택지 < 2 |
| `MULTIPLE_CHOICE_NO_CORRECT` | 400 | 객관식 정답 선택지 0 |
| `INVALID_FILE` | 400 | 빈 파일 등 |
| `FILE_TOO_LARGE` | 400 | 5MB 초과 |
| `UNSUPPORTED_FILE_TYPE` | 400 | PNG/JPEG/GIF/WEBP 외 |
| `QUESTION_NOT_IN_EXAM` | 400 | 문항이 해당 시험 소속 아님 |
| `INVALID_CREDENTIALS` | 401 | 로그인 실패 |
| `INVALID_SESSION_TOKEN` | 401 | `X-Session-Token` 헤더 검증 실패 |
| `PROCTOR_TOKEN_INVALID` | 401 | URL path의 proctorToken으로 시험을 찾을 수 없음 |
| `EVENT_TYPE_INVALID` | 400 | 미지원 `event_type` 값 |
| `BATCH_PERIOD_INVALID` | 400 | `batchPeriodStart >= batchPeriodEnd` 등 |
| `SESSION_NOT_SUBMITTED` | 400 | 채점/재생은 제출된 세션만 허용 |
| `FORBIDDEN` | 403 | 본인 자원 아님 |
| `STUDENT_NOT_IN_ROSTER` | 403 | 명단 미등록 또는 이름 불일치 |
| `EXAM_NOT_FOUND` | 404 | 시험 ID 미존재 |
| `EXAM_CODE_NOT_FOUND` | 404 | 잘못된 시험 코드 |
| `QUESTION_NOT_FOUND` | 404 | 문항 ID 미존재 |
| `SESSION_NOT_FOUND` | 404 | 세션 미존재 또는 만료 |
| `USERNAME_ALREADY_EXISTS` | 409 | 가입 시 중복 |
| `EXAM_HAS_SESSIONS` | 409 | 응시자 있는 시험 수정/삭제 차단 |
| `CONCURRENT_SESSION` | 409 | 동일 학번 다른 기기 점유 중 |
| `SESSION_ALREADY_SUBMITTED` | 409 | 이미 제출된 시험 |
| `LOCK_UNAVAILABLE` | 503 | Redis 장애 (fail-close) |
| `INTERNAL_SERVER_ERROR` | 500 | 서버 내부 오류 |
