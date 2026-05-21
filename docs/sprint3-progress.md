# Sprint 3 진행 기록

작성일: 2026-05-15
범위: 백로그 13·14·15·16·17·18 — 실시간 이벤트 / 답안 재생 / 감독관 대시보드
관련 문서: [sprint3-realtime-spec.md](./sprint3-realtime-spec.md) — Sprint 3 사전 스펙

> 본 문서는 Sprint 3 개발 진행 상황을 누적 기록하는 로그입니다.
> 새 작업이 끝날 때마다 아래 "작업 기록"에 항목을 추가합니다.

---

## 진행 현황 요약

| 항목 | 백엔드 | 비고 |
|---|---|---|
| Sprint 3 사전 스펙 문서 작성 | ✅ 완료 (2026-05-13) | API/DB/FEATURES/realtime-spec |
| PR-1 인프라 (V4 + 엔티티/Repo/Broadcaster) | ✅ 완료 (2026-05-15) | — |
| PR-2 백로그 13 (즉시 이벤트 수집) | ✅ 완료 (2026-05-15) | 백로그 12 백엔드 부수 완료 |
| PR-3 백로그 14 (배치 이벤트 + 스냅샷 + SUSPICIOUS) | ✅ 완료 (2026-05-15) | — |
| PR-4 백로그 15 (답안 재생) | ✅ 완료 (2026-05-15) | — |
| PR-5 백로그 16 (감독관 메타/카드 목록) | ⏳ | 16/17/18 백엔드 담당 |
| PR-6 백로그 17 (주목도 정렬 + 학생 상세) | ⏳ | 16/17/18 백엔드 담당 |
| PR-7 백로그 18 (SSE stream + 이벤트 피드) | ⏳ | 16/17/18 백엔드 담당 |

---

## 작업 기록

### 2026-05-13 — Sprint 3 사전 스펙 문서 작성

#### 배경
백로그 13~18 구현 전 백엔드/프론트가 공유할 데이터 형식·API·아키텍처를 한 문서로 정리.

#### 산출물

| 위치 | 변경 |
|---|---|
| `docs/sprint3-realtime-spec.md` | 신규. 통신 채널(SSE+HTTP POST), DB/Redis 모델, 이벤트 카탈로그, API 명세, 컴포넌트 구조, PR 분담 |
| `docs/API_SPEC.md` | Sprint 3 엔드포인트 섹션 + 에러 코드 5종 추가 (`EVENT_TYPE_INVALID`, `BATCH_PERIOD_INVALID`, `PROCTOR_TOKEN_INVALID`, `SESSION_NOT_SUBMITTED`, 감독관 인증 path 매칭 명시) |
| `docs/DB_SCHEMA.md` | V4 마이그레이션 + `event_log`/`answer_snapshot` 테이블 설명 + Redis 키 3종 추가 (`exam:{examId}:attention` ZSET, `exam:{examId}:active_sessions` Hash, `session:{uuid}:signals` Hash) + ERD 갱신 |
| `docs/FEATURES.md` | 섹션 5 (실시간 이벤트 수집) / 6 (답안 재생) / 7 (감독관 대시보드) 추가, 데이터 보존을 섹션 8로 이동 |

#### 결정사항 반영
- 통신 채널: 학생→서버 HTTP POST, 서버→감독관 SSE
- SSE 팬아웃: 인메모리 `Map<examId, List<SseEmitter>>`. `EventBroadcaster` 인터페이스로 추상화
- 점수 정책: 모든 의심 시그널 균등 +1점
- 주목도 레벨 임계: HIGH ≥ 4 / MID ≥ 2 / LOW ≥ 1 / NORMAL = 0
- `VISIBILITY_LOST`~`RESTORED` 페어는 RESTORED 도착 시점에 +1 (페어 = 1 사건)
- `SUSPICIOUS_CHOICE_CHANGE`: `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER` 후 5초 이내 `CHOICE_CHANGE` 도착 시 별도 row INSERT + 점수 +1
- 감독관 토큰 인증: URL path 매칭 (`exam.proctor_token`과 직접 매칭, SSE EventSource 호환)
- `event_log.id`: `BIGSERIAL`
- `event_log.exam_id`: 비정규화 (감독관 피드 JOIN 회피)
- `duration_ms`: `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER` row에 기록
- Sprint 2 Redis draft와 `answer_snapshot` 분리 유지 (덮어쓰기 vs append-only)

#### 커밋
- `b95ee95 docs: Sprint 3 실시간 이벤트/답안 재생/감독관 대시보드 스펙 추가` (main 직접 푸시)

---

### 2026-05-15 — PR-1 인프라 + PR-2 백로그 13 (즉시 이벤트 수집)

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 | 백로그 |
|---|---|---|---|---|
| POST | `/api/v1/student/sessions/me/events` | `X-Session-Token` | 204 | 13 |

#### 인프라 (PR-1)

| 위치 | 변경 |
|---|---|
| `backend/src/main/resources/db/migration/V4__realtime_events.sql` | 신규. `event_log` (JSONB payload, FK exam_session/exam/question, idx 3종) + `answer_snapshot` (BIGINT[] selected_choice_ids, idx 1종) |
| `backend/.../domain/event/entity/EventLog.java` | 신규. JPA 엔티티. `@JdbcTypeCode(SqlTypes.JSON)` payload, `recordPairedDuration` 도메인 메서드, `@Builder`로 `receivedAt = now()` 자동 세팅 |
| `backend/.../domain/event/entity/AnswerSnapshot.java` | 신규. `@JdbcTypeCode(SqlTypes.ARRAY)` `Long[] selectedChoiceIds` 매핑 |
| `backend/.../domain/event/repository/EventLogRepository.java` | 신규. `findAllByExamSessionIdOrderByOccurredAtAsc` (재생용), `findAllByExamIdAndOccurredAtAfterOrderByOccurredAtDesc` (감독관 피드), `findAllByExamSessionIdOrderByOccurredAtDesc` (최근 이벤트), `findLatestStartBefore` (페어링), `avgVisibilityDurationMs` |
| `backend/.../domain/event/repository/AnswerSnapshotRepository.java` | 신규. `findAllByExamSessionIdOrderByCapturedAtAsc` |
| `backend/.../domain/event/dto/SseEvent.java` | 신규. `record SseEvent(String name, Object data)` + 정적 팩토리 (`studentEvent`, `attentionUpdate`, `sessionStatus`, `heartbeat`) |
| `backend/.../domain/event/service/EventBroadcaster.java` | 신규. 인터페이스 (`subscribe(examId)`, `publish(examId, event)`) |
| `backend/.../domain/event/service/InMemoryEventBroadcaster.java` | 신규. `ConcurrentHashMap<Long, CopyOnWriteArrayList<SseEmitter>>`. SseEmitter timeout 6시간. `@Scheduled(fixedRate=30000)`으로 heartbeat 자동 송신. onCompletion/onTimeout/onError 자동 정리 |
| `backend/.../ProjectApplication.java` | `@EnableScheduling` 추가 (heartbeat용) |
| `backend/.../global/exception/ErrorCode.java` | `EVENT_TYPE_INVALID`(400), `BATCH_PERIOD_INVALID`(400), `PROCTOR_TOKEN_INVALID`(401) 추가 |
| `backend/gradlew` | exec 권한 설정 |

#### 본체 (PR-2)

| 위치 | 변경 |
|---|---|
| `backend/.../infra/redis/AttentionStore.java` | 신규. 키 `exam:{examId}:attention` (ZSET). `increment(examId, sessionUuid)` → `ZINCRBY 1` + `expireAt(endsAt + 1h)` + 갱신 후 점수 반환. `getScore`. fail-open (장애 시 0) |
| `backend/.../infra/redis/SignalCounterStore.java` | 신규. 키 `session:{uuid}:signals` (Hash). `increment(sessionUuid, signalType)` → `HINCRBY 1`. `getAll`. fail-open |
| `backend/.../domain/event/dto/EventRequest.java` | 신규. `record EventRequest(List<EventItem> events)` + `EventItem(type, occurredAt, questionId, JsonNode payload)` |
| `backend/.../domain/event/service/EventIngestService.java` | 신규. `@Transactional ingest`. 세션·시간 검증, 이벤트 타입 검증(`ALLOWED_IMMEDIATE_TYPES`), `event_log` INSERT, 페어링 (`VISIBILITY_RESTORED`→`VISIBILITY_LOST`, `FULLSCREEN_ENTER`→`FULLSCREEN_EXIT`), 점수 부여(`SCORE_AWARDING_TYPES`), `AttentionStore`/`SignalCounterStore`/`EventBroadcaster` 호출. `computeLevel` (HIGH/MID/LOW/NORMAL) |
| `backend/.../domain/event/controller/StudentEventController.java` | 신규. `POST /api/v1/student/sessions/me/events`. `EventIngestService.ingest` 호출 후 204 |

#### 처리 흐름 (즉시 이벤트)
1. `X-Session-Token` → `sessionUuid` (resolver)
2. `examSessionRepository.findBySessionUuid` → 없으면 `SESSION_NOT_FOUND`, `SUBMITTED`면 `SESSION_ALREADY_SUBMITTED`, 시험 종료면 `EXAM_ENDED`
3. 이벤트별:
   - `event_type` 화이트리스트 검증 (`PASTE`, `VISIBILITY_LOST`, `VISIBILITY_RESTORED`, `FULLSCREEN_EXIT`, `FULLSCREEN_ENTER`, `CAPTURE_SHORTCUT`, `WINDOW_BLUR`)
   - `questionId` 있으면 `findByIdAndExamId` 검증, 없으면 `QUESTION_NOT_IN_EXAM`
   - `event_log` INSERT (`receivedAt` 자동)
   - `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER`: `findLatestStartBefore`로 페어 LOST/EXIT 1건 조회 후 `duration_ms` 계산하여 RESTORED/ENTER row에 기록
   - 점수 부여 대상이면 `signals` Hash `HINCRBY 1` + `attention` ZSET `ZINCRBY 1`
   - `EventBroadcaster.publish(student-event)` + 점수 변동 시 `attention-update`

#### 부수 효과 — 백로그 12 백엔드
PR-2의 `VISIBILITY_LOST`/`VISIBILITY_RESTORED` 이벤트 영구 저장 + `duration_ms` 페어링으로 백로그 12 백엔드 요구사항("이탈 시작 시각과 복귀 시각이 모두 기록되어, 사후 검토 시 이탈 지속 시간을 확인할 수 있다") 충족.

#### 빌드 검증
- `./gradlew compileJava` → `BUILD SUCCESSFUL` (JDK 24 임시 toolchain으로 검증 후 build.gradle은 JDK 23으로 원복)

#### 커밋
- `1cf4a93 feat(backend): Sprint 3 백로그 13 — 실시간 즉시 이벤트 수집` (test-integration)

---

### 2026-05-15 — PR-3 백로그 14 (배치 이벤트 + 답안 스냅샷 + SUSPICIOUS 파생)

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 | 백로그 |
|---|---|---|---|---|
| POST | `/api/v1/student/sessions/me/events/batch` | `X-Session-Token` | 204 | 14 |

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../domain/event/dto/EventBatchRequest.java` | 신규. `batchPeriodStart`, `batchPeriodEnd`, `events[]`, `snapshots[]`. `EventItem(type, occurredAt, questionId, payload)` + `SnapshotItem(questionId, capturedAt, answerText, Set<Long> selectedChoiceIds)` |
| `backend/.../domain/event/repository/EventLogRepository.java` | `findLatestReturnBefore(sessionId, before, pageable)` 추가. `VISIBILITY_RESTORED` 또는 `FULLSCREEN_ENTER` 중 도착 시각 이전의 가장 최근 1건 조회 |
| `backend/.../domain/event/service/EventIngestService.java` | `ingestBatch`, `ingestBatchOne`, `deriveSuspiciousIfApplicable`, `saveSnapshot` 메서드 추가. `validateActiveSession` 헬퍼로 즉시/배치 양쪽 검증 통합. `ALLOWED_BATCH_TYPES`, `SUSPICIOUS_WINDOW_MS=5000` 상수. `AnswerSnapshotRepository` 의존성 주입 |
| `backend/.../domain/event/controller/StudentEventController.java` | `POST /batch` 핸들러 추가 |

#### 처리 흐름 (배치 이벤트)
1. 세션·시간 검증 (PR-2와 동일)
2. `batchPeriodStart < batchPeriodEnd` 아니면 `BATCH_PERIOD_INVALID`
3. events 각각:
   - 화이트리스트 검증 (`KEYSTROKE`, `CHOICE_CHANGE`, `QUESTION_NAVIGATE`)
   - `event_log` INSERT (점수 영향 없음)
   - `CHOICE_CHANGE`이면 `deriveSuspiciousIfApplicable` 호출
4. snapshots 각각: `findByIdAndExamId`로 question 검증 후 `answer_snapshot` INSERT (`Long[]` 변환)

#### SUSPICIOUS_CHOICE_CHANGE 파생 룰
- 트리거: `CHOICE_CHANGE` 도착
- 조건: 같은 세션에서 도착 시각 직전의 `VISIBILITY_RESTORED` 또는 `FULLSCREEN_ENTER`가 5000ms 이내 (`findLatestReturnBefore`로 1건 조회)
- 동작:
  - `event_log` row INSERT (`event_type='SUSPICIOUS_CHOICE_CHANGE'`, occurredAt = CHOICE_CHANGE.occurredAt, question = CHOICE_CHANGE.question)
  - `payload`: `{originalChoiceChangeId, restoredAt, deltaMs}`
  - `signals` Hash `HINCRBY suspicious_choice_change 1`
  - `attention` ZSET `ZINCRBY 1`
  - `student-event` + `attention-update` SSE broadcast

#### 빌드 검증
- `./gradlew compileJava` → `BUILD SUCCESSFUL` (JDK 24 임시 toolchain)

#### 커밋
- `65fd147 feat(backend): Sprint 3 백로그 14 — 배치 이벤트 + 답안 스냅샷 + SUSPICIOUS 파생` (test-integration)

---

### 2026-05-15 — PR-4 백로그 15 (답안 재생)

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 | 백로그 |
|---|---|---|---|---|
| GET | `/api/v1/exams/{examId}/sessions/{sessionId}/replay` | 교수 JWT | 200 + `ReplayResponse` | 15 |

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../domain/replay/dto/ReplayResponse.java` | 신규. `sessionId`, `studentNumber`/`Name`, `examTitle`, `startedAt`, `submittedAt`, `questions[QuestionMeta]`, `timeline[TimelineItem]`, `snapshots[SnapshotItem]`. `@JsonInclude(NON_NULL)` |
| `backend/.../domain/replay/service/ReplayService.java` | 신규. `@Transactional(readOnly=true) getReplay(professorId, examId, sessionId)`. 권한·SUBMITTED 검증 후 questions/timeline/snapshots 빌드. `relativeMs` 헬퍼로 `startedAt` 기준 상대 ms 계산 (음수는 0으로 클램프) |
| `backend/.../domain/replay/controller/ReplayController.java` | 신규. `GET /api/v1/exams/{examId}/sessions/{sessionId}/replay`. `@AuthenticationPrincipal Long professorId` |
| `backend/.../domain/event/repository/EventLogRepository.java` | `findAllByExamSessionIdOrderByOccurredAtAsc` → `findAllByExamSessionIdOrderByOccurredAtAscIdAsc`로 변경 (동일 `occurredAt` 이벤트 간 순서 안정성: SUSPICIOUS가 원본 CHOICE_CHANGE보다 뒤에 오도록 id ASC 보조 정렬) |

#### 처리 흐름
1. `examRepository.findById` → 없으면 `EXAM_NOT_FOUND`
2. `exam.professor.id != professorId` → `FORBIDDEN`
3. `examSessionRepository.findById` → 없으면 `SESSION_NOT_FOUND`. `session.exam.id != examId`인 경우도 `SESSION_NOT_FOUND`
4. `!session.isSubmitted()` → `SESSION_NOT_SUBMITTED`
5. questions: `exam.getQuestions()` → `displayOrder` ASC 정렬
6. timeline: `findAllByExamSessionIdOrderByOccurredAtAscIdAsc(sessionId)` → 각 row에 대해 `t = max(0, occurredAt - startedAt 의 ms)`
7. snapshots: `findAllByExamSessionIdOrderByCapturedAtAsc(sessionId)` → 동일 방식으로 `t` 계산. `Long[]` → `List<Long>` 변환
8. `ReplayResponse` 빌드 후 반환

#### 빌드 검증
- `./gradlew compileJava` → `BUILD SUCCESSFUL` (JDK 24 임시 toolchain)

#### 커밋
- 본 진행 기록과 함께 푸시 예정
