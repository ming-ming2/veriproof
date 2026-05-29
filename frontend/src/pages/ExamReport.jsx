import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getReport } from "../api/exam";

export default function ExamReport({ examId }) {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getReport(examId);
        if (!cancelled) setReport(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "리포트를 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  if (loading) return <div style={styles.loading}>불러오는 중...</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!report) return null;

  const { summary, signalDistribution, suspiciousPatterns, students } = report;

  const formatDuration = (ms) => {
    if (!ms) return "-";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}분 ${secs}초`;
  };

  const sessionStatusLabel = (status) => {
    switch (status) {
      case "IN_PROGRESS": return "응시 중";
      case "SUBMITTED": return "제출 완료";
      case "EXPIRED": return "만료";
      default: return status || "-";
    }
  };

  const attentionLevelLabel = (level) => {
    switch (level) {
      case "HIGH": return "높음";
      case "MID": return "보통";
      case "LOW": return "낮음";
      case "NORMAL": return "정상";
      default: return level || "-";
    }
  };

  const attentionLevelStyle = (level) => {
    switch (level) {
      case "HIGH": return { background: "#fff0f0", color: "#c0392b" };
      case "MID": return { background: "#fff8ed", color: "#e67e22" };
      case "LOW": return { background: "#fffce0", color: "#b8860b" };
      case "NORMAL": return { background: "#f0fff4", color: "#27ae60" };
      default: return { background: "#f0f0f0", color: "#888" };
    }
  };

  const signalItems = [
    { key: "paste", label: "붙여넣기", count: signalDistribution.paste },
    { key: "visibilityLost", label: "화면 이탈", count: signalDistribution.visibilityLost },
    { key: "fullscreenExit", label: "전체화면 종료", count: signalDistribution.fullscreenExit },
    { key: "captureShortcut", label: "캡처 단축키", count: signalDistribution.captureShortcut },
    { key: "suspiciousChoiceChange", label: "의심 선택 변경", count: signalDistribution.suspiciousChoiceChange },
  ];
  const maxSignal = Math.max(...signalItems.map((d) => d.count), 1);

  const suspiciousItems = [
    { label: "화면 이탈 직후 답 변경", count: suspiciousPatterns.choiceChangeAfterReturn },
    { label: "화면 이탈 직후 붙여넣기", count: suspiciousPatterns.pasteAfterReturn },
  ];

  return (
    <div>
      {/* 응시자 통계 */}
      <div style={styles.sectionLabel}>응시자 통계</div>
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryCardLabel}>응시자</div>
          <div style={styles.summaryCardValue}>
            {summary.takerCount}
            <span style={styles.summaryCardSub}>/ {summary.rosterCount}명</span>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryCardLabel}>제출 완료</div>
          <div style={styles.summaryCardValue}>
            {summary.submittedCount}
            <span style={styles.summaryCardSub}>명</span>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryCardLabel}>평균 점수</div>
          <div style={styles.summaryCardValue}>
            {summary.avgScore != null ? summary.avgScore.toFixed(1) : "-"}
            <span style={styles.summaryCardSub}>점</span>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryCardLabel}>평균 작성 시간</div>
          <div style={styles.summaryCardValue}>{formatDuration(summary.avgDurationMs)}</div>
        </div>
      </div>

      {/* 시그널 분포 */}
      <div style={styles.sectionLabel}>시그널 종류별 분포</div>
      <div style={styles.chartBox}>
        {signalItems.map(({ key, label, count }) => (
          <div key={key} style={styles.barRow}>
            <div style={styles.barLabel}>{label}</div>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${(count / maxSignal) * 100}%`,
                }}
              />
            </div>
            <div style={styles.barCount}>{count}</div>
          </div>
        ))}
      </div>

      {/* 의심 패턴 */}
      <div style={styles.sectionLabel}>의심 패턴 통계</div>
      <div style={styles.patternBox}>
        {suspiciousItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              ...styles.patternItem,
              borderTop: idx > 0 ? "1px solid #f0f0f0" : "none",
            }}
          >
            <span style={styles.patternLabel}>{item.label}</span>
            <span style={styles.patternCount}>{item.count}건</span>
          </div>
        ))}
      </div>

      {/* 학생 목록 */}
      <div style={styles.sectionLabel}>
        학생 목록 ({students.length}명, 주목도 점수 순)
      </div>
      {students.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>학번</th>
                <th style={styles.th}>이름</th>
                <th style={styles.th}>상태</th>
                <th style={styles.th}>총점</th>
                <th style={styles.th}>응시 시간</th>
                <th style={styles.th}>주목도</th>
                <th style={styles.th}>재생</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.sessionId}
                  style={styles.studentRow}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#fafafa")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                  onClick={() =>
                    navigate(`/exam/${examId}/sessions/${s.sessionId}`)
                  }
                >
                  <td style={styles.tdMono}>{s.studentNumber}</td>
                  <td style={styles.td}>{s.studentName}</td>
                  <td style={styles.td}>{sessionStatusLabel(s.status)}</td>
                  <td style={styles.td}>{s.totalScore ?? "-"}</td>
                  <td style={styles.td}>{formatDuration(s.durationMs)}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.levelBadge,
                        ...attentionLevelStyle(s.attentionLevel),
                      }}
                    >
                      {attentionLevelLabel(s.attentionLevel)} ({s.attentionScore})
                    </span>
                  </td>
                  <td style={styles.td}>
                    {s.status === "SUBMITTED" ? (
                      <button
                        style={styles.replayBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/exam/${examId}/sessions/${s.sessionId}/replay`
                          );
                        }}
                      >
                        ▶ 재생
                      </button>
                    ) : (
                      <span style={styles.replayDisabled}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.emptyBox}>응시한 학생이 없습니다.</div>
      )}
    </div>
  );
}

const styles = {
  loading: { fontSize: 14, color: "#999", textAlign: "center", padding: 40 },
  error: { fontSize: 14, color: "#e24b4a", textAlign: "center", padding: 40 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 8,
    marginTop: 18,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 4,
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "14px 16px",
  },
  summaryCardLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  summaryCardValue: { fontSize: 22, fontWeight: 500, color: "#222" },
  summaryCardSub: { fontSize: 13, fontWeight: 400, color: "#888", marginLeft: 3 },

  chartBox: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barLabel: {
    width: 110,
    fontSize: 12,
    color: "#555",
    flexShrink: 0,
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 14,
    background: "#f0f0f0",
    borderRadius: 7,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "#185FA5",
    borderRadius: 7,
    transition: "width 0.3s",
    minWidth: 4,
  },
  barCount: {
    width: 28,
    fontSize: 12,
    color: "#555",
    textAlign: "right",
    flexShrink: 0,
  },

  patternBox: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "0 20px",
  },
  patternItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
  },
  patternLabel: { fontSize: 13, color: "#444" },
  patternCount: { fontSize: 15, fontWeight: 500, color: "#222" },

  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflowX: "auto",
    background: "#fff",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 12,
    fontWeight: 500,
    color: "#888",
    textAlign: "left",
    padding: "10px 14px",
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    whiteSpace: "nowrap",
  },
  td: {
    fontSize: 13,
    color: "#444",
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
    whiteSpace: "nowrap",
  },
  tdMono: {
    fontSize: 13,
    color: "#444",
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
    fontFamily: '"SF Mono", "Fira Code", monospace',
    whiteSpace: "nowrap",
  },
  studentRow: { cursor: "pointer", transition: "background 0.1s" },
  levelBadge: {
    display: "inline-block",
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 10,
    fontWeight: 500,
  },
  replayBtn: {
    fontSize: 11,
    padding: "4px 10px",
    border: "1px solid #185FA5",
    borderRadius: 6,
    background: "#fff",
    color: "#185FA5",
    cursor: "pointer",
    fontWeight: 500,
  },
  replayDisabled: { fontSize: 12, color: "#bbb" },
  emptyBox: {
    textAlign: "center",
    padding: 24,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    fontSize: 13,
    color: "#999",
  },
};
