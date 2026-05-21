# Sprint 3 통합 기록

작성일: 2026-05-15
범위: 백로그 13·14·15 백엔드 통합 테스트 (`test-integration` 브랜치)
관련 문서: [sprint3-progress.md](./sprint3-progress.md), [sprint3-realtime-spec.md](./sprint3-realtime-spec.md)

---

## 환경

- Docker: `veriproof-db` (postgres:16), `veriproof-redis` (redis:7-alpine)
- 백엔드: `./gradlew bootRun` (port 8081, JDK 24 임시 toolchain)
- 검증 방식: curl 기반 API 시나리오 테스트 + Postgres/Redis 직접 조회로 영속화 확인
- Flyway 마이그레이션: V1~V4 모두 적용 확인 (`event_log`, `answer_snapshot` 테이블 생성됨)

---

## 시나리오 결과 (22건)

| # | 영역 | 시나리오 | 결과 |
|---|---|---|---|
| 1 | 사전 | 회원가입 (`sprint3test`) → 201 | ✅ |
| 2 | 사전 | 로그인 → JWT 발급 | ✅ |
| 3 | 사전 | 시험 개설 (주관식 1 + 객관식 1, roster 1명) → examCode 발급 | ✅ |
| 4 | 사전 | 학생 세션 시작 → sessionToken 발급 | ✅ |
| 5 | 백로그 13 | `POST /events`: PASTE + VISIBILITY_LOST + VISIBILITY_RESTORED → 204 | ✅ |
| 6 | 백로그 13 | `event_log` 3 row INSERT + RESTORED row `duration_ms=2000` 페어링 기록 | ✅ |
| 7 | 백로그 13 | JSONB payload 한글 유니코드 정상 저장 (`{"length":42,"preview":"붙여넣은 내용 첫 50자"}`) | ✅ |
| 8 | 백로그 13 | Redis `exam:1:attention` ZSET 점수 +2 (PASTE +1, VISIBILITY_RESTORED +1) | ✅ |
| 9 | 백로그 13 | Redis `session:{uuid}:signals` Hash `paste=1, visibility_lost=1` | ✅ |
| 10 | 백로그 13 | FULLSCREEN_EXIT + FULLSCREEN_ENTER 페어링 → ENTER row `duration_ms=1000` | ✅ |
| 11 | 백로그 13 | CAPTURE_SHORTCUT + WINDOW_BLUR 누적 → 점수 5, 5종 signals | ✅ |
| 12 | 백로그 14 | `POST /events/batch`: KEYSTROKE + CHOICE_CHANGE + QUESTION_NAVIGATE + snapshots 2건 → 204 | ✅ |
| 13 | 백로그 14 | `answer_snapshot` 2 row INSERT (`selected_choice_ids` `bigint[]` 정상 매핑 `{2}`) | ✅ |
| 14 | 백로그 14 | SUSPICIOUS_CHOICE_CHANGE 파생 (RESTORED 후 2초 → 5초 임계 통과) | ✅ |
| 15 | 백로그 14 | SUSPICIOUS payload `{"deltaMs":2000,"restoredAt":"...","originalChoiceChangeId":11}` | ✅ |
| 16 | 백로그 14 | SUSPICIOUS 비파생 (RESTORED 후 1분 이상 경과 CHOICE_CHANGE → 임계 초과로 미생성, 점수 그대로) | ✅ |
| 17 | 검증 | `EVENT_TYPE_INVALID` (미지원 type) → 400 | ✅ |
| 18 | 검증 | `BATCH_PERIOD_INVALID` (start >= end) → 400 | ✅ |
| 19 | 검증 | `SESSION_NOT_FOUND` (가짜 sessionUuid) → 404 | ✅ |
| 20 | 검증 | `INVALID_SESSION_TOKEN` (헤더 누락) → 401 | ✅ |
| 21 | 검증 | `QUESTION_NOT_IN_EXAM` (시험에 없는 questionId) → 400 | ✅ |
| 22 | 검증 | `SESSION_ALREADY_SUBMITTED` (제출 후 이벤트 POST) → 409 | ✅ |
| 23 | 백로그 15 | 학생 submit → status `SUBMITTED` | ✅ |
| 24 | 백로그 15 | `GET /exams/{id}/sessions/{sId}/replay` → 200 + timeline 14건 + snapshots 2건 | ✅ |
| 25 | 백로그 15 | timeline `t` = `startedAt` 기준 상대 ms (음수 클램프 동작) | ✅ |
| 26 | 백로그 15 | 동일 `occurredAt` 이벤트 정렬 안정성 — SUSPICIOUS_CHOICE_CHANGE가 원본 CHOICE_CHANGE 뒤로 (id ASC 보조 정렬) | ✅ |
| 27 | 백로그 15 | `@JsonInclude(NON_NULL)` 작동 — `selectedChoiceIds`/`answerText` 비어 있을 때 응답에서 제외 | ✅ |
| 28 | 백로그 15 | 권한 검증 — 다른 교수가 `/replay` 호출 → 403 `FORBIDDEN` | ✅ |
| 29 | 백로그 15 | `SESSION_NOT_SUBMITTED` — IN_PROGRESS 세션에 `/replay` 시도 → 400 | ✅ |

---

## 검증되지 않은 항목

- **SSE broadcast 수신** — `EventBroadcaster.publish` 호출은 모든 시나리오에서 예외 없이 실행됨(HTTP 204 응답)이 확인되었으나, `GET /proctor/exams/{token}/stream` 엔드포인트가 미구현(PR-7 범위) 상태라 실제 SSE 클라이언트로 수신 검증은 PR-7 이후에 가능.
- **InMemoryEventBroadcaster heartbeat** — 동일 사유로 30초 주기 heartbeat 송신 검증 불가.

---

## 빌드/실행 검증

- `./gradlew compileJava` → `BUILD SUCCESSFUL`
- 백엔드 부팅: 2.971초
- Flyway: V1~V4 마이그레이션 성공 적용
- 22+7개 시나리오 전부 통과

---

## 검증 데이터 스냅샷

### event_log 최종 상태 (14 row)

| id | event_type | question_id | duration_ms | 비고 |
|---|---|---|---|---|
| 1 | PASTE | 1 | — | payload `{length, preview}` |
| 2 | VISIBILITY_LOST | 1 | — | — |
| 3 | VISIBILITY_RESTORED | 1 | 2000 | 페어링 |
| 4 | FULLSCREEN_EXIT | 1 | — | — |
| 5 | FULLSCREEN_ENTER | 1 | 1000 | 페어링 |
| 6 | CAPTURE_SHORTCUT | 1 | — | `{key:"Cmd+Shift+3"}` |
| 7 | WINDOW_BLUR | 1 | — | — |
| 8 | VISIBILITY_LOST | 2 | — | — |
| 9 | VISIBILITY_RESTORED | 2 | 1000 | 페어링 |
| 10 | KEYSTROKE | 2 | — | 배치 |
| 11 | CHOICE_CHANGE | 2 | — | 배치, `{from:[], to:[2]}` |
| 12 | SUSPICIOUS_CHOICE_CHANGE | 2 | — | 파생, payload `{deltaMs:2000, restoredAt, originalChoiceChangeId:11}` |
| 13 | QUESTION_NAVIGATE | — | — | 배치, questionId NULL |
| 14 | CHOICE_CHANGE | 2 | — | 배치, RESTORED와 1분 이상 차이 → SUSPICIOUS 미파생 |

### answer_snapshot 최종 상태 (2 row)

| id | question_id | answer_text | selected_choice_ids |
|---|---|---|---|
| 1 | 1 | "BFS는 그래프 탐색..." | — |
| 2 | 2 | — | `{2}` |

### Redis 최종 상태

- `exam:1:attention` (ZSET): `af456d81-... = 7`
- `session:af456d81-...:signals` (Hash):
  - `paste = 1`
  - `visibility_lost = 2`
  - `fullscreen_exit = 1`
  - `capture_shortcut = 1`
  - `window_blur = 1`
  - `suspicious_choice_change = 1`

---

## 2026-05-17 — 프론트 답안 재생 통합 (PR #14 흡수)

### 배경
프론트 담당이 `sprint3/answer-replay` 브랜치로 `Replay.jsx`(957줄) + 라우트 + 재생 버튼을 PR #14로 올림. 베이스가 `main`이라 PR #13(test-integration → main)과 충돌 가능성. test-integration에 머지 후 fix 커밋 추가하여 PR #13으로 흡수, PR #14는 close.

### 머지 + Fix 커밋

- `git merge sprint3/answer-replay --no-edit` → test-integration에 FE 5개 파일 통합
- 후속 fix 1건: `877585d fix(replay): API 연동 활성화 + JDK 23 toolchain 원복`

### 발견·수정한 문제

| # | 문제 | 수정 위치 | 커밋 |
|---|---|---|---|
| 1 | `backend/build.gradle` JDK 25로 변경됨 | build.gradle JDK 23 원복 | 877585d |
| 2 | `Replay.jsx`에 mock 데이터 200줄 + API 호출 주석 처리 | mock 블록 제거, `getReplay` 호출 활성화, `error` state 복구 | 877585d |
| 3 | `event_log.payload`(JSONB → Hibernate String)가 응답에 raw JSON 문자열로 노출 → 프론트가 `e.payload.key` 접근 시 undefined → KEYSTROKE/PASTE/CHOICE_CHANGE 다 무시되어 답안 텍스트 안 보임 | `ReplayService`에 `ObjectMapper.readValue(payload, Map.class)` 파싱 추가. `ReplayResponse.TimelineItem.payload` 타입 `String` → `Object` | 384dc06 |
| 4 | `QuestionMeta`에 `choices` 필드 누락 → 프론트 `choiceLabelMap`이 비어 객관식 로그가 raw choice id(`#21`) 노출 | `ChoiceMeta(id, body, displayOrder)` 신규. `ReplayService`가 `question.getChoices()`를 `displayOrder` ASC 정렬해 응답에 포함 | 3012641 |

PR #14 close 처리 (PR #13에 흡수됨 코멘트).

### 추가 통합 테스트 (5건)

리얼한 응시 시뮬레이션을 위한 시드 스크립트 작성 (`/tmp/replay-seed-v2.sh`). 6문항, KEYSTROKE 146건, VISIBILITY 페어 2건, PASTE 1건, SUSPICIOUS 2건, CAPTURE_SHORTCUT 1건, WINDOW_BLUR 1건, 답안 스냅샷 6건, 약 45초 분량. 학생이 모든 문항에 답안 작성 + 제출까지 완료한 상태. 채점 모드(`SessionGrade.jsx`)에서 답안 표시 정상 확인 (자동채점 30점 — 객관식 3문항 모두 정답).

| # | 시나리오 | 결과 |
|---|---|---|
| 30 | 다중 학생 ZSET 정렬 — 같은 시험에 3명 응시, 이벤트 5/2/0건 발생 | ✅ `ZREVRANGEBYSCORE`로 7/2 점수 반환, 이벤트 없는 학생은 ZSET에 없음 |
| 31 | 빈 세션 replay — 이벤트 0건 + 즉시 제출 | ✅ `timeline=[]`, `snapshots=[]`로 정상 응답 |
| 32 | 페어링 누락 LOST — VISIBILITY_LOST만 보내고 RESTORED 없이 제출 | ✅ replay 응답에서 LOST row의 `durationMs: null` 유지 |
| 33 | SUSPICIOUS 임계 경계 — RESTORED 후 4초·5.5초에 각각 CHOICE_CHANGE | ✅ 4초 → SUSPICIOUS 파생, 5.5초 → 미파생 |
| 34 | Cross-exam 권한 — 다른 시험의 examId/sessionId 조합으로 replay | ✅ `SESSION_NOT_FOUND`(404) |

### 검증되지 않은 항목 (그대로 유지)

- 감독관 SSE broadcast 수신 (PR-7 `/proctor/stream` 엔드포인트 미구현)
- `InMemoryEventBroadcaster` 30초 heartbeat 송신
- Redis fail-open 동작 (Redis 컨테이너 중지 필요)

### 운영 메모

- Redis ZSET/Hash는 시험 종료 후 1시간 TTL. 시연 시 시드와 시연 사이 텀이 길거나 Redis 재시작 시 attention 점수·signals 카운트는 손실됨. DB `event_log`/`answer_snapshot`은 영구 보존이라 replay는 영향 없음.

---

## 2026-05-21 — 프론트 감독관 대시보드 + 백엔드 16/17/18 통합 (PR #17 흡수)

### 배경

`sprint3/frontend-clean` 브랜치(PR #17)로 프론트 담당이 감독관 대시보드 + 실시간 이상행동 감지 FE 구현(13개 파일, +812/-18)을 올림. 직전에 백엔드 백로그 16/17/18(`0e6e832`) 머지 끝난 직후라 짝이 맞아 같이 통합 검증 가능.

### 머지

- 단일 충돌(`frontend/src/App.jsx` import 라인) 자동병합 실패 → 양쪽 import 모두 보존하여 수동 해결
- `25b8956 Merge PR #17`

### 발견·수정한 문제

머지 직후 contract 점검과 curl E2E 시나리오(27건) 돌려서 5건 BE 수정.

| # | 문제 | 수정 위치 | 비고 |
|---|---|---|---|
| 1 | `GET /proctor/exams/{token}/meta`가 명세(`/proctor/exams/{token}`)와 path 불일치 | `ProctorController.java:33` `/meta` 제거 | FE 호출 path가 명세와 같음. BE만 어긴 케이스 |
| 2 | `GET /proctor/exams/{token}/feed`가 명세(`/events`)와 path 불일치 | `ProctorController.java:68` `/feed` → `/events` | 동상 |
| 3 | 학생 카드 응답의 `status`가 항상 `IN_PROGRESS` 하드코딩 — DB가 `SUBMITTED`여도 카드는 `IN_PROGRESS` 그대로 노출 → FE `StudentCard.jsx`의 dim/배지/클릭비활성 로직(`status === 'SUBMITTED'`)이 영영 작동 안 함 | `ProctorService.java:64` `findBySessionUuid().map(ExamSession::getStatus)`로 DB 실제 status 조회 | active_sessions store가 stale entry 보유해도 카드는 DB 진실을 반영 |
| 4 | 학생 상세 응답의 필드명·구조가 명세와 다 어긋남 — `recentLogs`(↔ 명세 `recentEvents`, +`durationMs` 누락), signals 키 snake_case(↔ 명세 camelCase), `currentDrafts` List(↔ 명세 `currentAnswerPreview` 단일 객체) | `ProctorStudentDetailResponse` DTO 재정의 + `ProctorService.getStudentDetail` 빌더 갱신. signals는 `snakeToCamel` 변환, `currentAnswerPreview`는 최신 `answer_snapshot` 1건(없으면 Redis draft 폴백) | FE `DetailPanel.jsx`가 명세대로 작성돼 있어 BE가 정렬되는 게 맞음. `AnswerSnapshotRepository`에 `findFirstByExamSessionIdOrderByCapturedAtDesc` 추가 |
| 5 | 학생 상세에서 잘못된 sessionUuid → `401 INVALID_SESSION_TOKEN` (명세는 `404 SESSION_NOT_FOUND`) | `ProctorService.java:105` 에러 코드 교체 | INVALID_SESSION_TOKEN은 학생 X-Session-Token 검증용. 감독관 path 파라미터 조회에는 부적절 |

### E2E 시나리오 (27건)

`/tmp/veriproof_pr17_e2e.sh` — curl 기반 통합 스크립트. SSE는 background `curl -N`으로 받아서 파일에 기록 후 검증.

| 영역 | 시나리오 | 결과 |
|---|---|---|
| Setup | 회원가입/로그인/시험 개설(2문항, 명단 1명)/학생 세션 시작 | ✅ 4/4 |
| Proctor API 경로 | 메타·카드 목록·학생 상세·이벤트 피드 정상 200 응답 | ✅ 4/4 |
| 정렬 | `sort=attentionScore`, `sort=studentNumber`, `sort=attention` (else 분기 fallback) | ✅ 3/3 |
| SSE 구독 | `/stream` 연결 성공 + heartbeat 수신 | ✅ |
| 즉시 이벤트 (4건 POST → 6 row) | PASTE / VISIBILITY 페어링(durationMs=2000) / FULLSCREEN_EXIT / CAPTURE_SHORTCUT / WINDOW_BLUR | ✅ 4/4 |
| 배치 이벤트 | KEYSTROKE + QUESTION_NAVIGATE + 답안 스냅샷 1건 | ✅ |
| SSE broadcast 수신 | `student-event` 6건, `attention-update` 4건 — PR-7에서 미검증이었던 항목 이번에 통과 | ✅ |
| 실시간 점수 변동 | 카드 `attentionScore: 0 → 4`, `level: HIGH` | ✅ |
| 학생 상세 명세 정합 | `recentEvents` 8건 + `signals` 4키 모두 camelCase + `currentAnswerPreview.questionId=Q1` | ✅ |
| 이벤트 피드 누적 | 0건 → 8건 (broadcast 시 DB INSERT 누적) | ✅ |
| 이벤트 피드 `?since=` | 200 응답 | ✅ |
| 옛 경로 제거 확인 | `/meta`, `/feed` → 404 | ✅ 2/2 |
| 에러 경계 | 잘못된 proctorToken → 401 `PROCTOR_TOKEN_INVALID` / 잘못된 sessionUuid → 404 `SESSION_NOT_FOUND` | ✅ 2/2 |
| 제출 후 상태 반영 | 학생 submit → 카드 응답 `status: SUBMITTED` (#3 fix 검증) | ✅ |

**총 PASS 27 / FAIL 0**.

### 새로 검증된 항목 (이전엔 미검증)

- 감독관 SSE broadcast 수신 — PR-7에서 미검증 상태였던 항목. 학생 이벤트 발생 시 `student-event`/`attention-update` 두 종류 SSE 이벤트가 정상 push됨을 확인.
- 명세 정합성 — `signals` camelCase, `recentEvents` 필드명/`durationMs` 포함, `currentAnswerPreview` 구조 모두 spec과 일치.

### 검증되지 않은 항목 (그대로 유지)

- `InMemoryEventBroadcaster` 30초 heartbeat 송신 — 첫 heartbeat는 들어오나(`event:heartbeat`) 30초 주기 검증은 별개 장기 테스트 필요
- Redis fail-open 동작 (Redis 컨테이너 중지 필요)
- 브라우저 측 FE 렌더링 — UI/UX는 수동 검증 필요 (`http://localhost:5173`)

### 운영 메모

- `currentAnswerPreview`는 `answer_snapshot` 최신 1건을 우선 사용하고, 스냅샷이 없을 때만 Redis `session:{uuid}:drafts` 폴백. 답안 저장 직후엔 draft만 있고 60초 주기로 snapshot이 쌓이는 구조.
- 카드 `status`는 이제 DB 진실원 (`exam_session.status`)을 따라가므로 active_sessions Redis store에 stale entry가 남아있어도 정확하게 `SUBMITTED`/`EXPIRED` 반영.
