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
