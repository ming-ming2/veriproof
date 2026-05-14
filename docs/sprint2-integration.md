# Sprint 2 통합 기록

작성일: 2026-05-11
범위: `test-integration` 브랜치에서 진행한 백/프론트 통합 작업
관련 문서: [sprint2-progress.md](./sprint2-progress.md) — Sprint 2 개발 진행 기록

> 본 문서는 Sprint 2 개발 작업을 통합하면서 발생한 머지/연동 점검/통합 테스트/갭 메우기 작업을 기록합니다.

---

## 진행 현황 요약 (통합 범위)

| 항목 | 상태 | 일자 |
|---|---|---|
| 교수 CRUD 백엔드 확장 (PR #10 머지) | ✅ | 2026-05-11 |
| 프론트엔드 PR #9, #11 머지 + 충돌 해소 | ✅ | 2026-05-11 |
| 프론트↔백 연동 점검 및 수정 (MOCK 제거, 페이로드 정합성) | ✅ | 2026-05-11 |
| 비밀번호 변경 현재비번 검증 (백엔드 정책 보강) | ✅ | 2026-05-11 |
| 통합 테스트 실행 (21+5건 시나리오) | ✅ | 2026-05-11 |
| `ExamService.updateExam` UNIQUE 충돌 버그 수정 | ✅ | 2026-05-11 |
| 백로그 11 프론트 UI (학생 답안 상세 + 주관식 채점) | ✅ | 2026-05-11 |

---

## 작업 기록

### 2026-05-11 — 교수 CRUD 백엔드 확장 (백로그 11 + 프로필)

#### 배경
PR #10 (`sprint2`, OpAue) 머지로 교수 도메인에 다음 기능이 백엔드에 추가됨.

#### 추가된 엔드포인트

| Method | Path | 설명 | 백로그 |
|---|---|---|---|
| `GET` | `/api/v1/auth/me` | 내 프로필 조회 | — |
| `PATCH` | `/api/v1/auth/update` | 이름·소속 수정 | — |
| `PATCH` | `/api/v1/auth/pwupdate` | 비밀번호 변경 | — |
| `DELETE` | `/api/v1/auth/delete` | 계정 탈퇴 | — |
| `PUT` | `/api/v1/exams/{examId}/sessions/{sessionId}/questions/{questionId}/grade` | 주관식 답안 점수 입력 | 11 |

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../auth/controller/AuthController.java` | `getMe`, `updateProfile`, `updatePw`, `withdraw` 핸들러 추가 |
| `backend/.../auth/service/AuthService.java` | `getProfile`, `updateProfile`, `updatePw`, `deleteAccount` 메서드 추가 |
| `backend/.../auth/dto/AuthRequest.java` | `UpdateProfileRequest`, `UpdatePwRequest` 추가 |
| `backend/.../auth/dto/AuthResponse.java` | `ReadProfessorResponse` 추가 |
| `backend/.../auth/entity/Professor.java` | `updateProfile`, `updatePassword` 도메인 메서드 추가 |
| `backend/.../exam/controller/ExamController.java` | `gradeAnswer` 핸들러 추가 |
| `backend/.../exam/service/GradingService.java` | 신규. 권한·상태·타입·배점 검증 후 점수 반영 + 세션 총점 재계산 |
| `backend/.../exam/entity/SubmissionAnswer.java` | `updateScore` 도메인 메서드 추가 |
| `backend/.../exam/entity/ExamSession.java` | `updateTotalScore`, `isSubmitted` 추가 |
| `backend/.../exam/repository/SubmissionAnswerRepository.java` | `findByExamSessionIdAndQuestionId` 추가 |
| `backend/.../global/exception/ErrorCode.java` | `USER_NOT_FOUND`, `ANSWER_NOT_FOUND`, `SESSION_NOT_SUBMITTED`, `NOT_SUBJECTIVE_QUESTION`, `INVALID_SCORE` 추가 |

#### 정책 (주관식 채점)
- 본인이 개설한 시험만 채점 가능 (`FORBIDDEN`)
- 세션 상태가 `SUBMITTED`일 때만 채점 허용
- 대상 문항이 `SUBJECTIVE`일 때만 허용
- 점수는 `0 ≤ earnedScore ≤ question.points`
- 채점 후 해당 세션의 모든 답안 합산으로 `total_score` 재계산

---

### 2026-05-11 — 프론트엔드 PR 머지 (교수 CRUD UI + 학생 응시 UI)

#### 배경
백엔드와 분리되어 작업되던 두 개의 프론트 PR을 `test-integration` 브랜치에서 통합.

#### 머지된 PR

| PR | 헤드 브랜치 | 내용 |
|---|---|---|
| #9 | `sprint2/frontend` | 백로그 7·8·9·10·12·20 학생 응시 UI |
| #11 | `sprint2/professor-crud` | 시험 수정/삭제 UI, 프로필 페이지, 응시 명단 관리 |

GitHub 상에서는 두 PR 모두 OPEN 상태 유지. 통합 테스트 완료 후 `main`으로 일괄 머지 예정.

#### 추가된 페이지/라우트

| 경로 | 파일 | 백로그 |
|---|---|---|
| `/exam/:id/edit` | `pages/ExamEdit.jsx` | — (시험 수정) |
| `/profile` | `pages/ProfileEdit.jsx` | — (프로필) |
| `/exam` | `pages/ExamEnterCode.jsx` | 7 |
| `/exam/enter` | `pages/ExamEnterStudent.jsx` | 8 |
| `/exam/session` | `pages/ExamSession.jsx` | 9, 10, 12, 20 |
| `/exam/done` | `pages/ExamDone.jsx` | 10 |

#### 추가된 API 모듈

| 위치 | 책임 |
|---|---|
| `frontend/src/api/exam-session.js` | 학생용 6개 엔드포인트 (lookup·startSession·getSession·saveAnswer·submitExam·sendHeartbeat) |
| `frontend/src/api/profile.js` | 프로필 4개 (당시 MOCK 상태) |
| `frontend/src/hooks/useExamGuard.js` | 응시 화면 이탈 감지 (백로그 12) |
| `frontend/src/hooks/useFullscreen.js` | 전체화면 진입/해제 |

#### 머지 충돌 처리
- `faa2ada` 커밋에서 PR #9·#11 사이 교차 충돌 해소
- `App.jsx` 라우트 통합, `pages/ExamDetail.jsx` 수정/삭제 버튼과 학생 세션 표시 통합

---

### 2026-05-11 — 프론트↔백 연동 점검 및 수정

#### 배경
`test-integration` 브랜치에서 정합성 검토 결과, 일부 프론트 호출이 MOCK 상태이거나 백엔드 스펙과 어긋남. 학생 응시 흐름·인증·시험 개설·이미지 업로드는 정상 매핑 확인. 다음 항목을 일괄 수정.

#### 1) 시험 수정/삭제 실 API 연결

| 위치 | 변경 |
|---|---|
| `frontend/src/api/exam.js` | `updateExam`/`deleteExam`의 MOCK `setTimeout` 블록 제거, `axiosInstance.put('/exams/{id}', payload)` / `axiosInstance.delete('/exams/{id}')`로 교체 |

#### 2) `ExamEdit.jsx` 페이로드 정합성 보강

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 객관식 옵션 형태 | `string[]` (정답 정보 손실) | `{ body, isCorrect }[]` |
| 객관식 페이로드 | `isCorrect` 누락 → 백엔드 `@NotNull` 검증 실패 | `isCorrect` 포함 + 정답 1개 이상 검증 |
| 주관식 `correctAnswer` | 폼에 없음 | 입력란 추가 + 페이로드 포함 |
| `startsAt`/`endsAt` | `datetime-local` 원본 문자열 전송 → `OffsetDateTime` 파싱 실패 | `toIsoWithOffset()`로 ISO-8601 UTC 변환 |
| `displayOrder` | 0-base | 1-base (ExamCreate/RosterRegister와 일관) |
| 클라이언트 검증 | 없음 | 시간/명단 ≥1/문항본문/배점 ≥1/객관식 ≥2 + 정답 ≥1 |
| 에러 표시 | 메시지만 | `[CODE] message` 형식 |

객관식 정답 체크박스와 주관식 참조용 정답 입력란 UI를 ExamCreate와 동일한 형태로 추가. 기존 시험 로딩 시 `choices`에서 `isCorrect`를 보존하도록 매핑 수정.

#### 3) 프로필 API MOCK 제거

| 위치 | 변경 |
|---|---|
| `frontend/src/api/profile.js` | `getProfile`/`updateProfile`/`changePassword`/`deleteAccount` 4개 MOCK 전부 제거. 실제 axios 호출(`/auth/me`, `/auth/update`, `/auth/pwupdate`, `/auth/delete`)로 교체 |
| `frontend/src/pages/ProfileEdit.jsx` | `profile.email` 표시 → `profile.username` 표시로 변경 (백엔드 `ReadProfessorResponse` 스키마 정합). `deleteAccount({password})` 호출에서 인자 제거 (백엔드 DELETE는 body 미수신) |

#### 4) 비밀번호 변경 현재비번 검증 (백엔드 정책 보강)

| 위치 | 변경 |
|---|---|
| `backend/.../auth/dto/AuthRequest.java` | `UpdatePwRequest`를 `{ currentPassword, newPassword }`로 분리. 둘 다 `@NotBlank`, `newPassword`는 8자 이상 제약 |
| `backend/.../auth/service/AuthService.java` | `updatePw`에서 `passwordEncoder.matches(currentPassword, ...)` 검증, 실패 시 `INVALID_CREDENTIALS` 던짐 |

ProfileEdit는 이미 `{ currentPassword, newPassword }`를 전송하던 상태라 백엔드 측 수정만으로 정합.

#### 빌드 검증
- 백엔드: `./gradlew compileJava --rerun-tasks` → BUILD SUCCESSFUL
- 프론트: `npm run build` → built in 351ms (vite v8.0.10)



---

### 2026-05-11 — 통합 테스트 실행 (`test-integration` 브랜치)

#### 환경
- Docker: `veriproof-db` (postgres:16), `veriproof-redis` (redis:7-alpine) 기동
- 백엔드: `./gradlew bootRun` (port 8081)
- 검증 방식: curl 기반 API 시나리오 테스트 (UI 자동화는 범위 외)

#### 시나리오 결과 (21건)

| # | 영역 | 시나리오 | 결과 |
|---|---|---|---|
| 1 | 인증 | 회원가입 → 201 + ProfessorResponse | ✅ |
| 2 | 인증 | 로그인 → JWT 발급 | ✅ |
| 3 | 인증 | `GET /auth/me` → `{username, name, affiliation}` | ✅ |
| 4 | 시험 | 시험 개설 + 6자리 코드 + proctor link | ✅ |
| 5 | 시험 | `GET /dashboard` 목록 + `GET /exams/{id}` 상세 | ✅ |
| 6 | 시험 | **시험 수정 (PUT)** — 제목·시간·문항·정답·명단 전체 교체, `examCode` 유지 | ✅ (버그 수정 후) |
| 7 | 시험 | 응시자 있는 시험 PUT/DELETE → 409 `EXAM_HAS_SESSIONS` | ✅ |
| 8 | 시험 | 빈 시험 DELETE → 204, 재조회 시 404 | ✅ |
| 9 | 시험 | 타 교수가 남의 시험 조회 → 403 `FORBIDDEN` | ✅ |
| 10 | 학생 | `GET /student/exams/lookup` | ✅ |
| 11 | 학생 | 시작 시각 이전 응시 시도 → 400 `EXAM_NOT_STARTED` | ✅ |
| 12 | 학생 | 이름 불일치 + 명단 미등록 → 403 `STUDENT_NOT_IN_ROSTER` (통합 코드) | ✅ |
| 13 | 학생 | 응시 시작 → sessionToken 발급, 응답에 정답 정보(`correctAnswer`/`isCorrect`) 제거 확인 | ✅ |
| 14 | 학생 | `PUT /sessions/me/answers/{qId}` → 204, `GET /sessions/me`로 drafts 복원 확인 | ✅ |
| 15 | 학생 | `POST /sessions/me/heartbeat` → 204 | ✅ |
| 16 | 학생 | `POST /sessions/me/submit` → 객관식 자동채점(정답 일치 시 만점), 주관식 0점 | ✅ |
| 17 | 학생 | 중복 제출 → 409 `SESSION_ALREADY_SUBMITTED` | ✅ |
| 18 | 채점 | 주관식 채점 20/25점 → 총점 자동 재계산 (15+20=35) | ✅ |
| 19 | 채점 | 만점 초과 채점 → 400 `INVALID_SCORE` | ✅ |
| 20 | 채점 | 객관식에 채점 시도 → 400 `NOT_SUBJECTIVE_QUESTION` | ✅ |
| 21 | 프로필 | `PATCH /auth/update` (이름/소속) → GET으로 반영 확인 | ✅ |
| 22 | 프로필 | `PATCH /auth/pwupdate` 현재비번 틀림 → 401 `INVALID_CREDENTIALS` | ✅ |
| 23 | 프로필 | 새 비번으로 갱신 → 이전 비번 로그인 거부 + 새 비번 로그인 성공 | ✅ |
| 24 | 프로필 | `DELETE /auth/delete` (body 없이) → 200, 탈퇴 후 로그인 거부 | ✅ |

#### 발견·수정한 버그

**`ExamService.updateExam` — `question_order_unique` UNIQUE 충돌 (500)**

- 증상: `PUT /api/v1/exams/{examId}` 호출 시 500. 로그에는 `duplicate key value violates unique constraint "question_order_unique"`.
- 원인: `getQuestions().clear()` 직후 곧바로 새 `Question` 엔티티를 add. `orphanRemoval=true`는 트랜잭션 flush 시점에서야 DELETE를 실행하므로, JPA가 INSERT를 먼저 시도 → `(exam_id, display_order)` UNIQUE 위반. `Roster`도 동일하게 `(exam_id, student_number)` UNIQUE 위험 존재.
- 수정: `clear()` 직후 `examRepository.flush()` 1줄 추가하여 DELETE를 강제 선행.
- 파일: `backend/.../exam/service/ExamService.java:220-225`
- 영향 범위: 시험 수정 기능이 PR #8 머지 이후 동작하지 않던 상태. 통합 테스트 전까지 노출되지 않음.

#### 알려진 정합성 흠 (수정 안 함, 보고만)

**`gradeAnswer` 엔드포인트의 `sessionId` 파라미터를 클라이언트가 얻을 경로 없음**

- 엔드포인트: `PUT /api/v1/exams/{examId}/sessions/{sessionId}/questions/{questionId}/grade` — `sessionId`는 numeric PK
- `GET /api/v1/exams/{examId}`의 `SessionDetailDto`는 `sessionUuid`(String)만 노출, numeric `id` 없음
- 백로그 11 프론트 UI 작업 시 다음 중 택일 필요:
  - (A) `SessionDetailDto`에 `Long id` 필드 추가
  - (B) 엔드포인트를 `{sessionUuid}` 기반으로 변경 (StudentSessionResolver 패턴과 일관)

#### 단일 curl로 검증 불가능한 항목 (Testcontainers 권장)

- `CONCURRENT_SESSION`: 같은 학번+이름의 두 번째 호출은 본인 재접속으로 인식되어 같은 sessionToken 반환되는 게 설계 의도. 실 lock 충돌은 lock TTL 30s 만료 후 타기기 진입 시나리오라 멀티 클라이언트 시뮬레이션 필요.
- 30초 grace 동작 (heartbeat 끊김 → 재접속 허용)
- Redis 장애 시 `LOCK_UNAVAILABLE` (fail-close)

#### 빌드/실행 검증
- `./gradlew compileJava` → BUILD SUCCESSFUL
- 백엔드 부팅: 6.6초
- 21개 시나리오 전부 통과

#### 변경된 파일 (본 테스트 회차에서 추가)
| 위치 | 변경 |
|---|---|
| `backend/.../exam/service/ExamService.java` | `updateExam`에 `examRepository.flush()` 1줄 추가 (UNIQUE 충돌 회피) |

---

### 2026-05-11 — 백로그 11 프론트 UI 완료

#### 배경
백엔드는 PR #10에서 이미 완료된 상태였으나, `gradeAnswer` 엔드포인트의 `sessionId` path 파라미터를 클라이언트가 얻을 경로가 없었고 (`SessionDetailDto`에 numeric id 미노출), 학생 답안 본문을 조회하는 API 자체가 존재하지 않아 채점 UI를 만들 수 없는 상태.

#### 신규 백엔드 API

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/v1/exams/{examId}/sessions/{sessionId}/answers` | 한 학생의 모든 답안 + 점수 + 정답(참조용·객관식 isCorrect)을 일괄 반환 |

응답 스키마:
```json
{
  "data": {
    "sessionId": 1,
    "studentNumber": "...",
    "studentName": "...",
    "status": "SUBMITTED",
    "totalScore": 35,
    "submittedAt": "...",
    "answers": [
      {
        "questionId": 6,
        "questionType": "MULTIPLE_CHOICE",
        "questionBody": "...",
        "points": 15,
        "correctAnswer": null,
        "earnedScore": 15,
        "answerText": null,
        "selectedChoiceIds": [7],
        "choices": [{"id":6,"body":"3","isCorrect":false,"displayOrder":1}, ...]
      },
      {
        "questionId": 7,
        "questionType": "SUBJECTIVE",
        "questionBody": "...",
        "points": 25,
        "correctAnswer": "breadth-first search",
        "earnedScore": 20,
        "answerText": "BFS explores neighbors...",
        "selectedChoiceIds": [],
        "choices": []
      }
    ]
  }
}
```

권한·검증: 본인이 개설한 시험만 → 아니면 `FORBIDDEN`(403). 세션이 해당 시험에 속하지 않거나 존재하지 않으면 `SESSION_NOT_FOUND`(404).

#### `SessionDetailDto`에 `id` 필드 추가
- `GET /api/v1/exams/{examId}` 응답의 `sessions[].id`(Long) 노출 → 프론트가 채점 엔드포인트 path 구성 가능
- `ExamService.getExamDetail` 매핑에 `s.getId()` 추가

#### 변경 파일

| 위치 | 변경 |
|---|---|
| `backend/.../exam/dto/Response.java` | `SessionDetailDto`에 `Long id` 첫 필드로 추가. `SessionAnswersResponse`·`AnswerDetailDto` 신규 |
| `backend/.../exam/service/ExamService.java` | `SubmissionAnswerRepository` 주입, `getSessionAnswers(professorId, examId, sessionId)` 메서드 신규. `getExamDetail` 매핑에 `s.getId()` 포함 |
| `backend/.../exam/controller/ExamController.java` | `GET /{examId}/sessions/{sessionId}/answers` 핸들러 신규 |
| `frontend/src/api/exam.js` | `getSessionAnswers(examId, sessionId)`, `gradeSubjective(examId, sessionId, questionId, earnedScore)` 함수 추가 |
| `frontend/src/pages/SessionGrade.jsx` | 신규. 학생 답안 상세 + 주관식 채점 폼. 객관식은 정답/학생 선택 마크업으로 표시, 주관식은 점수 입력란 + 저장 버튼 |
| `frontend/src/App.jsx` | `/exam/:examId/sessions/:sessionId` 라우트 추가 (PrivateRoute) |
| `frontend/src/pages/ExamDetail.jsx` | 응시 학생 표의 각 행에 `onClick={navigate to SessionGrade}` 추가, hover 스타일 |

#### UI 정책
- 객관식: 점수 입력 칸 없음 (자동 채점된 결과만 표시). 정답 ✔, 학생 선택 ◉ 마크로 시각화.
- 주관식: 학생 답안 + 참조용 정답(있을 때만) + `0 ≤ score ≤ points` 점수 입력 + 저장 버튼. 저장 성공 시 GET 재호출로 총점 동기화.
- 검증: 빈 입력, 음수, 만점 초과 모두 클라이언트 단에서 차단. 백엔드 `INVALID_SCORE`(400)도 폴백으로 표시.

#### 통합 테스트

| 시나리오 | 결과 |
|---|---|
| `GET /exams/{id}` 응답의 `sessions[].id` 노출 확인 | ✅ |
| `GET /exams/{id}/sessions/{sId}/answers` 본인 호출 → 200 + 답안 전체 | ✅ |
| 타 교수 호출 → 403 `FORBIDDEN` (GET·PUT 양쪽) | ✅ |
| 존재하지 않는 sessionId → 404 `SESSION_NOT_FOUND` | ✅ |
| 주관식 재채점 (20점 → 22점) → totalScore 자동 재계산 (15+22=37) | ✅ |

#### 빌드 검증
- `./gradlew compileJava` → BUILD SUCCESSFUL
- `npm run build` → built in 272ms (99 modules)

#### Sprint 2 작업 완료
- 백로그 6·7·8·9·10·11·20 + 교수 가입 CRUD + 시험 수정/삭제 모두 프론트·백 양쪽 완료

