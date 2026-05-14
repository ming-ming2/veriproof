# Sprint 2 진행 기록

작성일: 2026-05-08
범위: Sprint 1에서 누락된 시험 관리 기능(수정/삭제) 보강 및 학생 응시 흐름(백로그 7·8·9·10·20) 백엔드 구현
관련 보고서: [sprint1-exam-fixes.md](./sprint1-exam-fixes.md), [sprint1-auth-checkup.md](./sprint1-auth-checkup.md)
통합 작업: [sprint2-integration.md](./sprint2-integration.md) — `test-integration` 브랜치에서 진행한 머지·연동 점검·통합 테스트 기록

> 본 문서는 Sprint 2의 개발 진행 상황을 누적 기록하는 로그입니다.
> 새 작업이 끝날 때마다 아래 "작업 기록"에 항목을 추가합니다.
> 통합 단계의 작업(프론트 PR 머지, 연동 점검, 통합 테스트, 갭 메우기)은 별도 문서로 분리되어 있습니다.

---

## 진행 현황 요약 (Sprint 개발 범위)

| 항목 | 백엔드 | 비고 |
|---|---|---|
| 시험 수정 (PUT) | ✅ 완료 (2026-05-08) | 프론트는 통합 단계에서 연동 |
| 시험 삭제 (DELETE) | ✅ 완료 (2026-05-08) | 프론트는 통합 단계에서 연동 |
| 백로그 7 (시험 코드 입력) | ✅ 완료 (2026-05-08) | — |
| 백로그 8 (학번/이름 응시 시작) | ✅ 완료 (2026-05-08) | — |
| 백로그 9 (답안 작성/문항 이동) | ✅ 완료 (2026-05-08) | — |
| 백로그 10 (답안 제출/자동 채점) | ✅ 완료 (2026-05-08) | — |
| 백로그 20 (동시 접속 차단 + heartbeat) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-A 인프라 (Redis + V3) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-B 도메인 (엔티티/Repo/ErrorCode) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-C 학생 세션 인증 (Resolver + 화이트리스트) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-D 백로그 7+8+20 (lookup·세션 시작·lock) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-E 백로그 9 (답안 초안 저장/복구) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-F 백로그 10 (제출 + 객관식 자동채점) | ✅ 완료 (2026-05-08) | — |
| ↳ PR-G 백로그 20 마무리 (heartbeat) | ✅ 완료 (2026-05-08) | — |

---

## 작업 기록

### 2026-05-08 — 시험 수정/삭제 API 추가 (백엔드 only)

#### 배경
교수가 시험을 개설(`POST`)하고 조회(`GET`)할 수는 있었으나, **수정/삭제 기능이 부재**했음.
프론트는 손대지 않고 백엔드 API만 우선 추가.

#### 추가된 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `PUT` | `/api/v1/exams/{examId}` | 시험 정보·문항·선택지·응시 명단을 일괄 갱신 |
| `DELETE` | `/api/v1/exams/{examId}` | 시험 및 모든 하위 데이터(문항/선택지/이미지/명단) 삭제 |

#### 정책

- **권한 검증**: 본인이 개설한 시험만 수정/삭제 가능 (`FORBIDDEN`)
- **응시 세션 보호**: `ExamSession`이 1건이라도 존재하면 수정·삭제 모두 차단
  - 신규 에러코드 `EXAM_HAS_SESSIONS` (HTTP 409 Conflict) 추가
  - 이미 응시 데이터가 쌓인 시험을 변경/삭제하면서 발생하는 무결성 손상을 방지
  - 또한 `ExamSession`은 `Exam`에 cascade되어 있지 않아 강제로 삭제 시 FK 제약으로 실패함 → 명시적 차단이 더 명확
- **수정 동작**: 전체 교체(replace) 방식
  - 요청 DTO는 생성과 동일한 `Request` 스키마 재사용
  - `questions`, `roster`는 기존 컬렉션을 `clear()` 후 재구성 (`orphanRemoval=true`로 DB 정리)
  - `examCode`, `proctorToken`은 **유지** (이미 배포된 코드/감독관 링크의 무효화를 막기 위함)
- **이미지 파일 정리**:
  - 수정 시 기존 문항에 첨부된 `QuestionImage` 레코드는 orphanRemoval로 DB에서 제거되지만, 디스크의 물리 파일은 별도 정리 필요
  - 수정/삭제 모두 `examRepository.flush()` 이후 `FileStorageService.deleteFile(filePath)`로 디스크 파일 제거
- **삭제 응답**: `204 No Content`

#### 검증 로직

생성/수정 양쪽에서 동일한 규칙을 강제하도록 `validateExamRequest(Request)` 헬퍼로 추출:
- `endsAt > startsAt`
- `roster` 최소 1명
- `MULTIPLE_CHOICE` 문항: 선택지 ≥ 2개, 정답 선택지 ≥ 1개

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../exam/controller/ExamController.java` | `updateExam` (PUT), `deleteExam` (DELETE) 추가 |
| `backend/.../exam/service/ExamService.java` | `updateExam`, `deleteExam` 추가 / 검증 로직 `validateExamRequest`로 분리 / `FileStorageService` 주입 |
| `backend/.../exam/entity/Exam.java` | 도메인 메서드 `update(title, startsAt, endsAt)` 추가 (setter 노출 회피) |
| `backend/.../global/exception/ErrorCode.java` | `EXAM_HAS_SESSIONS` (409 Conflict) 추가 |

#### API 스펙 (요약)

**PUT /api/v1/exams/{examId}**

요청 바디: 생성과 동일 (`Request` 레코드)
```json
{
  "title": "string",
  "startsAt": "2026-05-10T09:00:00+09:00",
  "endsAt":   "2026-05-10T11:00:00+09:00",
  "questions": [ /* QuestionDto[] */ ],
  "roster":    [ /* RosterDto[] */ ]
}
```

응답: `200 OK` + `ExamDetailResponse` (상세 조회와 동일 스키마)

**DELETE /api/v1/exams/{examId}**

응답: `204 No Content`

**공통 에러**

| 상태 | 코드 | 의미 |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | 인증 실패 |
| 403 | `FORBIDDEN` | 본인이 개설한 시험이 아님 |
| 404 | `EXAM_NOT_FOUND` | 시험 ID 미존재 |
| 409 | `EXAM_HAS_SESSIONS` | 응시 세션 존재 → 수정/삭제 차단 |
| 400 | `EXAM_TIME_INVALID` / `ROSTER_EMPTY` / `MULTIPLE_CHOICE_*` | 검증 실패 |

#### 빌드 검증

`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 후속 과제

- [ ] 프론트엔드: 시험 상세 페이지에 "수정", "삭제" 버튼 + 폼 연결
- [ ] (정책 검토) 응시 세션 존재 시에도 명단만 추가/이름 정정 등 일부 필드 부분 수정 허용 여부
- [ ] 통합 테스트: 수정/삭제 권한·세션 차단·이미지 파일 정리 시나리오

---

### 2026-05-08 — 백로그 7·8·9·10·20 학생 응시 흐름 — 계획 (백엔드 only)

#### 배경

현재 백엔드는 교수의 시험 개설/조회/수정/삭제까지만 구현됨.
이번 단계에서는 **학생 응시 라이프사이클(코드 입력 → 명단 검증 → 응시 → 답안 작성 → 제출)** 과 **동일 학번 동시접속 차단**을 한 묶음으로 구현.
프로젝트 특성상 짧은 TTL과 인메모리 빠른 lookup이 자주 필요 → **Redis 도입**을 전제로 설계.

#### 결정사항 (2026-05-08 합의)

1. **명단 미등록 vs 이름 불일치 메시지** → `STUDENT_NOT_IN_ROSTER` 하나로 통일 ("응시 권한이 없습니다"). 디버깅 편의보다 보안/단순함 우선.
2. **Redis 다운 시 정책** → **fail-close**. lock 획득에 실패하면 응시 시작 자체를 막음 (보안 우선).
3. **답안 초안 저장** → **Redis hash로 매 변경마다 PUT**. 프론트에서 디바운스 1초 권장. 네트워크 단절 시 백업은 향후 백로그 14에서 보완.
4. **세션 토큰 형식** → **raw `sessionUuid`**를 `X-Session-Token` 헤더로 송수신. JWT 회전 없음.

#### Redis 활용 매트릭스

| 데이터 | 저장소 | 키/구조 | TTL | 용도 |
|---|---|---|---|---|
| 응시 활성 lock | Redis | `exam:{examId}:active:{stuNo}` = `sessionUuid` | 30s (heartbeat 갱신) | 동시접속 차단 (#20) |
| 답안 초안 | Redis | `session:{sessionUuid}:draft` (HASH: questionId → JSON) | endsAt + 10min | 문항 이동 시 보존 (#9) |
| 학생 세션 메타 | Postgres | `exam_session` row | 영속 | 시작/제출/총점 (#8, #10) |
| 최종 답안 | Postgres | `submission_answer` + `submission_answer_choice` | 영속 | 채점/리포트 (#10, 향후 #11) |

#### DB 스키마 변경 (Flyway V3)

현재 `submission_answer.selected_choice_id`(단일 FK)는 백로그 9·10 스펙의 **객관식 다중 선택**과 어긋남.
**V3__multi_choice_submission.sql**:
- `submission_answer.selected_choice_id` 컬럼 DROP
- `answer_content_check` 제약 DROP
- 신규 테이블 `submission_answer_choice (submission_answer_id, choice_id)` (PK = 양쪽 합)

`exam_session`의 `UNIQUE (exam_id, student_number)`는 그대로 유지 → 동일 학생은 동일 시험에 1 row만 존재 (재접속 시 row 재사용).

#### 패키지/파일 추가 계획

```
domain/student/
  controller/StudentExamController.java        # 7,8
  controller/StudentSessionController.java     # 9,10,20
  service/StudentSessionService.java
  service/AnswerDraftService.java
  service/AutoGradingService.java
  dto/StudentRequest.java, StudentResponse.java
domain/exam/entity/
  SubmissionAnswer.java                        # 신규 (V3 적용 후)
  SubmissionAnswerChoice.java                  # 신규
domain/exam/repository/
  SubmissionAnswerRepository.java              # 신규
  ExamRosterRepository.java                    # 신규
infra/redis/
  RedisConfig.java
  SessionLockStore.java                        # SET NX EX 30 / GET / DEL / EXPIRE
  AnswerDraftStore.java                        # HSET / HGETALL / DEL
global/security/
  StudentSessionResolver.java                  # X-Session-Token → sessionUuid 주입
global/exception/ErrorCode.java                # 신규 코드 추가
```

`SecurityConfig`에 `/api/v1/student/**` 화이트리스트 추가. 인증은 컨트롤러 인자 레벨에서 `@CurrentSession UUID sessionUuid` 주입 + 서비스 검증.

#### API 명세 (학생용, base `/api/v1/student`)

| Method | Path | 인증 | 책임 | 백로그 |
|---|---|---|---|---|
| GET | `/exams/lookup?code={6자리}` | 무인증 | 시험 메타 조회 (제목, 시간) | 7 |
| POST | `/exams/{examCode}/sessions` | 무인증 | 명단/시간 검증 + lock 획득 + sessionUuid 발급 + 문항 페이로드 | 8, 20 |
| GET | `/sessions/me` | sessionUuid | 재접속 시 세션 + 초안 답안 일괄 반환 | 9 |
| PUT | `/sessions/me/answers/{questionId}` | sessionUuid | 답안 초안 저장 (Redis) | 9 |
| POST | `/sessions/me/heartbeat` | sessionUuid | lock TTL 갱신 (10초 주기) | 20 |
| POST | `/sessions/me/submit` | sessionUuid | 초안 → DB flush + 객관식 자동채점 + lock 해제 | 10 |

**중요**: 학생용 응답에서 `Question.correctAnswer` 및 `QuestionChoice.isCorrect` **반드시 제거**. 별도 학생용 DTO를 둠.

#### 핵심 로직 흐름

**(1) 세션 시작** — `POST /exams/{examCode}/sessions`
1. examCode → Exam (없으면 `EXAM_CODE_NOT_FOUND`)
2. 시간 검증: `now < startsAt` → `EXAM_NOT_STARTED` (응답에 `startsAt` 포함), `now > endsAt` → `EXAM_ENDED`
3. Roster 매칭: `(examId, studentNumber, studentName)` 모두 일치해야 통과. 어긋나면 `STUDENT_NOT_IN_ROSTER` (이름 불일치도 동일 코드로 통합)
4. `ExamSession` 조회/생성 (기존 IN_PROGRESS면 재사용, SUBMITTED면 `SESSION_ALREADY_SUBMITTED`)
5. Redis lock 시도: `SET exam:{examId}:active:{stuNo} {sessionUuid} NX EX 30`
   - 성공 → 통과
   - 실패: `GET`해서 본인 sessionUuid면 `EXPIRE` 갱신 (재접속), 다르면 `CONCURRENT_SESSION` (409)
   - Redis 자체 장애 시 → fail-close, 5xx 응답
6. 응답: `{ sessionUuid, exam{title, endsAt}, questions[정답 제거] }`

**(2) 초안 저장** — `PUT /sessions/me/answers/{questionId}`
1. 헤더 sessionUuid → `ExamSession` 검증 (status=IN_PROGRESS, examId 매칭)
2. `HSET session:{sessionUuid}:draft {questionId} {JSON{answerText, selectedChoiceIds}}`
3. 키 첫 생성 시 `EXPIREAT endsAt + 10min`

**(3) 제출 + 자동채점** — `POST /sessions/me/submit`
1. `HGETALL session:{sessionUuid}:draft` → 메모리 Map
2. DB 트랜잭션:
   - `ExamSession.status` 재확인 (다르면 `SESSION_ALREADY_SUBMITTED`)
   - 시험의 모든 문항 순회
     - **MC**: 정답 choice id set vs 학생 selected set이 **완전 일치** 시 만점, 아니면 0점. `SubmissionAnswer` + N개의 `SubmissionAnswerChoice` row
     - **SUBJECTIVE**: `answerText` 저장, `earned_score=0` (교수 채점 대기)
   - `ExamSession.submit(now, totalScore = Σ earned)`
3. 트랜잭션 커밋 후 best-effort: `DEL session:{sessionUuid}:draft`, `DEL exam:{examId}:active:{stuNo}` (Redis 정리 실패가 DB 롤백을 유발하면 안 됨)
4. 응답: `{ sessionUuid, totalScore, submittedAt }`

**(4) 동시접속 + 30초 grace** — heartbeat 패턴
- lock TTL = 30s, 클라이언트 heartbeat 주기 = 10s
- 응시 중: 매 heartbeat가 lock TTL 갱신 → 다른 기기 차단 유지
- 학생 A 연결 끊김: heartbeat 중단 → 30초 후 lock 자동 만료
- 30초 내 본인 재접속: lock value == 본인 sessionUuid → 통과
- 30초 내 타기기 시도: lock value 불일치 → `CONCURRENT_SESSION` 409
- 30초 후 어느 기기든: lock 비어있음 → 새로 점유, 동일 ExamSession row 재사용

#### 신규 ErrorCode

| 코드 | HTTP | 메시지 |
|---|---|---|
| `EXAM_CODE_NOT_FOUND` | 404 | 잘못된 시험 코드입니다 |
| `EXAM_NOT_STARTED` | 400 | 시험이 아직 시작되지 않았습니다 (응답 detail에 `startsAt` 포함) |
| `EXAM_ENDED` | 400 | 시험이 종료되었습니다 |
| `STUDENT_NOT_IN_ROSTER` | 403 | 응시 권한이 없습니다 (명단 미등록 + 이름 불일치 통합) |
| `CONCURRENT_SESSION` | 409 | 이미 다른 기기에서 응시 중입니다 |
| `SESSION_NOT_FOUND` | 404 | 세션이 존재하지 않거나 만료되었습니다 |
| `SESSION_ALREADY_SUBMITTED` | 409 | 이미 제출된 시험입니다 |
| `INVALID_SESSION_TOKEN` | 401 | 세션 토큰이 유효하지 않습니다 |
| `LOCK_UNAVAILABLE` | 503 | 일시적인 장애로 응시를 시작할 수 없습니다 (Redis fail-close) |

#### 작업 순서 (PR 단위)

1. **PR-A 인프라**: Redis docker-compose, gradle 의존성, RedisConfig, application.yml, V3 마이그레이션
2. **PR-B 도메인**: SubmissionAnswer/Choice 엔티티+repo, ExamRosterRepository, ExamSession 메서드 보강, 신규 ErrorCode
3. **PR-C 학생 인증**: StudentSessionResolver, SecurityConfig 화이트리스트
4. **PR-D 백로그 7+8+20**: lookup, 세션 시작, SessionLockStore
5. **PR-E 백로그 9**: AnswerDraftService, 초안 PUT/GET
6. **PR-F 백로그 10**: AutoGradingService, submit
7. **PR-G heartbeat + 통합 테스트**: heartbeat endpoint, Testcontainers Redis 기반 시나리오 테스트

각 PR은 의존 순서. 작업 진행 시 본 문서에 PR별 완료 항목을 누적 기록.

---

### 2026-05-08 — PR-A 인프라 작업 완료

#### 변경 요약
Redis 도입을 위한 설정/의존성 추가 및 객관식 다중 선택을 위한 DB 스키마 변경. 도메인 코드 변경은 없음 (PR-B에서 진행).

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `docker-compose.yml` | `redis:7-alpine` 서비스 추가 (포트 6379, 볼륨 `redisdata`) |
| `backend/build.gradle` | `spring-boot-starter-data-redis` 의존성 추가 |
| `backend/src/main/resources/application.yml` | `spring.data.redis` 블록 추가 (host/port는 `REDIS_HOST`/`REDIS_PORT` env 우선) |
| `backend/.../infra/redis/RedisConfig.java` | 신규. `StringRedisTemplate` 빈 등록 |
| `backend/src/main/resources/db/migration/V3__multi_choice_submission.sql` | 신규. `submission_answer.selected_choice_id` 컬럼 + `answer_content_check` 제약 DROP, `submission_answer_choice` 조인 테이블 신규 생성 |

#### 동작 변경
- 아직 도메인 코드에서 Redis를 사용하지 않으므로 런타임 동작은 그대로.
- 다만 `SubmissionAnswer` JPA 엔티티가 아직 없는 상태에서 V3가 적용되어도 (현재 엔티티 없음 + ddl-auto=validate) 충돌 없음.
- 기존 환경에서 `docker compose up -d redis`로 Redis 컨테이너만 추가 기동.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-B (도메인 엔티티/리포지토리/ErrorCode)로 진행.

---

### 2026-05-08 — PR-B 도메인 보강 완료

#### 변경 요약
학생 응시 흐름에서 사용할 도메인 객체와 에러코드를 선제적으로 추가. 컨트롤러/서비스는 PR-D 이후 작성.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../exam/entity/SubmissionAnswer.java` | 신규. `submission_answer` 매핑. 객관식 다중 선택은 `@ManyToMany`로 `submission_answer_choice` join 테이블에 매핑 (메타데이터 없는 순수 join → 별도 엔티티 불필요) |
| `backend/.../exam/repository/SubmissionAnswerRepository.java` | 신규. `findAllByExamSessionId` |
| `backend/.../exam/repository/ExamRosterRepository.java` | 신규. `findByExamIdAndStudentNumber` (학번/이름 매칭 1차 검증용) |
| `backend/.../exam/entity/ExamSession.java` | `@Builder` 추가, `sessionUuid`/`status`/`startedAt`/`totalScore` 기본값 세팅, `submit(int totalScore)` 도메인 메서드, 상수 `STATUS_*`, 헬퍼 `isInProgress`/`isSubmitted` |
| `backend/.../exam/repository/ExamSessionRepository.java` | `findByExamIdAndStudentNumber`, `findBySessionUuid` 추가 |
| `backend/.../global/exception/ErrorCode.java` | 9개 신규 코드: `EXAM_CODE_NOT_FOUND`(404), `EXAM_NOT_STARTED`(400), `EXAM_ENDED`(400), `STUDENT_NOT_IN_ROSTER`(403), `CONCURRENT_SESSION`(409), `SESSION_NOT_FOUND`(404), `SESSION_ALREADY_SUBMITTED`(409), `INVALID_SESSION_TOKEN`(401), `LOCK_UNAVAILABLE`(503) |

#### 설계 노트
- **`SubmissionAnswerChoice` 엔티티는 만들지 않았음**: V3로 만든 `submission_answer_choice` 테이블은 순수 join 테이블(별도 컬럼 없음)이라 `@ManyToMany` + `@JoinTable`로 충분. 향후 join row에 메타데이터(예: 학생이 변경한 시각)가 필요해지면 `@ManyToOne` 양방향의 별도 엔티티로 리팩토링.
- **`ExamSession.status`는 enum이 아닌 String 상수**로 둠: 기존 스키마(`VARCHAR + CHECK`)를 그대로 두고 도메인 상수만 노출.
- **`session_unique_per_student` UNIQUE 제약**은 엔티티에도 명시 (스키마 검증 + 동일 학생 중복 row 방지).

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-C (StudentSessionResolver + SecurityConfig 화이트리스트)로 진행.

---

### 2026-05-08 — PR-C 학생 세션 인증 인프라 완료

#### 변경 요약
학생 응시 컨트롤러에서 `X-Session-Token` 헤더를 컨트롤러 인자로 자연스럽게 받기 위한 인프라 추가. 보안 필터는 `/api/v1/student/**`를 화이트리스트하고, 세션 검증은 후속 PR의 서비스 계층에서 수행.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../global/security/CurrentSession.java` | 신규. 컨트롤러 인자에 부착하는 마커 어노테이션 |
| `backend/.../global/security/StudentSessionResolver.java` | 신규. `HandlerMethodArgumentResolver`. `X-Session-Token` 헤더 → `UUID` 파싱. 헤더 부재/형식 오류 시 `INVALID_SESSION_TOKEN` |
| `backend/.../global/config/WebMvcConfig.java` | 신규. `WebMvcConfigurer.addArgumentResolvers`로 위 리졸버 등록 |
| `backend/.../global/config/SecurityConfig.java` | `permitAll()` 목록에 `/api/v1/student/**` 추가 |

#### 설계 노트
- **Resolver는 헤더 → UUID 파싱만 담당**. ExamSession 존재 여부, status, 만료 검증은 **서비스 계층 책임**으로 분리. 매 요청마다 DB를 두드릴지 여부는 호출 측이 결정 가능.
- **사용 예시(컨트롤러)**:
  ```java
  @PutMapping("/sessions/me/answers/{questionId}")
  public ResponseEntity<...> saveDraft(@CurrentSession UUID sessionUuid,
                                       @PathVariable Long questionId,
                                       @RequestBody DraftRequest body) { ... }
  ```
- 학생 라우트는 Spring Security를 통과만 시키고, 인증 부담을 도메인으로 옮긴 형태.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-D (백로그 7+8+20: lookup, 세션 시작, SessionLockStore)로 진행.

---

### 2026-05-08 — PR-D 백로그 7·8·20 완료 (학생 응시 진입 + 동시접속 lock)

#### 변경 요약
학생이 시험 코드를 입력해 시험을 조회(7)하고, 학번/이름으로 응시를 시작(8)하며, 동일 학번 다른 기기 접근을 차단(20)하는 흐름을 한 묶음으로 구현. 응답 페이로드에서 정답 정보는 일체 제외.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../infra/redis/SessionLockStore.java` | 신규. `tryAcquire`/`refresh`/`release`. 키 `exam:{examId}:active:{stuNo}`, TTL 30s. Redis 장애 시 `LOCK_UNAVAILABLE` 변환 (fail-close). `release`만 best-effort |
| `backend/.../domain/student/dto/StudentRequest.java` | 신규. `SessionStartRequest(studentNumber, studentName)` |
| `backend/.../domain/student/dto/StudentResponse.java` | 신규. `ExamLookupResponse`, `SessionStartResponse`, `StudentQuestionDto`, `StudentChoiceDto`, `StudentImageDto` — 정답 필드 일체 제거 |
| `backend/.../domain/student/service/StudentSessionService.java` | 신규. `lookupExam`, `startSession` (시간/명단/세션/lock 검증 → 학생 페이로드 빌드) |
| `backend/.../domain/student/controller/StudentExamController.java` | 신규. `GET /lookup`, `POST /{examCode}/sessions` |

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 | 백로그 |
|---|---|---|---|---|
| GET | `/api/v1/student/exams/lookup?code={6자리}` | 무인증 | 200 + `ExamLookupResponse` | 7 |
| POST | `/api/v1/student/exams/{examCode}/sessions` | 무인증 | 201 + `SessionStartResponse` (sessionToken 포함) | 8, 20 |

#### 검증/처리 흐름 (POST sessions)
1. examCode → Exam (없으면 `EXAM_CODE_NOT_FOUND`)
2. 시간: `now < startsAt` → `EXAM_NOT_STARTED`, `now > endsAt` → `EXAM_ENDED`
3. roster 매칭: 학번 미등록 + 이름 불일치 모두 `STUDENT_NOT_IN_ROSTER`로 통합
4. 기존 세션:
   - `IN_PROGRESS`/`EXPIRED` → 재사용 (재접속 시나리오)
   - `SUBMITTED` → `SESSION_ALREADY_SUBMITTED`
   - 없음 → 새로 생성
5. Redis lock 획득 (`SET NX EX 30`):
   - 새로 획득 또는 본인 sessionUuid 점유 → 통과 (TTL 갱신)
   - 다른 sessionUuid 점유 → `CONCURRENT_SESSION` (409)
   - Redis 장애 → `LOCK_UNAVAILABLE` (503, fail-close)

#### 응답 페이로드 정책
- `Question.correctAnswer` **노출 금지**
- `QuestionChoice.isCorrect` **노출 금지**
- 문항/선택지는 `displayOrder`로 정렬해서 반환

#### 주의 사항 / 알려진 한계
- 본 PR에는 `GET /sessions/me`, 답안 초안 저장(PUT/GET), `POST /heartbeat`, `POST /submit`이 **포함되어 있지 않음**. 이들은 PR-E~G에서.
- 30초 grace 동작은 lock TTL과 heartbeat 미구현 상태에서는 단발성 lock으로만 작동. heartbeat 도입(PR-G) 후 완전한 동작.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-E (백로그 9: AnswerDraftService + 초안 PUT/GET) 진행.

---

### 2026-05-08 — PR-E 백로그 9 완료 (답안 초안 저장/복구)

#### 변경 요약
응시 중 답안을 Redis hash에 즉시 저장하여 문항 이동·재접속 시 보존되도록 함. 매 변경마다 PUT 호출 (프론트 1초 디바운스 권장). 정답 정보는 응답에서 일체 제외.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../infra/redis/AnswerDraft.java` | 신규. Redis 값으로 직렬화되는 단일 문항 답안 record (`answerText`, `selectedChoiceIds`) |
| `backend/.../infra/redis/AnswerDraftStore.java` | 신규. 키 `session:{uuid}:draft` (HASH). `save`/`getAll`/`clear`. 매 save마다 EXPIREAT을 `endsAt + 10min`으로 갱신. Redis 장애 시 `LOCK_UNAVAILABLE`. clear는 best-effort |
| `backend/.../domain/student/dto/StudentRequest.java` | `AnswerDraftRequest(answerText, selectedChoiceIds)` 추가 |
| `backend/.../domain/student/dto/StudentResponse.java` | `SessionMeResponse`, `AnswerDraftDto` 추가 |
| `backend/.../domain/exam/repository/QuestionRepository.java` | `findByIdAndExamId` 추가 (위조 방지용) |
| `backend/.../domain/student/service/AnswerDraftService.java` | 신규. `saveDraft`. 세션·시간·문항 검증 후 store 호출 |
| `backend/.../domain/student/service/StudentSessionService.java` | `getSessionMe(sessionUuid)` 추가 — 세션 메타 + 문항 + 초안 일괄 반환. `AnswerDraftStore` 의존성 추가 |
| `backend/.../domain/student/controller/StudentSessionController.java` | 신규. `GET /api/v1/student/sessions/me`, `PUT /api/v1/student/sessions/me/answers/{questionId}` |

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 | 비고 |
|---|---|---|---|---|
| GET | `/api/v1/student/sessions/me` | `X-Session-Token` | 200 + `SessionMeResponse` | 재접속 복구용. 시험 메타/문항/초안 답안 일체 반환 |
| PUT | `/api/v1/student/sessions/me/answers/{questionId}` | `X-Session-Token` | 204 | 단일 문항 초안 저장 |

#### 검증 흐름 (PUT)
1. `X-Session-Token`(UUID) 파싱 → resolver
2. session 조회: 없으면 `SESSION_NOT_FOUND`, `SUBMITTED`면 `SESSION_ALREADY_SUBMITTED`
3. `now > endsAt`이면 `EXAM_ENDED`
4. questionId가 session의 exam에 속하지 않으면 `QUESTION_NOT_IN_EXAM`
5. Redis hash에 저장 + TTL `endsAt + 10min`으로 갱신

#### 설계 노트
- **Redis 직렬화**: Spring 자동 등록된 `ObjectMapper`로 JSON 변환. `@JsonInclude(NON_NULL)`로 빈 필드 제거.
- **AnswerDraftService vs StudentSessionService 분리**: 초안 저장은 별도 서비스로 분리 (SRP). 세션 라이프사이클(start/me/submit) 책임은 `StudentSessionService` 유지. 양쪽이 `AnswerDraftStore`만 공유 → 순환 의존성 없음.
- **TTL 갱신 전략**: 매 save마다 `EXPIREAT(endsAt + 10min)`. 시험이 종료된 뒤에도 10분간은 비상 복구 가능, 이후 자동 정리.
- **clear는 best-effort**: 제출(PR-F) 시 호출. Redis 장애로 정리 실패해도 자연 만료에 의지.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-F (백로그 10: AutoGradingService + 제출 + DB flush)로 진행.

---

### 2026-05-08 — PR-F 백로그 10 완료 (답안 제출 + 객관식 자동 채점)

#### 변경 요약
학생이 제출 버튼을 누르면 Redis의 작성 중 답안을 한 번에 DB로 flush하고 객관식만 자동 채점. 트랜잭션 커밋 후 best-effort로 Redis 정리.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../domain/student/service/AutoGradingService.java` | 신규. `correctChoiceIds(question)`, `gradeQuestion(question, draft)` |
| `backend/.../domain/student/dto/StudentResponse.java` | `SubmitResponse(sessionToken, status, totalScore, submittedAt)` 추가 |
| `backend/.../domain/student/service/StudentSessionService.java` | `submit(sessionUuid)` 추가. `SubmissionAnswerRepository`, `AutoGradingService` 의존성 추가. 트랜잭션 내부 채점/저장 + `TransactionSynchronization.afterCommit`으로 Redis 정리 |
| `backend/.../domain/student/controller/StudentSessionController.java` | `POST /api/v1/student/sessions/me/submit` 추가 |

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 |
|---|---|---|---|
| POST | `/api/v1/student/sessions/me/submit` | `X-Session-Token` | 200 + `SubmitResponse` |

#### 자동 채점 정책
- **MULTIPLE_CHOICE**: 정답 선택지 id 집합과 학생이 선택한 id 집합이 **완전히 일치**해야 만점, 아니면 0점. 부분 점수 없음 (백로그 10 스펙).
- **SUBJECTIVE**: 0점으로 저장. 교수가 후속으로 채점 (백로그 11).

#### 처리 흐름
1. `X-Session-Token` → `sessionUuid`
2. session 조회 (없으면 `SESSION_NOT_FOUND`, `SUBMITTED`면 `SESSION_ALREADY_SUBMITTED`)
3. `answerDraftStore.getAll(sessionUuid)`로 초안 일괄 read
4. `@Transactional` 안에서 시험의 모든 문항 순회:
   - draft가 있으면 채점, 없으면 빈 답안으로 저장 (모든 문항이 1행 보장)
   - MC 다중 선택은 `SubmissionAnswer.selectedChoices` (`@ManyToMany` → `submission_answer_choice` join 테이블)에 매핑
   - draft에 들어온 choiceId 중 실제 해당 문항 선택지에 해당하는 것만 통과 (위조/오타 무시)
5. `ExamSession.submit(totalScore)` → `status='SUBMITTED'`, `submitted_at=now()`, `total_score=Σ earned`
6. `TransactionSynchronizationManager.registerSynchronization`의 `afterCommit`에서:
   - `answerDraftStore.clear(sessionUuid)`
   - `sessionLockStore.release(examId, studentNumber)`
   - 이 단계 실패는 트랜잭션 결과에 영향을 주지 않음 (자연 만료에 의지)

#### 설계 노트
- **모든 문항에 대해 SubmissionAnswer row 생성**: V3에서 `answer_content_check` 제약을 DROP한 이유. 미응답 문항도 `earnedScore=0` row로 저장되어 후속 리포트(백로그 21)에서 통계가 깨지지 않음.
- **afterCommit 전략**: 트랜잭션 내부에서 Redis ops를 수행하면 DB 트랜잭션이 길어질 뿐 아니라 Redis 실패가 DB 롤백을 유발 → 둘 다 분리. `afterCommit` hook은 Spring 표준 패턴.
- **questionId/choiceId 위조 방어**: 채점 시 draft의 `selectedChoiceIds`를 그대로 신뢰하지 않고 `question.getChoices()`와 교집합만 사용. 학생이 다른 문항의 choice id를 보내도 무시됨.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### 다음 단계
PR-G (heartbeat 엔드포인트 + 통합 테스트)로 진행. 30초 grace 동작이 완성됨.

---

### 2026-05-08 — PR-G 백로그 20 마무리 (heartbeat)

#### 변경 요약
응시 중 클라이언트가 주기적으로 호출해 응시 활성 lock TTL을 갱신하는 heartbeat 엔드포인트 추가. 이로써 30초 grace 동작이 완성됨.

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../domain/student/service/StudentSessionService.java` | `heartbeat(sessionUuid)` 추가. 세션 검증 후 `sessionLockStore.tryAcquire`로 갱신/재획득 |
| `backend/.../domain/student/controller/StudentSessionController.java` | `POST /api/v1/student/sessions/me/heartbeat` 추가 |

#### 추가된 엔드포인트

| Method | Path | 인증 | 응답 |
|---|---|---|---|
| POST | `/api/v1/student/sessions/me/heartbeat` | `X-Session-Token` | 204 / `CONCURRENT_SESSION`(409) |

#### 동작 (백로그 20 완성)
- 클라이언트는 약 10초 주기로 heartbeat 호출 → lock TTL이 30초로 갱신됨
- 학생 A 연결 끊김: heartbeat 중단 → 30초 경과 후 lock 자동 만료
- 30초 내 본인 재접속: `tryAcquire` GET하여 본인 sessionUuid면 EXPIRE 갱신 → 통과
- 30초 내 타기기 시도: lock value 불일치 → `CONCURRENT_SESSION` (409)
- 30초 후 본인/타기기: lock 비어있음 → SET NX EX로 새로 점유 (단, 동일 학번이면 동일 ExamSession row 재사용)

#### 설계 노트
- `tryAcquire`를 그대로 재사용하여 "TTL 갱신"과 "만료 후 재획득"을 동일 로직으로 처리. 별도 `refresh-only` 메서드보다 단순.
- heartbeat가 SUBMITTED 상태에서 호출되면 `SESSION_ALREADY_SUBMITTED` 반환 → 클라이언트는 heartbeat 중단 신호로 활용 가능.

#### 빌드 검증
`./gradlew compileJava --rerun-tasks` → `BUILD SUCCESSFUL`

#### Sprint 2 백엔드 작업 완료
- 백로그 7, 8, 9, 10, 20 백엔드 구현 100% 완료
- 학생 응시 흐름 (코드 입력 → 명단 검증 → 응시 시작 → 답안 작성/저장/복구 → 제출 + 자동채점) 전 단계 동작
- 동일 학번 동시접속 차단 + 30초 grace 동작 완전 구현

#### 후속 과제
- [ ] 프론트엔드 연동 (학생 응시 UI 전체 — 본 sprint 범위 외)
- [ ] 통합 테스트: Testcontainers 기반 (Postgres + Redis) 시나리오
  - 명단 매칭 (학번/이름 모두 일치 / 어느 하나 다른 케이스)
  - 동시접속 차단 + heartbeat로 grace 검증
  - 객관식 자동 채점 (정답 일치/부분 일치/오답)
  - 제출 후 Redis 정리 확인
- [ ] 시간 만료 자동 제출 (백로그 22) — 이번 sprint 범위 외, 별도 sprint에서
