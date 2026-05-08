# Sprint 1 Exam (1-3 ~ 1-5) 점검 및 보강 보고서

작성일: 2026-05-07
범위: 백로그 1-3(시험 목록 조회), 1-4(시험 개설), 1-5(시험 상세 조회)
관련 보고서: [sprint1-auth-checkup.md](./sprint1-auth-checkup.md) (1-1, 1-2)

---

## 0. 점검 결과 요약

기존 상태:

| 항목 | 백엔드 | 프론트 | 종합 |
|---|---|---|---|
| 1-3 시험 목록 | ✅ 동작 | ❌ Mock | ⚠️ |
| 1-4 시험 개설 | ⚠️ 검증 미흡 | ❌ Mock + 명단/정답 UI 없음 | ❌ |
| 1-5 시험 상세 | ⚠️ roster 누락 | ❌ Mock + 명단/응시자/감독관링크 없음 | ❌ |

수정 후:

| 항목 | 상태 |
|---|---|
| 1-3 시험 목록 | ✅ 백엔드 응답 + 실제 호출 + 응시자 수까지 표시 |
| 1-4 시험 개설 | ✅ 명단/정답 UI + ErrorCode 기반 검증 + 이미지 업로드까지 연결 |
| 1-5 시험 상세 | ✅ 명단/응시자/감독관 링크/문항(정답 포함) 모두 화면 노출 |
| QR 코드 | 🗑️ 백엔드 유틸 + 프론트 패키지/UI 모두 제거 (시험 코드만 사용) |

---

## 1. QR 코드 기능 제거


### 무엇을 제거했나
| 위치 | 변경 |
|---|---|
| `backend/.../global/util/QrCodeUtil.java` | 파일 삭제 |
| `backend/build.gradle` | `com.google.zxing:core`, `com.google.zxing:javase` 의존성 제거 |
| `backend/.../exam/dto/Response.java` | `ExamCreateResponse.qrCodeUrl`, `ExamDetailResponse.qrCodeUrl` 필드 제거 |
| `backend/.../exam/service/ExamService.java` | `qrCodeUrl` 조립 로직 (`/api/v1/exams/{id}/qr`) 제거 |
| `frontend/package.json` | `qrcode.react` 의존성 제거 |
| `frontend/src/pages/ExamDetail.jsx` | `<QRCodeSVG>` 사용처 제거, 시험 코드 박스만 유지 |



---

## 2. 백엔드 변경

### 2.1 `ErrorCode` 확장 + 도메인 예외 일관화

**문제**: `ExamService` / `ImageUploadService`가 `IllegalArgumentException`, `SecurityException`을 던졌지만 `GlobalExceptionHandler`는 `CustomException`만 잡음 → 검증 실패가 **HTTP 500**으로 응답됨. 프론트는 의미 있는 에러 코드를 받지 못해서 단순 "실패" 메시지밖에 보여줄 수 없음.

**수정** — `ErrorCode`에 다음 코드 추가:

| Code | HTTP | 의미 |
|---|---|---|
| `FORBIDDEN` | 403 | 본인이 만든 자원이 아님 |
| `EXAM_NOT_FOUND` | 404 | 시험 ID 없음 |
| `QUESTION_NOT_FOUND` | 404 | 문항 ID 없음 |
| `EXAM_TIME_INVALID` | 400 | `endsAt <= startsAt` |
| `ROSTER_EMPTY` | 400 | 명단 0명 (백로그 1-4 검증 포인트) |
| `MULTIPLE_CHOICE_NO_CORRECT` | 400 | 객관식 정답 미지정 (백로그 1-4 검증 포인트) |
| `MULTIPLE_CHOICE_NO_CHOICES` | 400 | 객관식 선택지 < 2 |
| `INVALID_FILE` / `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` | 400 | 이미지 업로드 검증 |
| `QUESTION_NOT_IN_EXAM` | 400 | 문항이 해당 시험 소속 아님 |

**왜 새로 만들었나**
- 백로그가 명시적으로 "검증 포인트"로 든 케이스(명단 0명, 객관식 정답 없음, 시간 역순)에 모두 전용 코드를 부여 → 프론트가 케이스별 메시지 분기 가능.
- `INVALID_CREDENTIALS`/`USERNAME_ALREADY_EXISTS`처럼 기존 인증 코드는 그대로 두고 시험 도메인 코드만 새 그룹(`EXAM_*`, `MULTIPLE_CHOICE_*`)으로 분리.

### 2.2 `ExamService` — 검증 보강 + `CustomException` 전환

| 변경 | 이유 |
|---|---|
| `Professor not found` IllegalArgumentException → `CustomException(INVALID_CREDENTIALS)` | `professorId`는 JWT subject claim 출처. 여기서 못 찾으면 토큰은 유효하지만 사용자가 사라진 상태 → 자격증명 무효로 취급. |
| `endsAt > startsAt` 검증을 IllegalArgumentException → `CustomException(EXAM_TIME_INVALID)` | 명세된 코드로 응답 |
| `roster == null \|\| isEmpty()` 가드 추가 → `ROSTER_EMPTY` | 백로그 1-4 검증 포인트. DTO 레벨(`@NotEmpty`)에서도 막지만 서비스 레벨에서 한 번 더 방어. |
| 객관식 검증 루프 추가: 선택지 < 2 → `MULTIPLE_CHOICE_NO_CHOICES`, 정답 0개 → `MULTIPLE_CHOICE_NO_CORRECT` | 백로그 1-4 검증 포인트 |
| `getExamDetail`의 `EXAM_NOT_FOUND`/`FORBIDDEN`을 IllegalArgumentException/SecurityException → CustomException | 위와 동일 사유 |
| `getExamsByProfessor`에 `examSessionRepository.countByExamId(exam.getId())` 추가 | 1-3 백로그 "응시자 수" 컬럼을 위해 필요. `rosterCount`(명단 인원)와 별개. |
| `getExamDetail`에서 `exam.getRosters()`도 DTO로 변환 | 백로그 1-5 "응시 명단" 표시 항목 |


### 2.3 `ImageUploadService` — `CustomException` 전환

기존: `IllegalArgumentException("Exam not found")`, `SecurityException("권한 없음")`, `IllegalArgumentException("파일 크기는 5MB를 초과...")` 등 메시지로만 구분.

수정: 모두 `CustomException(ErrorCode.*)` 로 전환.

| 기존 | 신규 |
|---|---|
| `Exam not found` | `EXAM_NOT_FOUND` |
| `Question not found` | `QUESTION_NOT_FOUND` |
| `해당 시험에 대한 권한이 없습니다` | `FORBIDDEN` |
| `문항이 해당 시험에 속하지 않습니다` | `QUESTION_NOT_IN_EXAM` |
| `파일이 비어있습니다` | `INVALID_FILE` |
| `파일 크기는 5MB를 초과...` | `FILE_TOO_LARGE` |
| `지원하지 않는 이미지 포맷...` | `UNSUPPORTED_FILE_TYPE` |

### 2.4 `Request` DTO — 입력 검증 강화

| 변경 | 이유 |
|---|---|
| `roster` 에 `@NotEmpty` + `@Valid` | 백로그 1-4 "명단 0명 시 검증 에러". 기존엔 옵셔널이라 빈 값이 그냥 통과됐음. |
| `questions`에 `@Valid` | 내부 필드(`@NotBlank body` 등) 검증이 실제로 동작하도록. |
| `points`에 `@Min(1)` | 0점/음수 문항을 입구에서 차단. DB 제약(`points > 0`)과 일치. |
| `questionType`에 `@Pattern(SUBJECTIVE\|MULTIPLE_CHOICE)` | 잘못된 enum 문자열이 서비스까지 흘러가서 `IllegalArgumentException`을 일으키지 않도록 입구에서 거름. |

### 2.5 `Response` DTO — 누락 필드 보강

| 변경 | 이유 |
|---|---|
| `ExamCreateResponse.qrCodeUrl` 제거 | QR 제거 |
| `ExamListResponse`에 `takerCount` 추가 + 기존 `registeredStudentCount` → `rosterCount`로 명확화 | 백로그 1-3 데모 5번 "명단 인원, 응시자 수"를 모두 노출하기 위함. 명단(roster)과 실제 응시(session)는 다른 개념인데 기존엔 한 필드로 뭉쳐있었음. |
| `ExamDetailResponse`에 `roster: List<RosterDetailDto>` 추가 | 백로그 1-5 데모 2번 "응시 명단" 항목. 기존 응답엔 빠져있었음. |
| `ExamDetailResponse.qrCodeUrl` 제거 | QR 제거 |
| `RosterDetailDto` 신규 (`id, studentNumber, studentName`) | 위 roster 필드 타입 |

### 2.6 `ExamSessionRepository` — `countByExamId` 추가

`getExamsByProfessor`에서 응시자 수(=세션 수)를 가져오기 위함. 단순 파생 쿼리 메서드.

---

## 3. 프론트 변경

### 3.1 신규 — `frontend/src/api/exam.js`

`auth.js`와 동일한 패턴으로 시험 도메인 API 모듈 신설:

```js
getExams()                         // GET /dashboard
getExamDetail(examId)              // GET /exams/{id}
createExam(payload)                // POST /exams
uploadQuestionImage(examId, qid, file)  // POST /exams/{id}/questions/{qid}/images
```

`axiosInstance` 활용 → JWT 헤더 자동 부착 + 401 인터셉터 그대로 적용됨. mock 단계에서는 컴포넌트 안에서 `setTimeout`으로 가짜 응답을 만들고 있었으나, 이제 모든 호출이 axios로 일원화됨.

### 3.2 `Dashboard.jsx` — Mock 제거 + 실 호출 + 컬럼 보강

| 변경 | 이유 |
|---|---|
| `mockExams` 하드코딩 제거 | 1-3 핵심: 실제 데이터 표시 |
| `useEffect` 안에서 `getExams()` 호출, cleanup으로 `cancelled` 가드 | 빠른 재방문 시 setState after unmount 방지 |
| 응답 unwrap 경로 `res.data.data` (axios `data` + `ApiResponse<T>` `data`) | 인증 보고서에 정의된 ApiResponse 래퍼 구조 그대로 |
| 테이블 컬럼: 시험명 / **코드** / 시작 시각 / 문항 / **명단** / **응시** / 액션 | 백로그 1-3 데모 2번에 명시된 모든 정보를 한 화면에 노출 |
| 빈 상태에 "+ 새 시험 만들기" 버튼 추가 | 백로그 1-3 4번 |
| 에러 상태(`error`) 분기 추가 | 네트워크 실패 시 무한 로딩 방지 |

### 3.3 `ExamCreate.jsx` — Mock 제거 + 명단/정답 UI 추가 + 이미지 업로드

**핵심 변경 — 새로 추가된 입력 영역**

1. **객관식 정답 체크박스**
   - 기존엔 선택지가 그냥 문자열 배열 `["", "", "", ""]` 이었음 → 어느 선택지가 정답인지 입력할 곳이 없었음.
   - 변경 후 `options: [{ body, isCorrect }, ...]` 객체 배열. 각 행 좌측에 체크박스가 붙어 정답 표시 가능.
   - 사전 검증: 채워진 선택지 < 2 또는 정답 0개면 제출 차단.

2. **주관식 참조용 정답 (`correctAnswer`)**
   - 백로그 1-4 데모 3번 "주관식 문항: 본문 입력, 배점 20점, `correctAnswer` 입력 (참조용)" 항목을 위해 추가.
   - 주관식일 때만 입력란 노출.

3. **응시 명단 섹션**
   - 학번/이름 row 단위 추가/삭제.
   - "일괄 입력" 토글 — 한 줄에 `학번,이름` 형식으로 텍스트 붙여넣기 → 명단 통째 교체. 댐 시연 시 30명 즉시 입력에 유용.
   - 최소 1명 이상 검증을 클라에서 한 번, 백엔드에서 한 번(`@NotEmpty` + `ROSTER_EMPTY`).

**페이로드 구성**

datetime-local 입력은 timezone이 없는 `"YYYY-MM-DDTHH:mm"` 문자열 → `new Date(...).toISOString()` 으로 UTC ISO 변환. 백엔드 `OffsetDateTime`이 받음.

```js
{
  title, startsAt, endsAt,
  questions: [{
    questionType: 'SUBJECTIVE' | 'MULTIPLE_CHOICE',
    body, correctAnswer | null, points, displayOrder,
    choices: [{ body, isCorrect, displayOrder }] | null
  }],
  roster: [{ studentNumber, studentName }]
}
```

**이미지 업로드**

시험 개설 응답에는 `questionId`가 없음(`ExamCreateResponse`는 `id`, `examCode`, `proctorLink`, `questionCount`만). 따라서:
1. `createExam` 성공 후
2. `getExamDetail`을 한 번 더 호출해 각 문항의 `id`를 확보
3. `displayOrder` 기준으로 매칭하여 `uploadQuestionImage`를 병렬 실행

이미지 업로드 일부 실패해도 시험 자체는 개설된 상태이므로 경고만 콘솔에 찍고 상세 페이지로 이동. (개선 여지 — Sprint 1 후반에 토스트로 노출 고려)

**에러 표시**

서버 응답의 `error.code`가 있으면 `[코드] 메시지` 포맷으로 노출 → 어떤 검증에 걸렸는지 즉시 파악 가능.

### 3.4 `ExamDetail.jsx` — Mock 제거 + 1-5 누락 항목 전부 추가

| 추가된 영역 | 백로그 1-5 근거 |
|---|---|
| 시험 코드 박스 (3-3 형식 분할 표시 + 복사 버튼) | "시험 정보 (시험명, 시간, 코드)" |
| **감독관 링크 박스 + "복사" 버튼** | "감독관 링크 + '복사' 버튼" — 기존 화면에 아예 없던 영역 |
| **문항 목록**: 본문 + 배점 + 객관식 정답 체크 표시(✔) + 주관식 `correctAnswer` 표시 + 첨부 이미지 | "문항 목록 (정답 데이터 포함, 교수만 볼 수 있음)" |
| **응시 명단 테이블** | "응시 명단" — 기존 응답 자체에 없던 데이터, 이번 라운드에서 백엔드에 추가 후 노출 |
| **응시 학생 테이블** (학번/이름/상태/총점/응시·제출 시각) | "응시 학생 목록 (학번, 이름, 상태, 총점, 응시/제출 시각)" |
| QR 박스 / 더미 `QRCodeSVG value="A1B2C3"` | 제거 (위 1번 절) |

`useParams`로 `:id` 파싱 → `getExamDetail` 호출. ExamCreate에서 navigate한 직후 location.state에 의존하던 우회 경로 제거 (어차피 새 응답 구조와 맞지 않음).

### 3.5 ESLint/dependency 경고

- `qrcode.react` 제거에 따라 `package-lock.json`은 다음 `npm install` 시점에 자동 정리됨. 별도 수작업 lockfile 정리는 하지 않음 (충돌 방지 목적).

---

## 4. 데이터 플로우 (수정 후)

### 시험 개설 (1-4)
```
ExamCreate.jsx
  ├─ 검증 (제목/시간/명단/객관식 정답)
  ├─ datetime-local → ISO 변환
  └─ POST /api/v1/exams
       ↓
ExamController.createExam
  └─ ExamService.createExam
       ├─ 시간 검증 (EXAM_TIME_INVALID)
       ├─ 명단 검증 (ROSTER_EMPTY)
       ├─ 객관식 검증 (MULTIPLE_CHOICE_NO_CORRECT / NO_CHOICES)
       ├─ 6자리 코드 생성 (충돌 시 재발급)
       └─ Exam + questions + choices + roster 저장
       → ExamCreateResponse { id, examCode, proctorLink, questionCount }
       ↓
ExamCreate.jsx
  ├─ (있으면) GET /api/v1/exams/{id} → 문항 ID 매핑
  ├─ POST /api/v1/exams/{id}/questions/{qid}/images (병렬)
  └─ navigate(/exam/:id)
```

### 시험 상세 조회 (1-5)
```
ExamDetail.jsx
  └─ GET /api/v1/exams/:id
       ↓
ExamController.getExamDetail
  └─ ExamService.getExamDetail
       ├─ EXAM_NOT_FOUND / FORBIDDEN 검증
       ├─ questions (정답/이미지/선택지 포함)
       ├─ roster
       └─ sessions
       → ExamDetailResponse
       ↓
ExamDetail.jsx
  ├─ 시험 정보 카드
  ├─ 시험 코드 + 복사
  ├─ 감독관 링크 + 복사
  ├─ 문항 목록 (정답 표시)
  ├─ 응시 명단 표
  └─ 응시 학생 표
```

---

## 5. 변경된 파일

```
backend/
├── build.gradle                                                # zxing 제거
└── src/main/java/com/example/veriproof/
    ├── domain/exam/
    │   ├── controller/ (변경 없음)
    │   ├── dto/Request.java                                    # @NotEmpty roster, @Valid, @Min, @Pattern
    │   ├── dto/Response.java                                   # qrCodeUrl 제거, takerCount/roster 추가, RosterDetailDto 신규
    │   ├── repository/ExamSessionRepository.java               # countByExamId
    │   └── service/ExamService.java                            # CustomException 전환 + 검증 보강 + roster/takerCount 응답
    │   └── service/ImageUploadService.java                     # CustomException 전환
    └── global/
        ├── exception/ErrorCode.java                            # FORBIDDEN, EXAM_*, MULTIPLE_CHOICE_*, 파일 검증 코드
        └── util/QrCodeUtil.java                                # 삭제

frontend/
├── package.json                                                # qrcode.react 제거
└── src/
    ├── api/exam.js                                             # 신규
    └── pages/
        ├── Dashboard.jsx                                       # mock 제거 + 실 호출 + 컬럼 보강
        ├── ExamCreate.jsx                                      # 명단/정답 UI + 실 호출 + 이미지 업로드
        └── ExamDetail.jsx                                      # mock+QR 제거, 명단/문항/감독관링크/응시자 표시

docs/
└── sprint1-exam-fixes.md                                       # 이 문서
```

---

## 6. 후속 변경 (2026-05-08) — 시험 개설 흐름 2페이지 분리

### 배경
이번 라운드 직전까지 시험 개설은 **단일 페이지**에서 시험 정보 + 문항 + 명단을 한 번에 입력하는 구조였음. 그러나 팀이 디자인한 사용자 시나리오(아래 발췌)는 **2단계 분리** 흐름을 명시:

> 7. 문항을 N개 등록한 후 '응시자 명단 등록' 버튼을 클릭한다.
> 8. 응시자 명단 등록 페이지로 이동한다.
> 1. 응시자 명단 등록 페이지 상단에서 '개별 추가' 또는 '일괄 추가' 탭 중 하나를 선택한다.
> 2. '개별 추가' 탭 선택 시: 학번/이름 입력 후 '추가' 버튼.
> 3. '일괄 추가' 탭 선택 시: 텍스트 붙여넣고 '명단 추출' 버튼.
> 4. '등록 예정자 미리보기 목록'에서 최종 확인 (개별 삭제 가능).
> 5. '시험 개설 완료' 버튼 → 시험 상세 페이지로 이동.

또한 단일 페이지에서 일괄 입력이 `<details>` 토글 뒤에 숨어 있어 **사용자가 발견 자체를 못 함**(액션 버튼 "명단 교체"도 명세상 "명단 추출"과 다름). UX 디버깅을 시작점으로 시나리오 일치까지 정리.

### 구조 변경

| 라우트 | 책임 |
|---|---|
| `/exam/create` | 시험 정보(시험명/시간) + 문항 입력만. 하단 버튼 "응시자 명단 등록 →"로 다음 단계로 navigate. |
| `/exam/create/roster` (신규) | 탭 UI(개별/일괄) + 등록 예정자 미리보기 + "시험 개설 완료" 버튼. 실제 `POST /api/v1/exams` + 이미지 업로드 호출은 여기서. |

### 상태 전달 — `navigate state` 선택 사유

이전 페이지에서 입력한 시험 정보·문항(이미지 File 포함)을 다음 페이지로 넘기는 방법은 보통 세 가지:

1. **navigate state (`location.state`)** — React Router가 in-memory로 보관. 새로고침 시 유실.
2. **sessionStorage** — 새로고침에도 살아남지만 `File` 객체는 직렬화 불가.
3. **전역 store (Zustand 등)** — Sprint 1 기준 도입 미정.

**선택: 1번 (navigate state)**. 이유:
- `File` 객체를 어차피 sessionStorage에 못 담음 → 이미지 첨부 시 결국 navigate state가 필요.
- 새로고침 케이스는 가드(아래)로 명확히 처리하면 됨.
- Zustand 도입은 본 변경 범위를 벗어남.

### 새로고침 / 직접 진입 가드

`RosterRegister`에서 `location.state.examMeta` 또는 `questions`가 없으면 안내 박스 표시 후 1.5초 뒤 `/exam/create`로 `replace` navigate.
- 사용자에게 "데이터가 사라진 이유"를 잠시 보여주고 자동 복귀 → 빈 화면이 깜빡이며 사라지는 것보다 덜 혼란스러움.
- `replace: true`로 history에 가드 페이지가 남지 않게 처리 → 뒤로가기로 다시 진입 못 함.

> 추후 sessionStorage에 메타+문항(이미지 제외)만 백업하고 새로고침 시 "이미지만 다시 첨부해주세요" 흐름을 추가할 수 있음. 지금은 단순 가드로만.

### 일괄 추가 파서 — 관대한 구분자

기존 `<details>` 안 textarea는 콤마/탭만 인식. 사용자가 엑셀에서 복붙할 때 공백/다중공백 혼재가 흔해서 파서를 다음으로 변경:

```js
line.split(/[,\t]|\s{2,}|\s+/).filter(Boolean)
```

- 콤마, 탭, 다중 공백, 단일 공백 모두 구분자로 인식.
- 첫 토큰을 학번, 나머지를 합쳐 이름으로 취급 → "홍 길동" 같은 공백 포함 이름도 수용.
- 학번/이름 둘 다 비면 그 row 전체 무시.

### 중복 학번 제거

명세상 명단의 학번은 시험 내 unique (`exam_roster.unique(exam_id, student_number)`). 명단 등록 단계에서 미리 차단:
- 개별 추가 시 기존 명단에 같은 학번 있으면 inline 에러.
- 일괄 추출 시 중복은 자동 제외하고 "N명 추가 · M명 중복 제외" 피드백.

### "시험 개설 완료" 버튼 비활성화 규칙

`roster.length === 0` 또는 `isSubmitting === true`일 때 버튼 비활성화 + opacity 0.5. 명세 4번 "최종 확인" 단계의 시각적 피드백 강화.

### 변경된 파일 (이번 라운드)

```
frontend/src/
├── App.jsx                                                     # /exam/create/roster 라우트 추가
├── pages/ExamCreate.jsx                                        # 명단 섹션 제거, 버튼명 "응시자 명단 등록 →"
└── pages/RosterRegister.jsx                                    # 신규 (탭 + 미리보기 + 가드)
```

### UX 효과
- 일괄 입력 textarea가 페이지 메인 영역으로 올라옴 → "어디서 붙여넣지?" 사라짐.
- 액션 버튼명을 시나리오와 정확히 맞춤(`명단 추출`, `시험 개설 완료`).
- 미리보기 목록이 separate section이라 추가/삭제 UX 명확.
- step indicator(`1 → 2`)로 어디 단계인지 항상 보임.

---

