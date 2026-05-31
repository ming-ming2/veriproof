# 백로그 21~25 구현 + 팀 PR 통합 기록

작성일: 2026-05-31 · 작업 브랜치: `integration/team-prs` · PR: [#23](https://github.com/ming-ming2/veriproof/pull/23) (→ `main`)

## 개요

기존 열린 팀 PR(#19 사후리포트, #20 대시보드·좌석 프론트, #22 리포트 페이지·감독관 UI)을 `integration/team-prs`에 통합하고, 그 위에 백로그 21~25를 구현·검증했다. DB 마이그레이션 충돌(V5)을 정리하고 실제 dev DB에서 부팅·테스트까지 확인했다.

백로그 번호 매핑(`backlog-candidates.md`의 A~I 기준): 21=자동제출, 22=부하검증(F), 23=단절복구(G), 24=대시보드 UI/채점상태(I), 25=좌석배치(H).

---

## 백로그별 구현

### 21. 응시 시간 만료 자동 제출
`feat/auto-submit` 브랜치를 통합에 머지.

- 서버 사이드 스위퍼 `AutoSubmitScheduler` — 종료 시각 지난 IN_PROGRESS 세션을 세션별 개별 트랜잭션으로 자동 제출
- `StudentSessionService.submit()`을 `flushGradeAndSubmit()`로 리팩토링 → 수동 제출과 만료 자동 제출이 공유
- `exam_session.auto_submitted` 컬럼 추가 (마이그레이션 **V5**)
- 단위 테스트: `AutoSubmitSchedulerTest`, `StudentSessionServiceAutoSubmitTest`

### 22. 동시 응시 부하 검증
- `loadtest/backlog22-load-test.mjs` (Node 18+, 의존성 0) + `loadtest/README.md`
- N명 가상 학생이 동시 응시하며 약 5초 간격으로 즉시/배치 이벤트·답안·heartbeat 발생, 감독관 대시보드 응답시간 측정
- 검증 항목: 대시보드 갱신 p95 ≤ SLA, 이벤트 손실 0(서버 ingest가 `@Transactional` 동기 저장 → 204 = 영속화 완료), 전원 응시/제출, 답안/스냅샷 저장(도커 DB 교차검증)
- **실측(100명/60초)**: 응시·제출 100/100, 즉시 1216 + 배치 316 전부 성공(손실 0), 대시보드 p50 180ms·p95 219ms·max 247ms(100% < 1s), DB event_log 2764행·answer_snapshot 632행·SUBMITTED 100

### 23. 네트워크 단절 복구
학생측은 WebSocket이 아닌 HTTP POST 기반이라, 기존엔 송신 실패 시 `.catch(()=>{})`로 이벤트가 유실됐다. **오프라인 큐 + 재연결 감지** 모델로 해결.

- **프론트**: `frontend/src/api/offlineQueue.js`(신규) — 온라인이면 즉시 전송, 네트워크 오류 시 오프라인 전환 + 큐 보관 후 3초마다 재시도, 복구 시 순서대로 전량 재전송. 답안은 문항별 최신만 coalesce, 이벤트/배치는 전량·순서 보존
- 3개 송신 지점 큐 경유: 답안 저장(`ExamSession.jsx`), 즉시 이벤트(`useExamWebsocket.js`), 배치+스냅샷(`useBehaviorTracker.js` — 실패해도 payload가 큐에 남아 유실 0)
- 단절 배너("연결이 끊어졌습니다. 재연결 중…"), 복구 시 `CONNECTION_LOST`/`CONNECTION_RESTORED` 마커 전송, 세션 종료 시 큐 정리
- **백엔드**: `EventIngestService` — 연결 마커 허용 타입 추가 + 단절 지속시간 페어링(점수 미부여), `ProctorService` — 감독관 피드/상세 패널에 노출
- 검증: 백엔드 E2E(마커 수용·피드 노출·페어링 durationMs=5000·attentionScore=0), 오프라인 큐 단위 테스트(보관→복구 전량 재전송·순서 보존·coalesce·4xx 드롭·마커), vite build 클린

> 동작 메모: **네트워크만 끊긴 경우(응시 탭 유지)는 복구 즉시 재접속**된다. sessionToken이 살아있어 재입장 없이 heartbeat가 본인 락을 다시 잡기 때문. "30초"는 락 TTL이지 재연결 지연이 아니다(아래 동시접속 락 참고). 백로그 문구도 이에 맞게 수정함(`backlog-candidates.md`).

### 24. 채점 완료 상태 (대시보드 UI 백엔드 지원)
- `exam_session.grading_status`(`UNGRADED`/`COMPLETED`, 기본 UNGRADED) 추가 (마이그레이션 **V6**)
- `PATCH /api/v1/exams/{examId}/sessions/{sessionId}/grading-status` (교수 본인만, 허용값 검증)
- 제출 시 주관식 문항이 없으면 자동 `COMPLETED` 처리(`flushGradeAndSubmit` 내)
- 응답 필드: `GET /exams/{id}` 세션에 `gradingStatus`, `GET /dashboard`에 `ungradedCount`(SUBMITTED & UNGRADED 집계)
- 에러코드: `INVALID_GRADING_STATUS`

### 25. 좌석 배치
- `exam.seat_rows`/`seat_cols`, `exam_roster.seat_number` 추가 (마이그레이션 **V6**)
- 시험 개설/수정 시 **이름순(student_name ASC) 자동 배정** (1번부터)
- 검증: 행·열 둘 중 하나만 → `INVALID_SEAT_CONFIG`, 좌석 수 < 명단 수 → `SEAT_COUNT_INSUFFICIENT`
- 응답 필드: `GET /exams/{id}`(seatRows/seatCols + roster.seatNumber), 감독관 `GET /proctor/exams/{token}`(seatRows/seatCols)·`.../students`(seatNumber)

---

## DB 마이그레이션

| 버전 | 내용 | 관련 |
|---|---|---|
| `V5__auto_submit_flag.sql` | `exam_session.auto_submitted` | #21 |
| `V6__seat_layout_and_grading_status.sql` | `exam.seat_rows/cols`, `exam_roster.seat_number`, `exam_session.grading_status` | #24, #25 |

- 충돌 정리: `feat/auto-submit`이 이미 V5를 선점(공용 dev DB에 적용됨)했으므로, 좌석/채점 마이그레이션을 **V6**로 채번하고 auto-submit을 통합에 함께 머지해 V5↔V6 순서를 맞췄다.
- 실제 dev DB 부팅 시 Flyway V1~V6 적용 + Hibernate `validate` 통과 확인.

---

## 동시접속 락 (백로그 19, 참고)

`SessionLockStore` — 키 `exam:{examId}:active:{studentNumber}`, 값 점유 `sessionUuid`, **TTL 30초**. 응시 기기가 10초마다 heartbeat로 TTL 갱신.

- 같은 학번+이름 중복 입장 → 락 점유 중이면 `CONCURRENT_SESSION`(409)
- "30초"는 **고정 페널티가 아니라 락 TTL**. 먼저 들어간 세션이 살아있으면 차단되고, 그게 끊겨 heartbeat가 멈추면 최대 30초 후 락이 만료돼 재입장 가능
- **탭이 열린 채 네트워크만 끊긴 #23 시나리오는 30초 대기 없음** — 복구 즉시 본인 락 재획득. 30초 대기는 "탭을 닫고 학번·이름으로 새로 입장"하는 경우에만 발생

---

## 검증 환경 메모

- 프로젝트 경로에 한글+공백(`바탕 화면`)이 있어 Gradle 9 테스트 워커가 `ClassNotFoundException`을 내며 `gradlew test`가 실패한다(코드 문제 아님, 원래 있던 `ProjectApplicationTests`도 동일). ASCII 경로로 backend를 복사해 실행하면 전체 테스트 통과. CI/영문 경로에선 정상.
- 부하/단절 테스트는 `docker compose`의 `veriproof-db`/`veriproof-redis` 컨테이너 + `./gradlew bootRun`(8081) 상태에서 실행.

---

## 남은 후속 (follow-up)

- `ProctorDashboard.jsx`의 좌석 더미 데이터 폴백 제거(실데이터 연동 후), 단절 구간 전용 비주얼 마커 렌더링(데이터는 `CONNECTION_*` + duration으로 이미 내려옴)
- #25 미입장 학생 좌석 표시(`status: NOT_STARTED`) — 스펙상 우선순위 낮음, 미구현
- `product-backlog.md`에 22~25 정식 등재(현재는 21번까지만 기재)
- 통합 PR #23이 `main`에 머지되면 팀 열린 PR #19/#20/#22는 내용 반영되어 정리 가능
