import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionAnswers, gradeSubjective } from "../api/exam";

export default function SessionGrade() {
  const navigate = useNavigate();
  const { examId, sessionId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scoreInputs, setScoreInputs] = useState({});       // { [questionId]: "20" }
  const [savingId, setSavingId] = useState(null);
  const [rowMsg, setRowMsg] = useState({});                 // { [questionId]: "저장됨" | "에러" }

  const load = async () => {
    try {
      const { data: res } = await getSessionAnswers(examId, sessionId);
      setData(res.data);
      const initial = {};
      (res.data.answers || []).forEach((a) => {
        if (a.questionType === "SUBJECTIVE") {
          initial[a.questionId] = a.earnedScore?.toString() ?? "";
        }
      });
      setScoreInputs(initial);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "답안을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, sessionId]);

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleSave = async (answer) => {
    const raw = scoreInputs[answer.questionId];
    const score = Number(raw);
    if (raw === "" || Number.isNaN(score)) {
      setRowMsg((m) => ({ ...m, [answer.questionId]: "점수를 입력하세요." }));
      return;
    }
    if (score < 0 || score > answer.points) {
      setRowMsg((m) => ({
        ...m,
        [answer.questionId]: `0~${answer.points} 사이여야 합니다.`,
      }));
      return;
    }
    setSavingId(answer.questionId);
    setRowMsg((m) => ({ ...m, [answer.questionId]: "" }));
    try {
      await gradeSubjective(examId, sessionId, answer.questionId, score);
      // 총점 동기화 위해 다시 로드
      await load();
      setRowMsg((m) => ({ ...m, [answer.questionId]: "저장됨" }));
      setTimeout(() => {
        setRowMsg((m) => ({ ...m, [answer.questionId]: "" }));
      }, 1500);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const message =
        err.response?.data?.error?.message || "저장에 실패했습니다.";
      setRowMsg((m) => ({
        ...m,
        [answer.questionId]: code ? `[${code}] ${message}` : message,
      }));
    } finally {
      setSavingId(null);
    }
  };

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
          <p style={styles.errorText}>{error || "데이터를 찾을 수 없습니다."}</p>
          <button style={styles.backBtn} onClick={() => navigate(`/exam/${examId}`)}>
            시험 상세로
          </button>
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
        <p style={styles.breadcrumb}>학생 답안 상세</p>
        <h1 style={styles.pageTitle}>
          {data.studentName}{" "}
          <span style={styles.studentNumber}>({data.studentNumber})</span>
        </h1>

        <div style={styles.metaRow}>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>상태</div>
            <div style={styles.metaValue}>
              {data.status === "SUBMITTED" ? "제출 완료" : data.status}
            </div>
          </div>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>총점</div>
            <div style={styles.metaValueBig}>{data.totalScore ?? "-"}점</div>
          </div>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>제출 시각</div>
            <div style={styles.metaValue}>{formatDate(data.submittedAt)}</div>
          </div>
        </div>

        <div style={styles.sectionLabel}>문항별 답안</div>
        <div style={styles.answerList}>
          {data.answers.map((a, idx) => (
            <div key={a.questionId} style={styles.answerCard}>
              <div style={styles.answerHeader}>
                <span style={styles.qNum}>문항 {idx + 1}</span>
                <span style={styles.typeBadge}>
                  {a.questionType === "MULTIPLE_CHOICE" ? "객관식" : "주관식"}
                </span>
                <span style={styles.pointsBadge}>
                  {a.earnedScore ?? 0} / {a.points}점
                </span>
              </div>

              <div style={styles.qBody}>{a.questionBody}</div>

              {a.questionType === "MULTIPLE_CHOICE" ? (
                <ul style={styles.choiceList}>
                  {a.choices.map((c) => {
                    const selected = a.selectedChoiceIds.includes(c.id);
                    return (
                      <li
                        key={c.id}
                        style={{
                          ...styles.choiceItem,
                          ...(c.isCorrect ? styles.choiceCorrect : {}),
                          ...(selected ? styles.choiceSelected : {}),
                        }}
                      >
                        <span style={styles.choiceMarks}>
                          {c.isCorrect ? "✔" : "·"}
                          {selected ? "◉" : "○"}
                        </span>
                        <span>{c.body}</span>
                      </li>
                    );
                  })}
                  <li style={styles.choiceHint}>
                    ✔ = 정답, ◉ = 학생 선택, ○ = 선택 안 함
                  </li>
                </ul>
              ) : (
                <>
                  <div style={styles.subFieldLabel}>학생 답안</div>
                  <div style={styles.subAnswerBox}>
                    {a.answerText || (
                      <span style={styles.empty}>(답안 없음)</span>
                    )}
                  </div>
                  {a.correctAnswer && (
                    <>
                      <div style={styles.subFieldLabel}>참조용 정답</div>
                      <div style={styles.correctAnswerBox}>{a.correctAnswer}</div>
                    </>
                  )}
                  <div style={styles.gradingRow}>
                    <label style={styles.gradeLabel}>점수</label>
                    <input
                      type="number"
                      min="0"
                      max={a.points}
                      value={scoreInputs[a.questionId] ?? ""}
                      onChange={(e) =>
                        setScoreInputs((s) => ({
                          ...s,
                          [a.questionId]: e.target.value,
                        }))
                      }
                      style={styles.scoreInput}
                    />
                    <span style={styles.maxScore}>/ {a.points}점</span>
                    <button
                      type="button"
                      style={{
                        ...styles.saveBtn,
                        opacity: savingId === a.questionId ? 0.5 : 1,
                      }}
                      disabled={savingId === a.questionId}
                      onClick={() => handleSave(a)}
                    >
                      {savingId === a.questionId ? "저장 중..." : "저장"}
                    </button>
                    {rowMsg[a.questionId] && (
                      <span
                        style={{
                          ...styles.rowMsg,
                          color:
                            rowMsg[a.questionId] === "저장됨"
                              ? "#185FA5"
                              : "#c0392b",
                        }}
                      >
                        {rowMsg[a.questionId]}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
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
  backBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  },

  content: { maxWidth: 760, margin: "0 auto", padding: "32px 20px" },
  loadingText: { fontSize: 14, color: "#999", textAlign: "center", padding: 60 },
  errorText: { fontSize: 14, color: "#c0392b", padding: 20, textAlign: "center" },

  breadcrumb: { fontSize: 13, color: "#888", margin: "0 0 2px" },
  pageTitle: { fontSize: 22, fontWeight: 500, margin: "0 0 20px" },
  studentNumber: {
    fontSize: 14,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    color: "#888",
    fontWeight: 400,
    marginLeft: 6,
  },

  metaRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 },
  metaCard: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "14px 16px",
  },
  metaLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: 500, color: "#333" },
  metaValueBig: { fontSize: 22, fontWeight: 500, color: "#185FA5" },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 10,
  },
  answerList: { display: "flex", flexDirection: "column", gap: 12 },
  answerCard: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 16,
  },
  answerHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  qNum: { fontSize: 13, fontWeight: 500, color: "#333" },
  typeBadge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#eef4ff",
    color: "#185FA5",
  },
  pointsBadge: {
    fontSize: 12,
    color: "#185FA5",
    marginLeft: "auto",
    fontWeight: 500,
  },
  qBody: {
    fontSize: 14,
    color: "#333",
    whiteSpace: "pre-wrap",
    marginBottom: 12,
  },

  choiceList: { listStyle: "none", padding: 0, margin: 0 },
  choiceItem: {
    fontSize: 13,
    color: "#555",
    padding: "6px 10px",
    borderRadius: 6,
    marginBottom: 4,
    display: "flex",
    gap: 8,
    background: "#fafafa",
  },
  choiceCorrect: { background: "#eef4ff", color: "#185FA5" },
  choiceSelected: { fontWeight: 500, borderLeft: "3px solid #185FA5" },
  choiceMarks: {
    minWidth: 40,
    fontFamily: '"SF Mono", monospace',
    fontSize: 12,
  },
  choiceHint: {
    fontSize: 11,
    color: "#aaa",
    padding: "6px 10px",
    marginTop: 4,
  },

  subFieldLabel: {
    fontSize: 12,
    color: "#888",
    margin: "8px 0 4px",
    fontWeight: 500,
  },
  subAnswerBox: {
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 13,
    color: "#333",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  empty: { color: "#bbb", fontStyle: "italic" },
  correctAnswerBox: {
    background: "#eef4ff",
    border: "1px solid #d0e2f5",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    color: "#185FA5",
  },

  gradingRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px dashed #eee",
  },
  gradeLabel: { fontSize: 13, fontWeight: 500, color: "#555" },
  scoreInput: {
    width: 70,
    padding: "6px 10px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 6,
    outline: "none",
    textAlign: "center",
  },
  maxScore: { fontSize: 13, color: "#888" },
  saveBtn: {
    padding: "6px 16px",
    fontSize: 13,
    border: "none",
    borderRadius: 6,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  rowMsg: { fontSize: 12, marginLeft: 4 },
};
