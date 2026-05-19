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
