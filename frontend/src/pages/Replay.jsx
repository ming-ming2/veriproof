import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReplay } from "../api/exam";

const TICK_MS = 50; // 재생 루프 간격

const formatClock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const formatAbs = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

// 타임라인 + 스냅샷에서 총 길이(ms) 계산. submittedAt 이 있으면 그쪽도 후보.
const computeDuration = (data) => {
  let maxT = 0;
  (data.timeline || []).forEach((e) => {
    if (typeof e.t === "number" && e.t > maxT) maxT = e.t;
    // durationMs는 TimelineItem의 별도 필드 (e.payload가 아님)
    if (typeof e.durationMs === "number") {
      maxT = Math.max(maxT, e.t + e.durationMs);
    }
  });
  (data.snapshots || []).forEach((s) => {
    if (typeof s.t === "number" && s.t > maxT) maxT = s.t;
  });
  if (data.startedAt && data.submittedAt) {
    const diff = new Date(data.submittedAt) - new Date(data.startedAt);
    if (diff > maxT) maxT = diff;
  }
  // 최소 10초 보장 (시각화)
  return Math.max(maxT, 10000);
};

// 선택된 문항에 사용자가 머문 시간 구간들을 계산. [{from, to}, ...]
const computeActiveRanges = (timeline, totalDuration, selectedQid, fallbackQid) => {
  const navs = timeline
    .filter((e) => e.type === "QUESTION_NAVIGATE")
    .slice()
    .sort((a, b) => a.t - b.t);

  if (navs.length === 0) {
    return fallbackQid === selectedQid ? [{ from: 0, to: totalDuration }] : [];
  }

  // t=0부터 첫 nav 전까지는 첫 nav의 fromQuestionId(= 사용자가 시작한 문항)에 매핑되어야 한다.
  // fromQuestionId가 없으면 fallbackQid(첫 문항)로 본다.
  let currentQid = navs[0].payload?.fromQuestionId ?? fallbackQid;
  let currentStart = 0;

  const ranges = [];
  for (const e of navs) {
    if (currentQid === selectedQid) {
      ranges.push({ from: currentStart, to: e.t });
    }
    currentQid = e.payload?.toQuestionId ?? e.questionId;
    currentStart = e.t;
  }
  // 마지막 nav 이후 ~ 종료
  if (currentQid === selectedQid) {
    ranges.push({ from: currentStart, to: totalDuration });
  }
  return ranges;
};

// VISIBILITY_LOST/RESTORED와 FULLSCREEN_EXIT/ENTER 페어를 모두 [{from, to, durationMs, kind}, ...] 로
// 두 종류는 독립 스택으로 관리한다 (서로 페어링되지 않음).
const computeAwayRanges = (timeline, totalDuration) => {
  const stacks = { VISIBILITY: [], FULLSCREEN: [] };
  const out = [];
  const sorted = timeline.slice().sort((a, b) => a.t - b.t);
  for (const e of sorted) {
    if (e.type === "VISIBILITY_LOST") {
      stacks.VISIBILITY.push(e);
    } else if (e.type === "VISIBILITY_RESTORED") {
      const start = stacks.VISIBILITY.shift();
      if (start) {
        const dur = e.durationMs ?? e.t - start.t;
        out.push({ from: start.t, to: start.t + dur, durationMs: dur, kind: "visibility" });
      }
    } else if (e.type === "FULLSCREEN_EXIT") {
      stacks.FULLSCREEN.push(e);
    } else if (e.type === "FULLSCREEN_ENTER") {
      const start = stacks.FULLSCREEN.shift();
      if (start) {
        const dur = e.durationMs ?? e.t - start.t;
        out.push({ from: start.t, to: start.t + dur, durationMs: dur, kind: "fullscreen" });
      }
    }
  }
  // 페어링 누락 → 끝까지 이탈 상태로 본다
  stacks.VISIBILITY.forEach((s) =>
    out.push({ from: s.t, to: totalDuration, durationMs: totalDuration - s.t, kind: "visibility", unpaired: true })
  );
  stacks.FULLSCREEN.forEach((s) =>
    out.push({ from: s.t, to: totalDuration, durationMs: totalDuration - s.t, kind: "fullscreen", unpaired: true })
  );
  return out;
};

// 순간 이벤트들 (점/세로선으로 표시) — 부정행위 의심 시그널 일체
const INSTANT_MARKER_TYPES = {
  WINDOW_BLUR: { color: "#f57c00", label: "창 포커스 손실" },
  PASTE: { color: "#c62828", label: "붙여넣기" },
  CAPTURE_SHORTCUT: { color: "#c62828", label: "화면 캡처" },
  SUSPICIOUS_CHOICE_CHANGE: { color: "#7b1fa2", label: "의심 선택지 변경" },
};

const computeInstantMarkers = (timeline) =>
  timeline
    .filter((e) => INSTANT_MARKER_TYPES[e.type])
    .map((e) => ({ t: e.t, type: e.type, ...INSTANT_MARKER_TYPES[e.type] }));

// 같은 t (±50ms) 에 SUSPICIOUS_CHOICE_CHANGE 가 있으면 의심으로 마킹
const isSuspicious = (timeline, choiceChangeEvent) => {
  return timeline.some(
    (e) =>
      e.type === "SUSPICIOUS_CHOICE_CHANGE" &&
      e.questionId === choiceChangeEvent.questionId &&
      Math.abs(e.t - choiceChangeEvent.t) <= 50
  );
};

// 주관식: currentTime 기준의 텍스트 세그먼트 ({text, paste:boolean}[])
const reconstructText = (events, currentTime) => {
  const segments = []; // [{text, paste}]
  const pushChar = (ch) => {
    const last = segments[segments.length - 1];
    if (last && !last.paste) last.text += ch;
    else segments.push({ text: ch, paste: false });
  };
  const popChar = () => {
    const last = segments[segments.length - 1];
    if (!last) return;
    if (last.paste) {
      // paste 블록은 한 번에 삭제되지 않으므로, 한 글자만 제거
      last.text = last.text.slice(0, -1);
      if (!last.text) segments.pop();
    } else {
      last.text = last.text.slice(0, -1);
      if (!last.text) segments.pop();
    }
  };
  events
    .filter((e) => e.t <= currentTime)
    .forEach((e) => {
      if (e.type === "KEYSTROKE") {
        const key = e.payload?.key ?? "";
        const action = e.payload?.action ?? "insert";
        if (action === "insert") pushChar(key);
        else if (action === "delete") popChar();
      } else if (e.type === "PASTE") {
        // paste 시점에 선택 영역이 있었다면 그 길이만큼 먼저 popChar (덮어쓰기 재현)
        const selectedLength = e.payload?.selectedLength ?? 0;
        for (let i = 0; i < selectedLength; i++) popChar();
        const preview = e.payload?.preview ?? "";
        segments.push({ text: preview, paste: true });
      }
    });
  return segments;
};

// 객관식: currentTime 시점까지 적용된 CHOICE_CHANGE 리스트 + 의심 플래그
const collectChoiceHistory = (events, allTimeline, currentTime) => {
  return events
    .filter((e) => e.type === "CHOICE_CHANGE" && e.t <= currentTime)
    .map((e) => ({
      t: e.t,
      from: e.payload?.from ?? [],
      to: e.payload?.to ?? [],
      suspicious: isSuspicious(allTimeline, e),
    }));
};

export default function Replay() {
  const navigate = useNavigate();
  const { examId, sessionId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedQid, setSelectedQid] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const lastTickRef = useRef(null);
  const rafRef = useRef(null);

  // 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getReplay(examId, sessionId);
        if (cancelled) return;
        setData(res.data);
        const firstQ = (res.data.questions || [])
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)[0];
        if (firstQ) setSelectedQid(firstQ.id);
      } catch (err) {
        if (cancelled) return;
        const code = err.response?.data?.error?.code;
        if (code === "SESSION_NOT_SUBMITTED") {
          setError("아직 제출되지 않은 응시는 재생할 수 없습니다.");
        } else {
          setError(
            err.response?.data?.error?.message ||
              "답안 재생 데이터를 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };

  }, [examId, sessionId]);


  const totalDuration = useMemo(
    () => (data ? computeDuration(data) : 0),
    [data]
  );

  const questions = useMemo(
    () =>
      (data?.questions || []).slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [data]
  );

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQid) || null,
    [questions, selectedQid]
  );

  const timeline = data?.timeline || [];

  // 현재 문항 한정 이벤트 (주관식/객관식 재생용)
  const questionEvents = useMemo(
    () => timeline.filter((e) => e.questionId === selectedQid),
    [timeline, selectedQid]
  );

  // 활성 구간 (현재 문항에 머문 시간)
  const activeRanges = useMemo(() => {
    if (!data || !selectedQid) return [];
    const first = questions[0]?.id;
    return computeActiveRanges(timeline, totalDuration, selectedQid, first);
  }, [data, selectedQid, timeline, totalDuration, questions]);

  // 이탈 구간 (VISIBILITY + FULLSCREEN 페어, 전 문항 공통)
  const awayRanges = useMemo(
    () => computeAwayRanges(timeline, totalDuration),
    [timeline, totalDuration]
  );

  // 순간 부정행위 마커 (WINDOW_BLUR / PASTE / CAPTURE_SHORTCUT / SUSPICIOUS_CHOICE_CHANGE)
  const instantMarkers = useMemo(() => computeInstantMarkers(timeline), [timeline]);

  // 재생 루프
  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const delta = lastTickRef.current ? now - lastTickRef.current : TICK_MS;
      lastTickRef.current = now;
      setCurrentTime((t) => {
        const next = t + delta * speed;
        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = setTimeout(tick, TICK_MS);
    };
    rafRef.current = setTimeout(tick, TICK_MS);
    return () => {
      cancelled = true;
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [playing, speed, totalDuration]);

  const handlePlayPause = () => {
    if (!playing && currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setPlaying((p) => !p);
  };

  const handleQuestionChange = (e) => {
    setSelectedQid(Number(e.target.value));
    setCurrentTime(0);
    setPlaying(false);
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.max(0, Math.min(1, ratio)) * totalDuration;
    setCurrentTime(next);
  };

  // 주관식/객관식 표시
  const subjectiveSegments = useMemo(() => {
    if (!selectedQuestion || selectedQuestion.questionType !== "SUBJECTIVE") {
      return [];
    }
    return reconstructText(questionEvents, currentTime);
  }, [selectedQuestion, questionEvents, currentTime]);

  const choiceHistory = useMemo(() => {
    if (!selectedQuestion || selectedQuestion.questionType !== "MULTIPLE_CHOICE") {
      return [];
    }
    return collectChoiceHistory(questionEvents, timeline, currentTime);
  }, [selectedQuestion, questionEvents, timeline, currentTime]);

  // 선택지 ID → 라벨 (1번, 2번 …)
  const choiceLabelMap = useMemo(() => {
    const map = new Map();
    questions.forEach((q) => {
      if (q.questionType !== "MULTIPLE_CHOICE") return;
      const sorted = (q.choices || [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder);
      sorted.forEach((c, idx) => {
        map.set(c.id, `${idx + 1}번`);
      });
    });
    return map;
  }, [questions]);

  const labelChoices = (ids) =>
    (ids || []).map((id) => choiceLabelMap.get(id) || `#${id}`).join(", ") ||
    "(선택 없음)";

  if (loading) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.loadingText}>불러오는 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.content}>
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{error || "재생 데이터를 찾을 수 없습니다."}</p>
            <button style={styles.backBtn} onClick={() => navigate(-1)}>
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <button style={styles.backBtn} onClick={() => navigate(`/exam/${examId}`)}>
          시험 상세로
        </button>
      </nav>

      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <div>
            <p style={styles.breadcrumb}>{data.examTitle}</p>
            <h1 style={styles.pageTitle}>답안 재생</h1>
          </div>
          <div style={styles.studentBadge}>
            <div style={styles.studentName}>{data.studentName}</div>
            <div style={styles.studentNumber}>{data.studentNumber}</div>
          </div>
        </div>

        <div style={styles.metaRow}>
          <div style={styles.metaCell}>
            <div style={styles.metaLabel}>응시 시각</div>
            <div style={styles.metaValue}>{formatAbs(data.startedAt)}</div>
          </div>
          <div style={styles.metaCell}>
            <div style={styles.metaLabel}>제출 시각</div>
            <div style={styles.metaValue}>{formatAbs(data.submittedAt)}</div>
          </div>
          <div style={styles.metaCell}>
            <div style={styles.metaLabel}>총 길이</div>
            <div style={styles.metaValue}>{formatClock(totalDuration)}</div>
          </div>
        </div>

        {/* 문항 선택 */}
        <div style={styles.sectionLabel}>문항 선택</div>
        <select
          style={styles.select}
          value={selectedQid ?? ""}
          onChange={handleQuestionChange}
        >
          {questions.map((q, idx) => (
            <option key={q.id} value={q.id}>
              {`문항 ${idx + 1} (${q.questionType === "MULTIPLE_CHOICE" ? "객관식" : "주관식"}) — ${q.points}점`}
            </option>
          ))}
        </select>

        {/* 문항 본문 */}
        {selectedQuestion && (
          <div style={styles.questionBody}>
            <div style={styles.questionBodyLabel}>문제</div>
            <div style={styles.questionBodyText}>{selectedQuestion.body}</div>
          </div>
        )}

        {/* 재생 영역 */}
        <div style={styles.sectionLabel}>재생</div>
        <div style={styles.replayBox}>
          {selectedQuestion?.questionType === "SUBJECTIVE" && (
            <div style={styles.subjectiveArea}>
              {subjectiveSegments.length === 0 ? (
                <span style={styles.placeholder}>아직 작성된 내용이 없습니다.</span>
              ) : (
                subjectiveSegments.map((seg, idx) => (
                  <span
                    key={idx}
                    style={seg.paste ? styles.pasteSegment : styles.typingSegment}
                    title={seg.paste ? "붙여넣기 구간" : ""}
                  >
                    {seg.text}
                  </span>
                ))
              )}
              <span style={styles.cursor}>|</span>
            </div>
          )}

          {selectedQuestion?.questionType === "MULTIPLE_CHOICE" && (
            <div style={styles.mcArea}>
              {choiceHistory.length === 0 ? (
                <span style={styles.placeholder}>아직 선택 변경이 없습니다.</span>
              ) : (
                <ol style={styles.mcList}>
                  {choiceHistory.map((h, idx) => (
                    <li
                      key={idx}
                      style={{
                        ...styles.mcItem,
                        ...(h.suspicious ? styles.mcItemSuspicious : {}),
                      }}
                    >
                      <span style={styles.mcTime}>[{formatClock(h.t)}]</span>
                      <span style={styles.mcChange}>
                        {labelChoices(h.from)} → {labelChoices(h.to)}
                      </span>
                      {h.suspicious && (
                        <span style={styles.suspiciousTag}>화면 이탈 직후 변경</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* 타임라인 */}
        <div style={styles.sectionLabel}>타임라인</div>
        <div style={styles.timelineWrap}>
          <div style={styles.timelineRail} onClick={handleTimelineClick}>
            {/* 회색 베이스 (전체 비활성) */}
            <div style={styles.timelineBase} />
            {/* 활성 구간 (이 문항에 머문 시간) */}
            {activeRanges.map((r, idx) => (
              <div
                key={`a-${idx}`}
                style={{
                  ...styles.timelineActive,
                  left: `${(r.from / totalDuration) * 100}%`,
                  width: `${((r.to - r.from) / totalDuration) * 100}%`,
                }}
              />
            ))}
            {/* 이탈 구간 (VISIBILITY: 빨강 / FULLSCREEN: 주황 + 지속시간) */}
            {awayRanges.map((r, idx) => {
              const widthPct = ((r.to - r.from) / totalDuration) * 100;
              const isVisibility = r.kind === "visibility";
              const label = isVisibility ? "화면 이탈" : "전체화면 해제";
              return (
                <div
                  key={`a-${idx}`}
                  style={{
                    ...styles.timelineVisibility,
                    background: isVisibility ? "#e24b4a" : "#ff9800",
                    left: `${(r.from / totalDuration) * 100}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`${label} ${(r.durationMs / 1000).toFixed(1)}초`}
                >
                  {widthPct > 5 && (
                    <span style={styles.timelineVisibilityLabel}>
                      {(r.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              );
            })}
            {/* 순간 부정행위 마커 (세로선) */}
            {instantMarkers.map((m, idx) => (
              <div
                key={`m-${idx}`}
                style={{
                  ...styles.timelineMarker,
                  background: m.color,
                  left: `${(m.t / totalDuration) * 100}%`,
                }}
                title={`${m.label} @ ${formatClock(m.t)}`}
              />
            ))}
            {/* 현재 위치 핸들 */}
            <div
              style={{
                ...styles.timelineHandle,
                left: `${(currentTime / totalDuration) * 100}%`,
              }}
            />
          </div>
          <div style={styles.timelineClocks}>
            <span>{formatClock(currentTime)}</span>
            <span style={styles.timelineLegend}>
              <span style={styles.legendDot("#dcdcdc")} /> 다른 문항
              <span style={styles.legendDot("#185FA5")} /> 이 문항
              <span style={styles.legendDot("#e24b4a")} /> 화면 이탈
              <span style={styles.legendDot("#ff9800")} /> 전체화면 해제
              <span style={styles.legendDot("#f57c00")} /> 포커스 손실
              <span style={styles.legendDot("#c62828")} /> 붙여넣기/캡처
              <span style={styles.legendDot("#7b1fa2")} /> 의심 변경
            </span>
            <span>{formatClock(totalDuration)}</span>
          </div>
        </div>

        {/* 컨트롤 */}
        <div style={styles.controls}>
          <button style={styles.playBtn} onClick={handlePlayPause}>
            {playing ? "❚❚ 일시정지" : "▶ 재생"}
          </button>
          <div style={styles.speedGroup}>
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                style={{
                  ...styles.speedBtn,
                  ...(speed === s ? styles.speedBtnActive : {}),
                }}
                onClick={() => setSpeed(s)}
              >
                {s}배
              </button>
            ))}
          </div>
          <button
            style={styles.resetBtn}
            onClick={() => {
              setCurrentTime(0);
              setPlaying(false);
            }}
          >
            처음으로
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f7f8",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    borderBottom: "1px solid #e5e5e5",
    background: "#fff",
  },
  navTitle: { fontSize: 16, fontWeight: 500 },

  content: { maxWidth: 880, margin: "0 auto", padding: "32px 20px" },
  loadingText: { fontSize: 14, color: "#999", textAlign: "center", padding: 60 },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 16,
  },
  breadcrumb: { fontSize: 13, color: "#888", margin: "0 0 2px" },
  pageTitle: { fontSize: 20, fontWeight: 500, margin: 0 },

  studentBadge: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "10px 16px",
    minWidth: 140,
    textAlign: "right",
  },
  studentName: { fontSize: 14, fontWeight: 500, color: "#222" },
  studentNumber: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },

  metaRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 20,
  },
  metaCell: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "12px 14px",
  },
  metaLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  metaValue: { fontSize: 13, color: "#333", fontWeight: 500 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 8,
    marginTop: 18,
  },
  select: {
    width: "100%",
    fontSize: 14,
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    color: "#222",
    cursor: "pointer",
  },

  questionBody: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "12px 14px",
    marginTop: 10,
  },
  questionBodyLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  questionBodyText: { fontSize: 13, color: "#333", whiteSpace: "pre-wrap" },

  replayBox: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "16px 18px",
    minHeight: 140,
  },
  subjectiveArea: {
    fontSize: 15,
    color: "#222",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  typingSegment: {
    color: "#222",
  },
  pasteSegment: {
    background: "#fff1f0",
    color: "#c0392b",
    padding: "0 2px",
    borderRadius: 3,
    fontWeight: 500,
  },
  cursor: {
    color: "#185FA5",
    fontWeight: 600,
    marginLeft: 1,
    animation: "blink 1s steps(2, start) infinite",
  },
  placeholder: { fontSize: 13, color: "#aaa" },

  mcArea: {},
  mcList: { listStyle: "none", padding: 0, margin: 0 },
  mcItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: 13,
    color: "#333",
  },
  mcItemSuspicious: {
    background: "#fff1f0",
    color: "#c0392b",
    fontWeight: 500,
  },
  mcTime: {
    fontFamily: '"SF Mono", "Fira Code", monospace',
    color: "#888",
    fontSize: 12,
    minWidth: 56,
  },
  mcChange: { flex: 1 },
  suspiciousTag: {
    fontSize: 11,
    background: "#e24b4a",
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 4,
  },

  timelineWrap: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "16px 18px",
  },
  timelineRail: {
    position: "relative",
    width: "100%",
    height: 28,
    background: "transparent",
    cursor: "pointer",
    borderRadius: 6,
    overflow: "hidden",
  },
  timelineBase: {
    position: "absolute",
    inset: 0,
    background: "#dcdcdc",
    borderRadius: 6,
  },
  timelineActive: {
    position: "absolute",
    top: 0,
    bottom: 0,
    background: "#185FA5",
    opacity: 0.85,
  },
  timelineVisibility: {
    position: "absolute",
    top: 0,
    bottom: 0,
    background: "#e24b4a",
    opacity: 0.95,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 11,
    fontWeight: 500,
  },
  timelineVisibilityLabel: {
    pointerEvents: "none",
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  timelineMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    transform: "translateX(-50%)",
    pointerEvents: "auto",
    borderRadius: 1,
  },
  timelineHandle: {
    position: "absolute",
    top: -4,
    bottom: -4,
    width: 3,
    background: "#222",
    borderRadius: 2,
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  timelineClocks: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    fontSize: 12,
    color: "#666",
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  timelineLegend: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 11,
    color: "#666",
  },
  legendDot: (color) => ({
    display: "inline-block",
    width: 10,
    height: 10,
    background: color,
    borderRadius: 2,
    marginRight: 4,
    marginLeft: 8,
    verticalAlign: "middle",
  }),

  controls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "12px 14px",
  },
  playBtn: {
    fontSize: 13,
    padding: "8px 18px",
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
    minWidth: 110,
  },
  speedGroup: { display: "flex", gap: 4, marginLeft: 8 },
  speedBtn: {
    fontSize: 12,
    padding: "6px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    fontWeight: 500,
  },
  speedBtnActive: {
    background: "#185FA5",
    color: "#fff",
    borderColor: "#185FA5",
  },
  resetBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    fontWeight: 500,
    marginLeft: "auto",
  },
  backBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyText: { fontSize: 15, color: "#666", marginBottom: 16 },
};
