# 답안 재생 프론트 분업 계약 (백로그 15)

작성일: 2026-05-16
범위: 백로그 15 답안 재생 페이지 프론트 작업
관련 문서: [API_SPEC.md](./API_SPEC.md), [sprint3-realtime-spec.md](./sprint3-realtime-spec.md)

---

## 1. 분업

| 담당 | 파일 | 책임 |
|---|---|---|
| 프론트 담당 | `pages/Replay.jsx` | 페이지 컴포넌트. 데이터 fetch, 레이아웃, 로딩/에러 처리 |
| 프론트 담당 | `App.jsx` | `/exam/:examId/sessions/:sessionId/replay` 라우트 추가 (PrivateRoute) |
| 프론트 담당 | `pages/ExamDetail.jsx` | 학생 행에 '재생' 버튼 추가 (SUBMITTED 세션에만 노출) |
| 프론트 담당 | `api/exam.js` | `getReplay(examId, sessionId)` 함수 추가 |
| 13/14/15 백엔드(=계약 작성자) | `hooks/useReplayEngine.js` | 재생 엔진 훅 |
| 13/14/15 백엔드 | `components/TimelineBar.jsx` | 타임라인 바 시각화 |
| 13/14/15 백엔드 | `components/SubjectiveAnswerView.jsx` | 주관식 답안 누적 표시 |
| 13/14/15 백엔드 | `components/MultipleChoiceLog.jsx` | 객관식 선택 변경 이력 표시 |

---

## 2. API

```
GET /api/v1/exams/{examId}/sessions/{sessionId}/replay
Authorization: Bearer <jwt>
```

응답 스키마는 [API_SPEC.md](./API_SPEC.md) Sprint 3 섹션 참조.

페이지 진입 시 한 번 호출하여 `ReplayResponse`를 받고, 그대로 `useReplayEngine` props에 전달.

---

## 3. `useReplayEngine` 훅 시그니처

```javascript
const {
  // 현재 재생 상태
  currentT,          // number (ms) — startedAt 기준 현재 위치
  isPlaying,         // boolean
  speed,             // 1 | 2 | 5 | 10

  // 컨트롤 함수
  play,              // () => void
  pause,             // () => void
  setSpeed,          // (1 | 2 | 5 | 10) => void
  seekTo,            // (t: number) => void  — ms 기준 임의 시점 점프

  // 현재 시점 파생 상태 (questionId에 해당하는 것만)
  currentAnswerText,         // string | null — 주관식 현재 누적된 텍스트
  currentSelectedChoiceIds,  // number[] | null — 객관식 현재 선택 (id 배열)
  choiceChangeHistory,       // Array<{t: number, from: number[], to: number[]}>
                             //   currentT까지 발생한 객관식 변경 이력. 최신순.

  // 타임라인 바에 그릴 메타 (questionId 무관, 전체 시험 기준)
  visibilityGaps,            // Array<{startT: number, durationMs: number}>
                             //   이탈 구간들. RESTORED.duration_ms 기반.
  suspiciousMarkers,         // Array<{t: number}>
                             //   SUSPICIOUS_CHOICE_CHANGE 발생 위치.

  // 시험 전체 길이
  totalDurationMs,           // number — submittedAt - startedAt
} = useReplayEngine({
  timeline,    // ReplayResponse.timeline (그대로 전달)
  snapshots,   // ReplayResponse.snapshots (그대로 전달)
  questionId,  // number — 현재 보는 문항
  startedAt,   // string (ISO 8601) — ReplayResponse.startedAt
  submittedAt, // string (ISO 8601) — ReplayResponse.submittedAt
});
```

### 동작 규칙

- `play()` 호출 시 `currentT`가 `speed` 배율로 증가 (1x = 실제 시간, 10x = 10배 빠름).
- `currentT`가 `totalDurationMs`에 도달하면 자동으로 `pause()` 호출.
- `seekTo(t)` 호출 시:
  1. `t` 이전의 가장 가까운 `snapshot` (같은 questionId)을 초기 상태로 복원
  2. 그 snapshot의 `t`부터 `t`까지의 timeline 이벤트를 즉시 적용 (forward 재생)
  3. `currentT = t`로 설정
- `questionId` 변경 시 `currentAnswerText`/`currentSelectedChoiceIds`는 그 문항 기준으로 재계산.
- `currentT` 변경에 따라 위 파생 상태 자동 재계산.

### 이벤트 적용 매핑

| 이벤트 type | 적용 동작 |
|---|---|
| `KEYSTROKE` | `payload.action === 'insert'`면 `payload.key` 한 글자 append, `'delete'`면 마지막 글자 제거 |
| `PASTE` | `payload.preview` 또는 `payload.fullText` (있으면) 일괄 append |
| `CHOICE_CHANGE` | `currentSelectedChoiceIds = payload.to`, `choiceChangeHistory`에 `{t, from, to}` push |
| `QUESTION_NAVIGATE` | 같은 questionId 안에서의 누적 상태에 영향 없음 (필터링은 questionId prop으로 처리) |
| `VISIBILITY_LOST` / `VISIBILITY_RESTORED` | 답안 상태에 영향 없음. `visibilityGaps`로만 노출. |
| `FULLSCREEN_EXIT` / `FULLSCREEN_ENTER` | 답안 상태에 영향 없음. (시각화는 백로그 21에서 결정될 수도) |
| `CAPTURE_SHORTCUT`, `WINDOW_BLUR` | 답안 상태에 영향 없음. |
| `SUSPICIOUS_CHOICE_CHANGE` | `currentSelectedChoiceIds`에는 영향 없음 (원본 CHOICE_CHANGE가 처리). `suspiciousMarkers`에만 추가. |

---

## 4. `TimelineBar` 컴포넌트 props

```jsx
<TimelineBar
  duration={totalDurationMs}    // number (ms)
  currentT={currentT}            // number (ms)
  visibilityGaps={visibilityGaps}      // Array<{startT, durationMs}>
  suspiciousMarkers={suspiciousMarkers} // Array<{t}>
  onSeek={(t) => seekTo(t)}      // (t: number) => void — 사용자 클릭 시 호출
/>
```

표현:
- 전체 가로 바 = `0 ~ duration`
- 현재 위치 = `currentT` 마커 (예: 세로 선)
- `visibilityGaps` = 빨간 막대 (`startT`에서 `durationMs`만큼 너비)
- `suspiciousMarkers` = 빨간 점/별표 (해당 `t` 위치)
- 바 클릭 시 클릭한 x좌표를 ms로 변환해서 `onSeek(t)` 호출

---

## 5. `SubjectiveAnswerView` 컴포넌트 props

```jsx
<SubjectiveAnswerView text={currentAnswerText} />
```

`text`를 `<pre>` 또는 textarea 비활성으로 표시. 텍스트가 변하면 자연스럽게 깜빡임 없이 업데이트. (CSS transition 없이도 React 리렌더로 OK.)

## 6. `MultipleChoiceLog` 컴포넌트 props

```jsx
<MultipleChoiceLog
  history={choiceChangeHistory}   // Array<{t, from, to}>
  choices={questions.find(q => q.id === questionId).choices}  // 페이지가 questions에서 추출해서 넘김
/>
```

표현 (최신 → 과거 순):
```
00:23  [1번] → [1번, 3번]
00:45  [1번, 3번] → [2번]
```

`choices`로 id를 "N번"으로 변환. 시간 포맷은 `t`(ms)를 `mm:ss`로 변환.

---

## 7. `Replay.jsx` 페이지 구조 (프론트 담당 참고)

```jsx
function Replay() {
  const { examId, sessionId } = useParams();
  const [data, setData] = useState(null);
  const [questionId, setQuestionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getReplay(examId, sessionId)
      .then(res => {
        setData(res.data);
        setQuestionId(res.data.questions[0]?.id ?? null);
        setLoading(false);
      })
      .catch(err => { setError(err); setLoading(false); });
  }, [examId, sessionId]);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>에러: {error.message}</div>;
  if (!data) return null;

  const {
    currentT, isPlaying, speed,
    play, pause, setSpeed, seekTo,
    currentAnswerText, currentSelectedChoiceIds, choiceChangeHistory,
    visibilityGaps, suspiciousMarkers, totalDurationMs,
  } = useReplayEngine({
    timeline: data.timeline,
    snapshots: data.snapshots,
    questionId,
    startedAt: data.startedAt,
    submittedAt: data.submittedAt,
  });

  const currentQuestion = data.questions.find(q => q.id === questionId);

  return (
    <div>
      <h1>{data.examTitle} — {data.studentName}</h1>

      <select value={questionId} onChange={e => setQuestionId(Number(e.target.value))}>
        {data.questions.map(q => (
          <option key={q.id} value={q.id}>
            {q.displayOrder}. {q.body.slice(0, 30)}
          </option>
        ))}
      </select>

      {currentQuestion.questionType === 'SUBJECTIVE'
        ? <SubjectiveAnswerView text={currentAnswerText} />
        : <MultipleChoiceLog history={choiceChangeHistory} choices={currentQuestion.choices} />}

      <TimelineBar
        duration={totalDurationMs}
        currentT={currentT}
        visibilityGaps={visibilityGaps}
        suspiciousMarkers={suspiciousMarkers}
        onSeek={seekTo}
      />

      <div>
        <button onClick={isPlaying ? pause : play}>{isPlaying ? '⏸' : '▶'}</button>
        {[1, 2, 5, 10].map(s => (
          <button key={s} onClick={() => setSpeed(s)} disabled={speed === s}>
            {s}x
          </button>
        ))}
        <span>{Math.floor(currentT / 1000)}s / {Math.floor(totalDurationMs / 1000)}s</span>
      </div>
    </div>
  );
}
```

이 코드를 그대로 베이스로 시작 가능. CSS는 팀 컨벤션에 맞춰 추가.

---

## 8. Mock 엔진 (프론트 담당이 우리 실구현 도착 전까지 쓰는 stub)

`hooks/useReplayEngine.js`를 처음엔 다음 stub으로 만들어두고 페이지/컨트롤 UI 작업 진행:

```javascript
import { useState, useEffect, useRef } from 'react';

export function useReplayEngine({ timeline, snapshots, questionId, startedAt, submittedAt }) {
  const [currentT, setCurrentT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const totalDurationMs = new Date(submittedAt) - new Date(startedAt);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentT(t => {
        const next = t + 100 * speed;
        if (next >= totalDurationMs) {
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, speed, totalDurationMs]);

  return {
    currentT, isPlaying, speed,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    setSpeed,
    seekTo: setCurrentT,
    currentAnswerText: '(mock — 실구현 대기 중)',
    currentSelectedChoiceIds: [],
    choiceChangeHistory: [],
    visibilityGaps: [],
    suspiciousMarkers: [],
    totalDurationMs,
  };
}
```

이걸로 페이지/컨트롤 동작 확인 가능. 실구현이 들어오면 같은 파일 통째로 교체.

---

## 9. 합의 사항

- 새 npm 패키지 추가 없음. 기존 React 표준 훅만 사용.
- 타임라인 바는 HTML/CSS div + 절대 위치로 충분. Canvas 안 씀.
- 폰트/색상은 기존 프로젝트 스타일 따라감. 빨간색은 `#e53935` (`ExamSession.jsx` 이탈 오버레이와 일관).
- API 호출 실패 시 에러 코드별 한국어 메시지는 페이지에서 분기 처리 (`FORBIDDEN`, `SESSION_NOT_SUBMITTED`, `SESSION_NOT_FOUND`).

---

## 10. 작업 순서

1. 본 계약 합의 (셋이 30분)
2. 프론트 담당:
   - `Replay.jsx` + 라우트 + `ExamDetail.jsx` 버튼
   - `api/exam.js` `getReplay` 추가
   - Mock `useReplayEngine` 작성하여 페이지 동작 확인
   - 스타일 + 컨트롤 UI 마무리
3. 우리 (병렬):
   - `useReplayEngine` 실구현
   - `TimelineBar`, `SubjectiveAnswerView`, `MultipleChoiceLog` 컴포넌트
4. 머지:
   - 프론트 담당이 mock 파일을 우리 실구현으로 교체
   - 합쳐서 동작 확인
