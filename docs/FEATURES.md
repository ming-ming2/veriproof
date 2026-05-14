# Features

VeriProof Sprint 1~3 합의된 기능 명세.

## 1. 인증

### 1.1 교수 회원가입
- `username`, `password`, `name`, `affiliation` 입력
- `username`은 영문/숫자 4~50자, 중복 불가
- `password`는 8자 이상, BCrypt 해시 저장

### 1.2 교수 로그인
- `username` + `password`
- 성공 시 JWT 토큰 발급
- 토큰 저장 위치: 팀 합의 필요

## 2. 시험 관리 (교수)

### 2.1 시험 목록 조회
- 로그인한 교수 본인의 시험만 조회
- 최신 순 정렬
- 표시 정보: 시험명, 시험 코드, 시작/종료 시각, 명단 인원, 응시자 수

### 2.2 시험 개설
시험 정보, 문항, 응시 명단을 한 번에 등록.

**시험 정보**
- 시험명 (1~200자)
- 시작/종료 시각 (`startsAt < endsAt`)
- 시스템이 자동 발급: 6자리 시험 코드, 감독관 토큰(UUID), QR

**문항**
- 최소 1개 이상
- 유형: 주관식 / 객관식
- 본문, 배점, 표시 순서
- 이미지 첨부 가능 (PNG/JPEG/GIF/WEBP, 5MB 이하)
- 주관식: `correctAnswer` (선택, 교수 채점 참조용)
- 객관식: 선택지 2개 이상, 정답 선택지 1개 이상 (다중 정답 허용)

**응시 명단**
- **최소 1명 이상 필수**
- 학번 + 이름

### 2.3 시험 상세 조회
- 시험 정보 + 문항 + 명단 + 응시 학생 목록 + 채점 결과
- 교수는 정답 데이터(`correctAnswer`, `isCorrect`) 조회 가능

### 2.4 명단 관리
시험 개설 후 명단 변경:
- 단건 추가 / 단건 삭제 / 일괄 교체
- 응시 시작(`IN_PROGRESS`)한 학생이 있으면 변경 거부

## 3. 학생 응시

### 3.1 응시 시작
1. 시험 코드 입력 (6자리)
2. 학번 + 이름 입력
3. 명단 검증: `(exam_id, student_number)` 매칭 + 이름 정확 일치 (공백 포함)
4. 검증 통과 시 `sessionUuid` 발급, 응시 화면 진입

검증 실패 케이스:
- 시험 코드 없음 / 시작 전 / 종료 후
- 명단에 없거나 이름 불일치
- 같은 학번이 다른 기기에서 응시 중

### 3.2 응시 화면
- 전체 화면 모드 진입 (브라우저 fullscreen API)
- 문항 목록 표시 (정답 데이터 미포함)
- 주관식: 텍스트 입력
- 객관식: 다중 선택 가능 (체크박스)
- 문항 간 이동 가능
- 답안은 클라이언트 메모리에만 보관 (Sprint 1 기준, 자동 저장은 Sprint 5)

### 3.3 답안 제출
- 모든 문항 답안 일괄 전송
- 빈 답안은 제외하여 전송
- 각 답안: `answerText` 또는 `selectedChoiceIds` 중 하나만
- 제출 후 세션 상태: `SUBMITTED`

## 4. 채점

### 4.1 객관식 자동 채점
제출 즉시 서버에서 자동 채점.

**규칙 (엄격)**
- 정답 집합과 학생 선택 집합이 **완전히 일치**해야 만점
- 부분 점수 없음
- 정답 일부만 선택, 정답 + 오답 혼합 모두 0점

| 정답 | 학생 선택 | 결과 |
|---|---|---|
| {1, 3} | {1, 3} | 만점 |
| {1, 3} | {1} | 0점 |
| {1, 3} | {1, 2, 3} | 0점 |

### 4.2 주관식 수동 채점
- 자동 채점 안 함
- 시험 종료 후 교수가 답안별로 점수 입력
- `0 ≤ earnedScore ≤ question.points`
- 부분 점수 가능

### 4.3 총점
- `total_score` = 모든 문항의 `earned_score` 합
- 객관식 자동 채점 시 / 주관식 수동 채점 시 자동 재계산

## 5. 실시간 이벤트 수집 (Sprint 3, 백로그 13·14)

상세 설계: [sprint3-realtime-spec.md](./sprint3-realtime-spec.md).

### 5.1 즉시 이벤트 (백로그 13)

학생이 응시 중 발생 즉시 서버로 전송. `POST /api/v1/student/sessions/me/events`.

| 이벤트 | 의미 | 페어링 | 점수 |
|---|---|---|---|
| `PASTE` | 붙여넣기 (length + 50자 preview 포함) | — | +1 |
| `VISIBILITY_LOST` / `VISIBILITY_RESTORED` | alt-tab, 최소화, 창 전환 (시작/복귀) | 서버 페어링 → RESTORED row에 `duration_ms` 기록 | +1 (페어당 RESTORED 시점) |
| `FULLSCREEN_EXIT` / `FULLSCREEN_ENTER` | 전체화면 해제/재진입 | 서버 페어링 | +1 (페어당 ENTER 시점) |
| `CAPTURE_SHORTCUT` | PrtScn, Cmd+Shift+3/4 등 | — | +1 |
| `WINDOW_BLUR` | 창 포커스 상실 (alt-tab 보완) | — | +1 |

서버는 INSERT 후 즉시 감독관 SSE에 broadcast.

### 5.2 배치 이벤트 + 답안 스냅샷 (백로그 14)

60초 간격으로 누적 후 일괄 전송. 제출 직전 잔여분 함께 flush. `POST /api/v1/student/sessions/me/events/batch`.

**이벤트** (점수 영향 없음, 재생 자료):
- `KEYSTROKE` — 키 입력 (key + insert/delete)
- `CHOICE_CHANGE` — 객관식 선택 변경 (from/to choice id 목록)
- `QUESTION_NAVIGATE` — 문항 간 이동

**답안 스냅샷**: 60초 시점 답안 상태를 `answer_snapshot` 테이블에 append. 시간순 누적이므로 사후 재생에서 임의 시점 복원 가능.

### 5.3 서버 파생 이벤트

| 이벤트 | 발생 조건 | 점수 |
|---|---|---|
| `SUSPICIOUS_CHOICE_CHANGE` | `VISIBILITY_RESTORED`/`FULLSCREEN_ENTER` 도착 후 **5초 이내** `CHOICE_CHANGE` 수신 | +1 |

백로그 21 사후 리포트 통계의 "화면 이탈 직후 답 변경 N건"은 `event_type='SUSPICIOUS_CHOICE_CHANGE'` COUNT로 즉시 산출.

### 5.4 주목도 점수

- **모든 의심 시그널 균등 +1점.** ML 학습 없는 학부 스코프에서 가중치 임의 설정에 대한 정당성 부족 + 발표/시연 시 "누적 시그널 수 = 점수"라는 단순 명확한 기준.
- 시간 감쇠 없음.
- Redis ZSET `exam:{examId}:attention`에 누적. 감독관 카드는 `ZREVRANGE`로 정렬 조회.

### 5.5 주목도 레벨 임계점

| 레벨 | 임계 점수 | UI |
|---|---|---|
| `HIGH` (강조) | ≥ 4 | 빨강 |
| `MID` (주의) | ≥ 2 | 주황 |
| `LOW` (보통) | ≥ 1 | 노랑 |
| `NORMAL` (평범) | 0 | 기본 |

## 6. 답안 재생 (Sprint 3, 백로그 15)

종료된(SUBMITTED) 시험의 학생 답안을 시간순으로 재생.

- 진입: 시험 상세 페이지의 학생 행 '재생' 버튼
- 권한: 본인이 개설한 시험만 (`FORBIDDEN`)
- 데이터 소스: `event_log` (timeline) + `answer_snapshot` (임의 시점 점프용 초기 상태)
- 응답: `GET /api/v1/exams/{examId}/sessions/{sessionId}/replay` 한 번에 일괄 반환 (`t` = `startedAt` 기준 상대 ms)

### 6.1 재생 표현

| 표현 | 데이터 근거 |
|---|---|
| 한 글자씩 채워지는 주관식 답안 | `KEYSTROKE` 이벤트 순차 적용 |
| 한 번에 표시되는 붙여넣기 | `PASTE` 이벤트 (length만큼 일괄 삽입) |
| 객관식 선택 변경 이력 | `CHOICE_CHANGE` 이벤트 시간순 표시 |
| 회색 빈 구간 (다른 문항 이동) | `QUESTION_NAVIGATE` 사이 갭 |
| 빨간 막대 + 지속 시간 (이탈) | `VISIBILITY_RESTORED.duration_ms` |
| 빨간 강조 (이탈 직후 답 변경) | `SUSPICIOUS_CHOICE_CHANGE` row 존재 시 |

### 6.2 재생 컨트롤

- 배속: 1x, 2x, 5x, 10x
- 타임라인 바 클릭 → 임의 시점 점프 (가장 가까운 `answer_snapshot`을 초기 상태로 두고 forward 재생)
- 문항 선택 드롭다운으로 문항 단위 점프

## 7. 감독관 대시보드 (Sprint 3, 백로그 16·17·18)

### 7.1 인증

- URL path의 `proctorToken` UUID (`exam.proctor_token`과 직접 매칭)
- 별도 헤더/로그인 없음 — 교수가 '감독관 링크 복사'로 배포한 링크 그대로 사용
- SSE EventSource가 커스텀 헤더를 지원하지 않아 path 매칭 채택

### 7.2 대시보드 메타 (백로그 16)

- 시험명, 시작/종료 시각, 명단 인원, 응시 중 인원
- 응시 중 학생 카드 목록 (학번·이름·현재 진행 문항·마지막 활동 시각)

### 7.3 주목도 정렬 + 학생 상세 (백로그 17)

- 카드는 주목도 점수 내림차순 기본 정렬 (`?sort=studentNumber`로 학번순 토글)
- 점수 레벨에 따라 카드 색상 (5.5 임계)
- **1초 이내 갱신**: 학생 이벤트 발생 → 서버 INSERT/점수 갱신 → SSE `attention-update` push → 프론트 카드 색상·위치 즉시 갱신
- 카드 클릭 시 우측 상세 패널: 시그널별 누적 카운트(Redis `signals` Hash), 평균 이탈 지속 시간(`AVG(duration_ms)`), 최근 이벤트 20건, 현재 작성 중 답안 미리보기(Redis `draft`)

### 7.4 이벤트 피드 (백로그 18)

- 시험 전체 이벤트 시간 역순 표시
- 표시 항목: 학번, 이벤트 종류, 발생 문항, 발생 시각
- `VISIBILITY_LOST` / `RESTORED`는 RESTORED row(페어링 완료, `duration_ms` 보유)만 한 줄로 표시
- 실시간 prepend: SSE `student-event` 수신 시 피드 상단 추가
- 폴백 GET: 초기 적재 + SSE 재연결 시 갭 보충용 `GET /proctor/exams/{token}/events?since=...`

### 7.5 실시간 채널 (SSE)

`GET /proctor/exams/{proctorToken}/stream`. 서버 → 감독관 단방향 push.

| 이벤트 | 트리거 | 용도 |
|---|---|---|
| `student-event` | 학생 이벤트 INSERT | 피드 prepend |
| `attention-update` | ZINCRBY 직후 | 카드 색상/위치 갱신 |
| `session-status` | `IN_PROGRESS` → `SUBMITTED` 등 상태 전이 | 카드 비활성화/제거 |
| `heartbeat` | 30초 주기 | 연결 유지 |

다중 인스턴스 가정 없이 인메모리 `Map<examId, List<SseEmitter>>`로 팬아웃. `EventBroadcaster` 인터페이스로 추상화하여 추후 Redis Pub/Sub로 교체 가능.

## 8. 데이터 보존

- 모든 시간은 UTC `TIMESTAMPTZ`
- 비밀번호는 BCrypt 해시
- 이미지 파일은 파일 시스템, DB는 메타데이터만
- 시험 / 문항 / 응시 / 답안 / 이벤트 / 스냅샷 삭제 시 CASCADE
- Redis 키는 시험 종료 후 자연 만료 (lock·draft 10분, 주목도·감독관 메타 1시간)
